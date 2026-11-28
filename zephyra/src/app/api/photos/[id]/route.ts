import { NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/auth";
import { getStore, toPhoto } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/;

/** Owner only: change a photo's title and/or location. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const patch: { title?: string; location?: string } = {};
  try {
    const body = (await req.json()) as { title?: unknown; location?: unknown };
    if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 80);
    if (typeof body.location === "string") patch.location = body.location.trim().slice(0, 80);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (patch.title === undefined && patch.location === undefined) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const store = getStore();
  const rec = await store.update(id, patch);
  return rec ? NextResponse.json(toPhoto(store, rec)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Owner only: delete a photo. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await getStore().remove(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
