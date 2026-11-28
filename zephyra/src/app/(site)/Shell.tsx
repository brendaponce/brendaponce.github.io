"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SOCIAL_META } from "@/lib/socials";
import { SOCIAL_KEYS, type Socials } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/prints", label: "Prints" },
];

/** Header, menu, dark/light switch and back-to-top button shared by every page under /final. */
export default function Shell({ children, socials }: { children: React.ReactNode; socials: Socials }) {
  const links = SOCIAL_KEYS.filter((k) => socials[k]);
  const path = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menu, setMenu] = useState(false);
  const [showTop, setShowTop] = useState(false);

  // Remember the visitor's theme choice.
  useEffect(() => {
    const saved = localStorage.getItem("nectar-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);
  useEffect(() => {
    document.querySelector(".fin")?.setAttribute("data-theme", theme);
  }, [theme]);
  // Saved only when the visitor picks a theme, so the initial default never overwrites an earlier choice.
  const choose = (t: "dark" | "light") => {
    setTheme(t);
    localStorage.setItem("nectar-theme", t);
  };

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menu]);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <header className="fh">
        <Link href="/" className="fh-logo" aria-label="Brenda Ponce, home">
          <span className="s">Brenda</span>
          <span className="b">Ponce</span>
        </Link>
        <nav className="fh-nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? "on" : ""} aria-current={active(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <button className="fh-burger" onClick={() => setMenu((m) => !m)} aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu}>
          <span /><span />
        </button>
      </header>

      <div className={"fmenu" + (menu ? " open" : "")} aria-hidden={!menu}>
        <nav>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} tabIndex={menu ? 0 : -1}>{l.label}</Link>
          ))}
        </nav>
        {links.length > 0 && (
          <div className="fmenu-social">
            {links.map((k) => (
              <a key={k} href={socials[k]} target="_blank" rel="noreferrer noopener" tabIndex={menu ? 0 : -1}>{SOCIAL_META[k].label}</a>
            ))}
          </div>
        )}
        <button className="fmenu-theme" tabIndex={menu ? 0 : -1} onClick={() => choose(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      <div className="ftheme" role="group" aria-label="Colour theme">
        <button className={theme === "dark" ? "on" : ""} onClick={() => choose("dark")} aria-pressed={theme === "dark"}>Dark</button>
        <button className={theme === "light" ? "on" : ""} onClick={() => choose("light")} aria-pressed={theme === "light"}>Light</button>
      </div>

      {links.length > 0 && (
        <nav className="fsocials" aria-label="Social links">
          {links.map((k) => (
            <a key={k} href={socials[k]} target="_blank" rel="noreferrer noopener">{SOCIAL_META[k].label}</a>
          ))}
        </nav>
      )}

      <div className="fbody">{children}</div>

      <button className={"ftop" + (showTop ? " show" : "")} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
      </button>
    </>
  );
}
