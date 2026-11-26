import { NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/auth";
import { getStore, storageProblem, toPhoto } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FULL = 4_000_000; // bytes — the browser shrinks every photo to fit
const MAX_THUMB = 600_000;
const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const int = (v: FormDataEntryValue | null) => Math.round(Number(v));

/** Public: the list of photos. */
export async function GET() {
  const store = getStore();
  const list = await store.list();
  return NextResponse.json(list.map((r) => toPhoto(store, r)));
}

/** Owner only: upload one photo (a large version and a smaller one for the wall). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const problem = storageProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Bad upload" }, { status: 400 });
  }
  const fullF = form.get("full");
  const thumbF = form.get("thumb");
  if (!(fullF instanceof File) || !(thumbF instanceof File)) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }
  if (fullF.size > MAX_FULL || thumbF.size > MAX_THUMB) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }
  const full = Buffer.from(await fullF.arrayBuffer());
  const thumb = Buffer.from(await thumbF.arrayBuffer());
  if (!isJpeg(full) || !isJpeg(thumb)) return NextResponse.json({ error: "Images must be JPEG" }, { status: 415 });

  const width = int(form.get("width"));
  const height = int(form.get("height"));
  if (!(width >= 1 && width <= 20000 && height >= 1 && height <= 20000)) {
    return NextResponse.json({ error: "Bad size" }, { status: 400 });
  }
  const title = String(form.get("title") ?? "").trim().slice(0, 80);
  const t = new Date(String(form.get("takenAt") ?? ""));
  const takenAt = (isNaN(t.getTime()) ? new Date() : t).toISOString();

  try {
    const store = getStore();
    const rec = await store.add({ title, takenAt, width, height }, full, thumb);
    return NextResponse.json(toPhoto(store, rec), { status: 201 });
  } catch (e) {
    console.error("upload failed", e);
    return NextResponse.json({ error: "Could not save the photo" }, { status: 500 });
  }
}
