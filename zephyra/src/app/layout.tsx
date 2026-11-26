import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const jost = localFont({
  src: [
    { path: "./fonts/jost-latin-200-normal.woff2", weight: "200", style: "normal" },
    { path: "./fonts/jost-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/jost-latin-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zephyra",
  description: "Photographs.",
  openGraph: { title: "Zephyra", description: "Photographs.", type: "website" },
};
export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body>{children}</body>
    </html>
  );
}
