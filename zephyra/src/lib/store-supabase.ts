import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { NewPhoto, PhotoRecord, Store } from "./types";

const BUCKET = "photos";

interface Row {
  id: string;
  title: string;
  taken_at: string;
  created_at: string;
  width: number;
  height: number;
  full_path: string;
  thumb_path: string;
}
const fromRow = (r: Row): PhotoRecord => ({
  id: r.id,
  title: r.title,
  takenAt: r.taken_at,
  createdAt: r.created_at,
  width: r.width,
  height: r.height,
  fullKey: r.full_path,
  thumbKey: r.thumb_path,
});

/** Live-site storage: photo files in a Supabase Storage bucket, details in a Postgres table. */
export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = () => db.storage.from(BUCKET);

  return {
    kind: "supabase",
    async list() {
      const { data, error } = await db
        .from("photos")
        .select("*")
        .order("taken_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Row[]).map(fromRow);
    },
    async add(meta: NewPhoto, full: Buffer, thumb: Buffer) {
      const id = randomUUID();
      const fullKey = `${id}.jpg`;
      const thumbKey = `${id}-thumb.jpg`;
      const opts = { contentType: "image/jpeg", cacheControl: "31536000", upsert: false };
      const up1 = await bucket().upload(fullKey, full, opts);
      if (up1.error) throw new Error(up1.error.message);
      const up2 = await bucket().upload(thumbKey, thumb, opts);
      if (up2.error) {
        await bucket().remove([fullKey]);
        throw new Error(up2.error.message);
      }
      const { data, error } = await db
        .from("photos")
        .insert({
          id,
          title: meta.title,
          taken_at: meta.takenAt,
          width: meta.width,
          height: meta.height,
          full_path: fullKey,
          thumb_path: thumbKey,
        })
        .select("*")
        .single();
      if (error) {
        await bucket().remove([fullKey, thumbKey]);
        throw new Error(error.message);
      }
      return fromRow(data as Row);
    },
    async update(id, patch) {
      const { data, error } = await db.from("photos").update({ title: patch.title }).eq("id", id).select("*");
      if (error) throw new Error(error.message);
      return data && data.length ? fromRow(data[0] as Row) : null;
    },
    async remove(id) {
      const { data, error } = await db.from("photos").delete().eq("id", id).select("*");
      if (error) throw new Error(error.message);
      if (!data || !data.length) return false;
      const r = data[0] as Row;
      await bucket().remove([r.full_path, r.thumb_path]);
      return true;
    },
    urlFor: (key) => bucket().getPublicUrl(key).data.publicUrl,
  };
}
