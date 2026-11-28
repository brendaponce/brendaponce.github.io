import { listAllPhotos } from "@/lib/public-photos";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listAllPhotos(), { headers: { "Cache-Control": "no-store" } });
}
