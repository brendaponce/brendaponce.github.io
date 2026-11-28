import type { Metadata } from "next";
import CollageView from "./CollageView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nectar", robots: { index: false, follow: false } };

export default function Collage() {
  return <CollageView variant="diagonal" />;
}
