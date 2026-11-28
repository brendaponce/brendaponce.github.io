"use client";

import { useCallback, useEffect, useState } from "react";
import type { Photo } from "@/lib/types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default function Gallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, step]);

  // Quietly fetch the next and previous full-size photos so the viewer feels instant.
  useEffect(() => {
    if (open === null) return;
    for (const d of [1, -1]) {
      const p = photos[(open + d + photos.length) % photos.length];
      if (p) new Image().src = p.fullUrl;
    }
  }, [open, photos]);

  const current = open === null ? null : photos[open];

  return (
    <>
      <div className="grid">
        {photos.map((p, i) => (
          <figure className="tile" key={p.id}>
            <button
              type="button"
              className="imgwrap"
              style={{ aspectRatio: `${p.width} / ${p.height}` }}
              onClick={() => setOpen(i)}
              aria-label={`View ${p.title || "photo"} full screen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl} alt={p.title || "Photograph"} width={p.width} height={p.height} loading={i < 6 ? "eager" : "lazy"} decoding="async" />
            </button>
            <figcaption className="cap">
              <span className="t">{p.title}</span>
              <span className="d">{fmt(p.takenAt)}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      {current && (
        <div className="lb" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <button className="nb close" onClick={() => setOpen(null)} aria-label="Close">✕</button>
          {photos.length > 1 && <button className="nb prev" onClick={() => step(-1)} aria-label="Previous">←</button>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.fullUrl} alt={current.title || "Photograph"} />
          <div className="cap">
            <span className="t" style={{ flex: "none" }}>{current.title}</span>
            <span className="d">{fmt(current.takenAt)}</span>
          </div>
          {photos.length > 1 && <button className="nb next" onClick={() => step(1)} aria-label="Next">→</button>}
        </div>
      )}
    </>
  );
}
