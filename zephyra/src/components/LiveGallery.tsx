"use client";

import { useEffect, useState } from "react";
import Gallery from "./Gallery";
import type { Photo } from "@/lib/types";

/** Shows the wall and quietly re-checks the /public folder so new or removed photos appear without a reload. */
export default function LiveGallery({ initial }: { initial: Photo[] }) {
  const [photos, setPhotos] = useState(initial);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/public-photos", { cache: "no-store" });
        if (!res.ok || stop) return;
        const next: Photo[] = await res.json();
        setPhotos((cur) => (cur.map((p) => p.id).join("|") === next.map((p) => p.id).join("|") ? cur : next));
      } catch {}
    };
    const t = setInterval(check, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return photos.length ? <Gallery photos={photos} /> : <p className="empty">No photographs yet</p>;
}
