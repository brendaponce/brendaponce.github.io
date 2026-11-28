import localFont from "next/font/local";
import { listPublicPhotos } from "@/lib/public-photos";
import "./collage.css";

const rothwell = localFont({ src: "../fonts/rothwell/Rothwell.otf", variable: "--font-rothwell", display: "swap" });

/** Shard shapes (clip-path polygons, % of the screen) and the cut lines drawn between them. */
const LAYOUTS = {
  diagonal: {
    shards: [
      "polygon(0 0,32% 0,6% 100%,0 100%)",
      "polygon(32% 0,58% 0,48% 100%,6% 100%)",
      "polygon(58% 0,82% 0,78% 100%,48% 100%)",
      "polygon(82% 0,100% 0,100% 100%,78% 100%)",
    ],
    cuts: [[32, 0, 6, 100], [58, 0, 48, 100], [82, 0, 78, 100]],
  },
  straight: {
    // one vertical cut, then each side split at a different height
    shards: [
      "polygon(0 0,38% 0,38% 58%,0 58%)",
      "polygon(0 58%,38% 58%,38% 100%,0 100%)",
      "polygon(38% 0,100% 0,100% 36%,38% 36%)",
      "polygon(38% 36%,100% 36%,100% 100%,38% 100%)",
    ],
    cuts: [[38, 0, 38, 100], [0, 58, 38, 58], [38, 36, 100, 36]],
  },
} as const;

export default async function CollageView({ variant }: { variant: keyof typeof LAYOUTS }) {
  const layout = LAYOUTS[variant];
  const all = await listPublicPhotos();
  // four photos spread across the folder; swap these indexes to pick different ones
  const pick = [0, 4, 8, 12].map((i) => all[i % Math.max(all.length, 1)]).filter(Boolean);
  const src = (id: string) => `/_next/image?url=${encodeURIComponent("/" + id.split(":")[0])}&w=2048&q=75`;

  return (
    <main className={`col ${rothwell.variable}`}>
      {pick.map((p, i) => (
        <div key={p.id} className="shard" style={{ backgroundImage: `url(${src(p.id)})`, clipPath: layout.shards[i] }} />
      ))}

      {/* thin black "sword cuts" between the shards, same width at any angle */}
      <svg className="cuts" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {layout.cuts.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </svg>

      <div className="top">
        <span>Nine</span>
        <span>To</span>
        <span>Five</span>
        <span>Studio</span>
      </div>

      <svg className="mark" viewBox="0 0 485 485" role="img" aria-label="9:5">
        <rect x="0" y="0" width="85" height="241" />
        <rect x="99" y="0" width="86" height="485" />
        <circle cx="240" cy="196" r="46" />
        <circle cx="240" cy="439" r="46" />
        <rect x="298" y="0" width="85" height="241" />
        <rect x="398" y="0" width="87" height="121" />
        <rect x="398" y="243" width="87" height="242" />
        <rect x="0" y="364" width="85" height="121" />
        <rect x="298" y="364" width="85" height="121" />
      </svg>

      <div className="bottom">
        <div className="info">
          <b>( Where )</b>
          Piazzale Flemming, 1<br />25015 . Desenzano del Garda<br />Brescia . Italy
        </div>
        <div className="info r">
          <b>( Instagram )</b>
          Follow us<br />@ninetofive.hub<br />From 9 am to 5 pm
        </div>
      </div>
      <div className="big">Architects</div>
    </main>
  );
}
