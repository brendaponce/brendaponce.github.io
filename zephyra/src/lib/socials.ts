import { SOCIAL_KEYS, type SocialKey, type Socials } from "./types";

export const SOCIAL_META: Record<SocialKey, { label: string; placeholder: string; hint: string }> = {
  instagram: { label: "Instagram", placeholder: "yourname or https://instagram.com/yourname", hint: "Your username or profile link" },
  tiktok: { label: "TikTok", placeholder: "yourname or https://tiktok.com/@yourname", hint: "Your username or profile link" },
  reddit: { label: "Reddit", placeholder: "u/yourname, r/yourcommunity or a link", hint: "A user (u/name), community (r/name) or link" },
  substack: { label: "Substack", placeholder: "yourname or https://yourname.substack.com", hint: "Your publication name or link" },
};

export const emptySocials = (): Socials => ({ instagram: "", tiktok: "", reddit: "", substack: "" });

const HANDLE = /^[A-Za-z0-9._-]{1,60}$/;

/**
 * Turns what the owner typed (a username or a link) into a full web address.
 * Returns "" for an empty value and null when the value isn't usable.
 */
export function normalizeSocial(key: SocialKey, input: string): string | null {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.length > 200) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null; // javascript:, mailto:, … are not allowed

  const bare = raw.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  switch (key) {
    case "instagram":
      return HANDLE.test(bare) ? `https://www.instagram.com/${bare}` : null;
    case "tiktok":
      return HANDLE.test(bare) ? `https://www.tiktok.com/@${bare}` : null;
    case "reddit": {
      const sub = /^r\/([A-Za-z0-9_]{2,40})$/.exec(bare);
      if (sub) return `https://www.reddit.com/r/${sub[1]}`;
      const user = bare.replace(/^u\//, "");
      return HANDLE.test(user) ? `https://www.reddit.com/user/${user}` : null;
    }
    case "substack":
      if (/^[A-Za-z0-9-]+\.substack\.com$/i.test(bare)) return `https://${bare}`;
      return /^[A-Za-z0-9-]{1,60}$/.test(bare) ? `https://${bare}.substack.com` : null;
  }
}

export const cleanSocials = (v: Partial<Record<string, unknown>> | undefined): Socials => {
  const out = emptySocials();
  for (const k of SOCIAL_KEYS) out[k] = typeof v?.[k] === "string" ? (v[k] as string) : "";
  return out;
};
