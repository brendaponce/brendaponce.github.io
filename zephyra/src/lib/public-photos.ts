import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getStore, toPhoto } from "./store";
import type { Photo } from "./types";

/** MOCK: stand-in places for the photos in /public until real labels exist. Replace by labelling photos in admin. */
const MOCK_PLACES = ["Hanoi, Vietnam", "Lisbon, Portugal", "Kyoto, Japan", "Oaxaca, Mexico", "Marrakech, Morocco", "Reykjavik, Iceland"];
const mockPlace = (name: string) => {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return MOCK_PLACES[(h >>> 0) % MOCK_PLACES.length];
};

const EXT = /\.(jpe?g|png|webp)$/i;

/** Read width/height from the file header only (no need to load a 25 MB photo). Honors EXIF rotation. */
async function dimensions(file: string): Promise<{ width: number; height: number }> {
  const fh = await open(file, "r");
  try {
    const head = Buffer.alloc(32);
    await fh.read(head, 0, 32, 0);
    // PNG
    if (head.toString("latin1", 1, 4) === "PNG") return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    // WebP
    if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP") {
      const kind = head.toString("latin1", 12, 16);
      if (kind === "VP8X") return { width: 1 + head.readUIntLE(24, 3), height: 1 + head.readUIntLE(27, 3) };
      if (kind === "VP8L") {
        const b = head.readUInt32LE(21);
        return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
      }
      if (kind === "VP8 ") return { width: head.readUInt16LE(26) & 0x3fff, height: head.readUInt16LE(28) & 0x3fff };
    }
    // JPEG: walk the segments until the frame header; note EXIF orientation on the way.
    let pos = 2;
    let orientation = 1;
    const seg = Buffer.alloc(16);
    for (let n = 0; n < 200; n++) {
      await fh.read(seg, 0, 4, pos);
      if (seg[0] !== 0xff) break;
      const marker = seg[1];
      const len = seg.readUInt16BE(2);
      if (marker === 0xe1 && len > 14) {
        const exif = Buffer.alloc(Math.min(len - 2, 4096));
        await fh.read(exif, 0, exif.length, pos + 4);
        if (exif.toString("latin1", 0, 4) === "Exif") {
          const le = exif.toString("latin1", 6, 8) === "II";
          const u16 = (o: number) => (le ? exif.readUInt16LE(o) : exif.readUInt16BE(o));
          const u32 = (o: number) => (le ? exif.readUInt32LE(o) : exif.readUInt32BE(o));
          const ifd = 6 + u32(10);
          const count = ifd + 2 <= exif.length ? u16(ifd) : 0;
          for (let i = 0; i < count && ifd + 2 + i * 12 + 12 <= exif.length; i++) {
            const e = ifd + 2 + i * 12;
            if (u16(e) === 0x0112) orientation = u16(e + 8);
          }
        }
      }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        await fh.read(seg, 0, 9, pos + 4);
        const height = seg.readUInt16BE(1);
        const width = seg.readUInt16BE(3);
        return orientation >= 5 ? { width: height, height: width } : { width, height };
      }
      pos += 2 + len;
    }
  } finally {
    await fh.close();
  }
  return { width: 3, height: 2 };
}

/** Every image currently in /public (newest first), served through Next's image optimizer. Read fresh on every call. */
export async function listPublicPhotos(): Promise<Photo[]> {
  const dir = path.join(process.cwd(), "public");
  const names = (await readdir(dir)).filter((n) => EXT.test(n));
  const optimized = (name: string, w: number) => `/_next/image?url=${encodeURIComponent("/" + name)}&w=${w}&q=75`;
  const photos = await Promise.all(
    names.map(async (name) => {
      const file = path.join(dir, name);
      const [{ mtime }, { width, height }] = await Promise.all([stat(file), dimensions(file)]);
      return {
        id: `${name}:${mtime.getTime()}`,
        title: "",
        location: mockPlace(name),
        takenAt: mtime.toISOString(),
        width,
        height,
        thumbUrl: optimized(name, 1200),
        fullUrl: optimized(name, 3840),
      };
    }),
  );
  return photos.sort((a, b) => b.takenAt.localeCompare(a.takenAt) || a.id.localeCompare(b.id));
}

/** The whole wall: photos uploaded in admin (with their real labels) plus the files in /public (with mocked labels). */
export async function listAllPhotos(): Promise<Photo[]> {
  const store = getStore();
  const [uploaded, files] = await Promise.all([store.list().then((l) => l.map((r) => toPhoto(store, r))), listPublicPhotos()]);
  return [...uploaded, ...files].sort((a, b) => b.takenAt.localeCompare(a.takenAt) || a.id.localeCompare(b.id));
}
