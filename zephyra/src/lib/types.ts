/** A photo as stored (keys point at files in storage). */
export interface PhotoRecord {
  id: string;
  title: string;
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
  takenAt: string;
  width: number;
  height: number;
  fullUrl: string;
  thumbUrl: string;
}

export interface NewPhoto {
  title: string;
  takenAt: string;
  width: number;
  height: number;
}

/** Every storage backend implements this, so the rest of the app doesn't care which one is used. */
export interface Store {
  readonly kind: "local" | "supabase";
  list(): Promise<PhotoRecord[]>;
  add(meta: NewPhoto, full: Buffer, thumb: Buffer): Promise<PhotoRecord>;
  update(id: string, patch: { title: string }): Promise<PhotoRecord | null>;
  remove(id: string): Promise<boolean>;
  urlFor(key: string): string;
}
