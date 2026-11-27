import { NextResponse } from "next/server";
import { readLocalFile } from "@/lib/store-local";

export const runtime = "nodejs";

/** Serves photo files in local development only (the live site serves them straight from Supabase). */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  if (key.length !== 1) return new NextResponse("Not found", { status: 404 });
  const file = await readLocalFile(key[0]);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
