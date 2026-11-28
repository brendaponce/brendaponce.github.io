import type { Metadata } from "next";
import CollageView from "../collage/CollageView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nectar", robots: { index: false, follow: false } };

export default function CollageStraight() {
  return <CollageView variant="straight" />;
}
