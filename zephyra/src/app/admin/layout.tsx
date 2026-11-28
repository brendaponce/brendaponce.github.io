import localFont from "next/font/local";

const rothwell = localFont({ src: "../fonts/rothwell/Rothwell.otf", variable: "--font-rothwell", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={rothwell.variable}>{children}</div>;
}
