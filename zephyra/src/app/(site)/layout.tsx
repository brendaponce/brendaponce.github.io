import localFont from "next/font/local";
import { emptySocials } from "@/lib/socials";
import { getStore } from "@/lib/store";
import Shell from "./Shell";
import "./final.css";

const rothwell = localFont({ src: "../fonts/rothwell/Rothwell.otf", variable: "--font-rothwell", display: "swap" });

export const dynamic = "force-dynamic"; // social links set in admin show up right away

export default async function FinalLayout({ children }: { children: React.ReactNode }) {
  let socials = emptySocials();
  try {
    socials = (await getStore().getSettings()).socials;
  } catch {
    // if settings can't be read, the site still works, just without the links
  }
  return (
    <div className={`fin ${rothwell.variable}`} data-theme="dark">
      <Shell socials={socials}>{children}</Shell>
    </div>
  );
}
