import { listAllPhotos } from "@/lib/public-photos";
import FinalGallery from "./FinalGallery";

export const dynamic = "force-dynamic";

export default async function FinalHome() {
  return <FinalGallery initial={await listAllPhotos()} />;
}
