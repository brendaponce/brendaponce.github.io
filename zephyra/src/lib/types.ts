/** A photo as stored (keys point at files in storage). */
export interface PhotoRecord {
  id: string;
  title: string;
  location: string; // where it was taken, e.g. "Lisbon, Portugal" ('' if not set)
  takenAt: string; // ISO date the photo was taken (or file date)
  createdAt: string; // ISO date it was added to the site
  width: number;
  height: number;
  fullKey: string; // large, sharp version
  thumbKey: string; // smaller version used on the wall
}

/** A photo as the browser sees it (keys turned into URLs). */
export interface Photo {
  id: string;
  title: string;
  location: string;
  takenAt: string;
  width: number;
  height: number;
  fullUrl: string;
  thumbUrl: string;
}

export interface NewPhoto {
  title: string;
  location: string;
  takenAt: string;
  width: number;
  height: number;
}

/** Social links the owner can set in admin. A value is a full web address, or "" when not set. */
export const SOCIAL_KEYS = ["instagram", "tiktok", "reddit", "substack"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];
export type Socials = Record<SocialKey, string>;
export interface Settings {
  socials: Socials;
}

/** Every storage backend implements this, so the rest of the app doesn't care which one is used. */
export interface Store {
  readonly kind: "local" | "supabase";
  list(): Promise<PhotoRecord[]>;
  add(meta: NewPhoto, full: Buffer, thumb: Buffer): Promise<PhotoRecord>;
  update(id: string, patch: { title?: string; location?: string }): Promise<PhotoRecord | null>;
  remove(id: string): Promise<boolean>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  urlFor(key: string): string;
}
