import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { cleanSocials } from "./socials";
import type { NewPhoto, PhotoRecord, Settings, Store } from "./types";

/**
 * Development storage: files and a small JSON index in the `.data` folder.
 * It is NOT suitable for the live site (hosts like Vercel erase local files),
 * which is why production uses Supabase instead.
 */
export function createLocalStore(): Store {
  const root = process.env.DATA_DIR || path.join(process.cwd(), ".data");
  const filesDir = path.join(root, "files");
  const indexFile = path.join(root, "photos.json");
  const settingsFile = path.join(root, "settings.json");

  // Run read-modify-write operations one after another so two uploads can't clobber each other.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  async function readIndex(): Promise<PhotoRecord[]> {
    try {
      const items = JSON.parse(await fs.readFile(indexFile, "utf8")) as PhotoRecord[];
      return items.map((r) => ({ ...r, location: r.location ?? "" })); // older entries have no location
    } catch {
      return [];
    }
  }
  async function writeIndex(items: PhotoRecord[]) {
    await fs.mkdir(root, { recursive: true });
    const tmp = indexFile + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.rename(tmp, indexFile);
  }
  const byDate = (a: PhotoRecord, b: PhotoRecord) =>
    b.takenAt.localeCompare(a.takenAt) || b.createdAt.localeCompare(a.createdAt);

  return {
    kind: "local",
    list: async () => (await readIndex()).sort(byDate),
    add: (meta: NewPhoto, full: Buffer, thumb: Buffer) =>
      serial(async () => {
        const id = randomUUID();
        const rec: PhotoRecord = {
          id,
          ...meta,
          createdAt: new Date().toISOString(),
          fullKey: `${id}.jpg`,
          thumbKey: `${id}-thumb.jpg`,
        };
        await fs.mkdir(filesDir, { recursive: true });
        await fs.writeFile(path.join(filesDir, rec.fullKey), full);
        await fs.writeFile(path.join(filesDir, rec.thumbKey), thumb);
        await writeIndex([rec, ...(await readIndex())]);
        return rec;
      }),
    update: (id, patch) =>
      serial(async () => {
        const items = await readIndex();
        const rec = items.find((p) => p.id === id);
        if (!rec) return null;
        if (patch.title !== undefined) rec.title = patch.title;
        if (patch.location !== undefined) rec.location = patch.location;
        await writeIndex(items);
        return rec;
      }),
    remove: (id) =>
      serial(async () => {
        const items = await readIndex();
        const rec = items.find((p) => p.id === id);
        if (!rec) return false;
        await writeIndex(items.filter((p) => p.id !== id));
        await Promise.all(
          [rec.fullKey, rec.thumbKey].map((k) => fs.rm(path.join(filesDir, k), { force: true })),
        );
        return true;
      }),
    async getSettings(): Promise<Settings> {
      try {
        const raw = JSON.parse(await fs.readFile(settingsFile, "utf8")) as { socials?: Record<string, unknown> };
        return { socials: cleanSocials(raw.socials) };
      } catch {
        return { socials: cleanSocials(undefined) };
      }
    },
    saveSettings: (settings) =>
      serial(async () => {
        await fs.mkdir(root, { recursive: true });
        const tmp = settingsFile + ".tmp";
        await fs.writeFile(tmp, JSON.stringify(settings, null, 2));
        await fs.rename(tmp, settingsFile);
        return settings;
      }),
    urlFor: (key) => `/api/files/${key}`,
  };
}

/** Used by the file-serving route. Only plain file names made by this store are allowed. */
export async function readLocalFile(key: string): Promise<Buffer | null> {
  if (!/^[0-9a-f-]{36}(-thumb)?\.jpg$/.test(key)) return null;
  const root = process.env.DATA_DIR || path.join(process.cwd(), ".data");
  try {
    return await fs.readFile(path.join(root, "files", key));
  } catch {
    return null;
  }
}
