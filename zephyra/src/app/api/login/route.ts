import { NextResponse } from "next/server";
import { COOKIE, cookieOptions, makeToken, passwordOk, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let password = "";
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? "");
  } catch {
    /* empty body */
  }
  // A short pause makes guessing passwords by brute force painfully slow.
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordOk(password)) return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(), cookieOptions);
  return res;
}
