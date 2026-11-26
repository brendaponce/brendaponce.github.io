import { NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/auth";
import { getStore, toPhoto } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/;

/** Owner only: change a photo's title. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let title = "";
  try {
    title = String(((await req.json()) as { title?: unknown }).title ?? "").trim().slice(0, 80);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const store = getStore();
  const rec = await store.update(id, { title });
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
