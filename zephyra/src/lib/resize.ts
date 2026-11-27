/**
 * Runs in the browser. Shrinks a photo to a sharp, web-sized JPEG (long edge up to 3000 px)
 * plus a smaller version for the wall. Re-encoding also strips hidden metadata such as the
 * GPS location stored inside phone photos, so it never ends up on a public site.
 */
const FULL_EDGE = 3000;
const THUMB_EDGE = 1200;
const FULL_MAX_BYTES = 3_900_000; // keep each upload under the host's 4.5 MB request limit
const THUMB_MAX_BYTES = 550_000;

export interface Prepared {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function encode(src: ImageBitmap, edge: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const k = Math.min(1, edge / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, w, h }) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  );
}

/** Highest quality that still fits under `maxBytes`; shrinks the picture slightly only as a last resort. */
async function fit(src: ImageBitmap, edge: number, maxBytes: number, qualities: number[]) {
  let e = edge;
  for (let round = 0; round < 4; round++) {
    for (const q of qualities) {
      const out = await encode(src, e, q);
      if (out.blob.size <= maxBytes) return out;
    }
    e = Math.round(e * 0.85);
  }
  throw new Error("Image too large to upload");
}

export async function prepare(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = await fit(bitmap, FULL_EDGE, FULL_MAX_BYTES, [0.92, 0.88, 0.84, 0.8, 0.75]);
    const thumb = await fit(bitmap, THUMB_EDGE, THUMB_MAX_BYTES, [0.86, 0.8, 0.72, 0.65]);
    return { full: full.blob, thumb: thumb.blob, width: full.w, height: full.h };
  } finally {
    bitmap.close();
  }
}
