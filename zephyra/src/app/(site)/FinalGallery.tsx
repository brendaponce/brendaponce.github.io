"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Photo } from "@/lib/types";

/** Frame shapes (width / height) the wall mixes: tall, square, wide. */
const SHAPES = [3 / 4, 3 / 2, 1, 2 / 3, 5 / 4, 4 / 5, 16 / 10];
const hash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Smallest allowed difference (in column-widths) between neighbouring photo bottoms, so edges never line up. */
const MIN_STEP = 0.3;

/**
 * Deals photos into columns: each goes to the currently shortest column, in a frame shape picked from the file name.
 * A shape is skipped if it repeats the one above or the previous photo, or if it would end level with another
 * column. Every column starts flush at the top, so any ragged edge is at the bottom.
 */
function deal(photos: Photo[], cols: number) {
  const heights: number[] = Array(cols).fill(0);
  const lastShape: number[] = Array(cols).fill(-1);
  const columns: { photo: Photo; index: number; shape: number }[][] = Array.from({ length: cols }, () => []);
  let prev = -1;
  photos.forEach((photo, index) => {
    const c = heights.indexOf(Math.min(...heights));
    const start = hash(photo.id.split(":")[0]) % SHAPES.length;
    const ok = (k: number, strict: boolean) =>
      k !== lastShape[c] &&
      k !== prev &&
      (!strict || heights.every((h, j) => j === c || Math.abs(heights[c] + 1 / SHAPES[k] - h) > MIN_STEP));
    let k = start;
    for (const strict of [true, false]) {
      const found = SHAPES.map((_, i) => (start + i) % SHAPES.length).find((cand) => ok(cand, strict));
      if (found !== undefined) {
        k = found;
        break;
      }
    }
    lastShape[c] = prev = k;
    columns[c].push({ photo, index, shape: SHAPES[k] });
    heights[c] += 1 / SHAPES[k];
  });
  return columns;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
const MS = 650; // must match the viewer's transition time in final.css

/** The largest box with the photo's own proportions that fits the screen, centred, with a small margin. */
function fit(photo: Photo, vw: number, vh: number): Box {
  const pad = vw < 700 ? 12 : 28;
  const scale = Math.min((vw - pad * 2) / photo.width, (vh - pad * 2) / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
}
const boxOf = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

/** Rounded masonry wall with a full-screen viewer. Re-checks the photo folder so new photos appear on their own. */
export default function FinalGallery({ initial }: { initial: Photo[] }) {
  const [photos, setPhotos] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null); // where the viewer's photo frame is right now
  const [animate, setAnimate] = useState(false); // only the open / close moves are animated
  const [shown, setShown] = useState(false); // backdrop and buttons
  const [loaded, setLoaded] = useState(false); // full-size image ready
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const set = () => setCols(mq.matches ? 1 : 2);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  const columns = useMemo(() => deal(photos, cols), [photos, cols]);

  useEffect(() => {
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/public-photos", { cache: "no-store" });
        if (!res.ok) return;
        const next: Photo[] = await res.json();
        setPhotos((cur) => (cur.map((p) => p.id).join("|") === next.map((p) => p.id).join("|") ? cur : next));
      } catch {}
    };
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);

  const viewport = () => ({ vw: window.innerWidth, vh: window.innerHeight });
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Opens the viewer: the photo frame starts exactly over the tile that was clicked, then unwraps to fit the screen. */
  const openAt = (index: number, from: DOMRect) => {
    if (closing.current) clearTimeout(closing.current);
    setOpen(index);
    setLoaded(false);
    setAnimate(false);
    setShown(false);
    setBox(boxOf(from));
    // wait two frames so the browser paints the starting box before it moves
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const { vw, vh } = viewport();
        setAnimate(true);
        setShown(true);
        setBox(fit(photos[index], vw, vh));
      }),
    );
  };

  /** Closes the viewer: the frame folds back into its tile (or just fades if that tile is off screen). */
  const closeViewer = useCallback(() => {
    if (open === null) return;
    const tile = document.querySelector<HTMLElement>(`[data-i="${open}"]`);
    const r = tile?.getBoundingClientRect();
    const visible = !!r && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    setAnimate(true);
    setShown(false);
    if (r && visible) setBox(boxOf(r));
    closing.current = setTimeout(() => {
      setOpen(null);
      setBox(null);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : MS);
  }, [open]);

  const step = useCallback(
    (d: number) => {
      if (open === null) return;
      const next = (open + d + photos.length) % photos.length;
      setAnimate(false); // flipping between photos is instant
      setLoaded(false);
      setOpen(next);
      setBox(fit(photos[next], window.innerWidth, window.innerHeight));
    },
    [open, photos],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    // keep the photo fitted if the window is resized while it's open
    const onResize = () => shown && setBox(fit(photos[open], window.innerWidth, window.innerHeight));
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [open, step, closeViewer, shown, photos]);

  // Quietly load the neighbours so flipping through feels instant.
  useEffect(() => {
    if (open === null) return;
    for (const d of [1, -1]) {
      const p = photos[(open + d + photos.length) % photos.length];
      if (p) new Image().src = p.fullUrl;
    }
  }, [open, photos]);

  if (!photos.length) return <p className="fempty">No photographs yet</p>;
  const current = open === null ? null : photos[open];

  return (
    <>
      <div className="fgrid">
        {columns.map((col, c) => (
          <div className="fcol" key={c}>
            {col.map(({ photo: p, index, shape }) => (
              <button key={p.id} type="button" className="ftile" style={{ aspectRatio: String(shape) }} data-i={index} onClick={(e) => openAt(index, e.currentTarget.getBoundingClientRect())} aria-label={`View photo ${index + 1} full screen`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl} alt={p.title || "Photograph"} loading={index < 6 ? "eager" : "lazy"} decoding="async" />
                {p.location && <span className="floc">{p.location}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      {current && box && (
        <div className={"flb" + (shown ? " on" : "")} role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={closeViewer}>
          {/* While the photo is still tile-sized (opening / closing) this mask hides anything above the header's bottom edge,
              so the photo appears to slide out from under the header and back beneath it. Fully open, the mask lifts. */}
          <div className={"flb-clip" + (shown ? " open" : "")}>
            <div
              className={"flb-stage" + (animate && !reduced() ? " anim" : "")}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* the small version is already loaded, so the unwrap starts instantly; the sharp one fades in over it */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="t" src={current.thumbUrl} alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={current.id} className={"f" + (loaded ? " ok" : "")} src={current.fullUrl} alt={current.title || "Photograph"} onLoad={() => setLoaded(true)} />
            </div>
          </div>
          <button className="flb-x" onClick={closeViewer} aria-label="Close">✕</button>
          {photos.length > 1 && (
            <>
              <button className="flb-n prev" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous">←</button>
              <button className="flb-n next" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next">→</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
