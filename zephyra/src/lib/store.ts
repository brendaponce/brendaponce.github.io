import { createLocalStore } from "./store-local";
import { createSupabaseStore } from "./store-supabase";
import type { Photo, PhotoRecord, Store } from "./types";

let cached: Store | null = null;

/** Supabase when its keys are set, otherwise the local `.data` folder. */
export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createSupabaseStore(url, key) : createLocalStore();
  return cached;
}

/** Local storage only works on your own computer, not on a hosting service. */
export function storageProblem(): string | null {
  const store = getStore();
  if (store.kind === "local" && process.env.NODE_ENV === "production" && process.env.VERCEL) {
    return "Online storage is not set up yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your hosting settings (see README).";
  }
  return null;
}

export function toPhoto(store: Store, r: PhotoRecord): Photo {
  return {
    id: r.id,
    title: r.title,
    takenAt: r.takenAt,
    width: r.width,
    height: r.height,
    fullUrl: store.urlFor(r.fullKey),
    thumbUrl: store.urlFor(r.thumbKey),
  };
}
