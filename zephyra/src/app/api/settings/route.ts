import { NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/auth";
import { SOCIAL_META, emptySocials, normalizeSocial } from "@/lib/socials";
import { getStore, storageProblem } from "@/lib/store";
import { SOCIAL_KEYS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: the social links shown on the site. */
export async function GET() {
  return NextResponse.json(await getStore().getSettings(), { headers: { "Cache-Control": "no-store" } });
}

/** Owner only: save the social links. Usernames are turned into full links; anything unusable is rejected. */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const problem = storageProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });

  let body: { socials?: Record<string, unknown> };
  try {
    body = (await req.json()) as { socials?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const socials = emptySocials();
  for (const key of SOCIAL_KEYS) {
    const v = body.socials?.[key];
    const out = normalizeSocial(key, typeof v === "string" ? v : "");
    if (out === null) return NextResponse.json({ error: `That ${SOCIAL_META[key].label} link doesn’t look right.`, field: key }, { status: 400 });
    socials[key] = out;
  }
  try {
    return NextResponse.json(await getStore().saveSettings({ socials }));
  } catch (e) {
    console.error("save settings failed", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
