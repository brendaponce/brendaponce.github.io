"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepare } from "@/lib/resize";
import SocialsForm from "./SocialsForm";
import type { Photo, Socials } from "@/lib/types";

interface QueueItem {
  key: number;
  name: string;
  status: "waiting" | "working" | "done" | "fail";
  note?: string;
}
interface Toast {
  id: number;
  text: string;
  kind: "ok" | "err";
}
/** A photo picked for upload but not yet sent. `folder` is the name of the folder it came from ("" if loose). */
interface Staged {
  id: number;
  file: File;
  url: string;
  folder: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const IMAGE = /\.(jpe?g|png|webp|gif|avif|heic)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE.test(f.name);

/** "Lisbon_Portugal" → "Lisbon Portugal". Only tidies separators; the owner can edit the result in the review step. */
const prettyPlace = (folder: string) => folder.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

/** Reads a dropped folder (and any folders inside it). Each file remembers the folder it sits directly in. */
async function walk(entry: FileSystemEntry, dir: string, out: { file: File; folder: string }[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ file, folder: dir });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      // readEntries hands back results in batches until it returns an empty one
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const child of batch) await walk(child, entry.name, out);
    }
  }
}

export default function AdminClient({ initial, storage, socials }: { initial: Photo[]; storage: "local" | "supabase"; socials: Socials }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [over, setOver] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({}); // folder name → location text
  const [reading, setReading] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const say = (text: string, kind: Toast["kind"] = "ok") => setToast({ id: ++counter.current, text, kind });
  const reviewing = staged.length > 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!confirm && !reviewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || deleting) return;
      if (confirm) setConfirm(null);
      else cancelReview();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, reviewing, deleting]);

  const patchQueue = (key: number, p: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...p } : it)));

  /** Put picked photos into the review step (nothing is uploaded yet). */
  function stage(picked: { file: File; folder: string }[]) {
    const ok = picked.filter((p) => isImage(p.file));
    const skipped = picked.length - ok.length;
    if (!ok.length) return say("No photos found in that selection.", "err");
    if (skipped) say(`${skipped} file${skipped === 1 ? "" : "s"} skipped (not photos).`, "err");
    ok.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
    setStaged((cur) => [...cur, ...ok.map((p) => ({ id: ++counter.current, file: p.file, url: URL.createObjectURL(p.file), folder: p.folder }))]);
    setLabels((cur) => {
      const next = { ...cur };
      for (const p of ok) if (!(p.folder in next)) next[p.folder] = prettyPlace(p.folder);
      return next;
    });
  }

  function cancelReview() {
    staged.forEach((s) => URL.revokeObjectURL(s.url));
    setStaged([]);
    setLabels({});
  }

  function removeStaged(id: number) {
    setStaged((cur) => {
      const gone = cur.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return cur.filter((s) => s.id !== id);
    });
  }

  function fromFileList(list: FileList) {
    stage(
      [...list].map((file) => {
        // For a picked folder the browser gives "Folder/sub/photo.jpg"; the folder a photo sits in is its parent.
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
        const parts = rel.split("/");
        return { file, folder: parts.length > 1 ? parts[parts.length - 2] : "" };
      }),
    );
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    // Entries must be grabbed right now; the browser clears them once we await.
    const entries = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter((x): x is FileSystemEntry => !!x);
    const loose = [...e.dataTransfer.files];
    if (!entries.length) return fromFileList(e.dataTransfer.files);
    setReading(true);
    try {
      const out: { file: File; folder: string }[] = [];
      for (const entry of entries) await walk(entry, "", out);
      stage(out.length ? out : loose.map((file) => ({ file, folder: "" })));
    } catch {
      say("Couldn’t read that folder.", "err");
    }
    setReading(false);
  }

  /** The confirmed upload: sends each staged photo with the (possibly edited) location. */
  async function upload() {
    const list = staged;
    const where = labels;
    setStaged([]);
    setLabels({});
    const items = list.map((s) => ({ key: ++counter.current, name: s.file.name, status: "waiting" as const }));
    setQueue((q) => [...items, ...q]);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const key = items[i].key;
      patchQueue(key, { status: "working" });
      try {
        const prep = await prepare(s.file);
        const form = new FormData();
        form.append("full", prep.full, "full.jpg");
        form.append("thumb", prep.thumb, "thumb.jpg");
        form.append("width", String(prep.width));
        form.append("height", String(prep.height));
        form.append("title", s.file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
        form.append("location", (where[s.folder] ?? "").trim());
        form.append("takenAt", new Date(s.file.lastModified || Date.now()).toISOString());
        const res = await fetch("/api/photos", { method: "POST", body: form });
        if (res.status === 401) {
          router.refresh();
          throw new Error("You were signed out");
        }
        if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Upload failed");
        const photo = (await res.json()) as Photo;
        setPhotos((p) => [photo, ...p].sort((a, b) => b.takenAt.localeCompare(a.takenAt)));
        patchQueue(key, { status: "done" });
        ok++;
      } catch (e) {
        patchQueue(key, { status: "fail", note: e instanceof Error ? e.message : "Failed" });
      } finally {
        URL.revokeObjectURL(s.url);
      }
    }
    if (ok) say(ok === 1 ? "1 photo added" : `${ok} photos added`);
    router.refresh();
  }

  async function save(p: Photo, field: "title" | "location", value: string) {
    const v = value.trim().slice(0, 80);
    if (v === p[field]) return;
    const res = await fetch(`/api/photos/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: v }) });
    if (res.ok) {
      setPhotos((l) => l.map((x) => (x.id === p.id ? { ...x, [field]: v } : x)));
      setSaved(p.id);
      setTimeout(() => setSaved((s) => (s === p.id ? null : s)), 1500);
    } else say(`Couldn’t save that ${field}.`, "err");
  }

  async function remove() {
    if (!confirm) return;
    setDeleting(true);
    const res = await fetch(`/api/photos/${confirm.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setPhotos((l) => l.filter((x) => x.id !== confirm.id));
      say("Photo deleted");
    } else say("Couldn’t delete that photo.", "err");
    setConfirm(null);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  // Review groups: one per folder, in the order they were picked.
  const groups = useMemo(() => {
    const map = new Map<string, Staged[]>();
    for (const s of staged) map.set(s.folder, [...(map.get(s.folder) ?? []), s]);
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }, [staged]);
  const unlabeled = groups.filter((g) => !(labels[g.name] ?? "").trim()).reduce((n, g) => n + g.items.length, 0);

  const active = queue.filter((q) => q.status === "waiting" || q.status === "working").length;
  const finished = queue.length - active;

  return (
    <div className="adm">
      <header className="adm-top">
        <Link href="/" className="adm-blogo" aria-label="Brenda Ponce, home">
          <span className="s">Brenda</span>
          <span className="b">Ponce</span>
        </Link>
        <span className="adm-toptitle">Admin</span>
        <nav className="adm-nav">
          <Link href="/" target="_blank">View site ↗</Link>
          <button onClick={logout}>Sign out</button>
        </nav>
      </header>

      <main className="adm-main">
        <section className="adm-head">
          <div>
            <h1 className="adm-title">Photos</h1>
            <p className="adm-sub">
              {photos.length} {photos.length === 1 ? "photo" : "photos"} · stored {storage === "local" ? "on this computer" : "online"}
            </p>
          </div>
          <div className="adm-headbtns">
            <button className="adm-btn" onClick={() => folder.current?.click()}>Upload a folder</button>
            <button className="adm-btn primary" onClick={() => files.current?.click()}>+ Add photos</button>
          </div>
        </section>

        <div
          className={"adm-drop" + (over ? " over" : "")}
          role="button"
          tabIndex={0}
          onClick={() => files.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), files.current?.click())}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <span className="adm-drop-icon" aria-hidden>↑</span>
          <span className="adm-drop-main">{reading ? "Reading folder…" : over ? "Drop to review" : "Drag photos or a folder here, or click to browse"}</span>
          <span className="adm-drop-sub">A folder’s name becomes the location · you review everything before it uploads</span>
        </div>
        <input ref={files} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) fromFileList(e.target.files); e.target.value = ""; }} />
        <input
          ref={folder}
          type="file"
          multiple
          hidden
          {...({ webkitdirectory: "", directory: "" } as object)}
          onChange={(e) => { if (e.target.files) fromFileList(e.target.files); e.target.value = ""; }}
        />

        {queue.length > 0 && (
          <section className="adm-queue" aria-live="polite">
            <div className="adm-queue-head">
              <span>{active ? `Uploading ${active} left…` : "Uploads finished"}</span>
              {finished > 0 && <button className="adm-link" onClick={() => setQueue((q) => q.filter((i) => i.status === "waiting" || i.status === "working"))}>Clear finished</button>}
            </div>
            <ul>
              {queue.map((it) => (
                <li key={it.key} className={it.status}>
                  <span className="adm-q-name">{it.name}</span>
                  <span className="adm-q-state">
                    {it.status === "working" && <i className="adm-spin" aria-hidden />}
                    {it.status === "fail" ? it.note : it.status === "done" ? "Added ✓" : it.status === "working" ? "Uploading" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="adm-section">Social links</h2>
        <SocialsForm initial={socials} />

        <h2 className="adm-section">Library</h2>
        {photos.length === 0 ? (
          <div className="adm-empty">
            <p>No photos yet</p>
            <span>Add photos or a folder above and they’ll appear here.</span>
          </div>
        ) : (
          <ul className="adm-grid">
            {photos.map((p) => (
              <li className="adm-card-photo" key={p.id}>
                <a className="adm-thumb" href={p.fullUrl} target="_blank" rel="noreferrer" aria-label={`Open ${p.title || "photo"} full size`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.title || "Photograph"} loading="lazy" />
                </a>
                <button className="adm-del" onClick={() => setConfirm(p)} aria-label={`Delete ${p.title || "photo"}`} title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                </button>
                <div className="adm-meta">
                  <label className="adm-field">
                    <span>Location</span>
                    <input
                      defaultValue={p.location}
                      maxLength={80}
                      placeholder="Add a location"
                      onBlur={(e) => save(p, "location", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                  </label>
                  <label className="adm-field">
                    <span>Title</span>
                    <input
                      defaultValue={p.title}
                      maxLength={80}
                      placeholder="Add a title"
                      onBlur={(e) => save(p, "title", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                  </label>
                  <span className="adm-date">{saved === p.id ? "Saved ✓" : fmt(p.takenAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {reviewing && (
        <div className="adm-modal adm-review-wrap" role="presentation">
          <div className="adm-review" role="dialog" aria-modal="true" aria-labelledby="rv-t">
            <header className="adm-review-head">
              <div>
                <h2 id="rv-t">Review before uploading</h2>
                <p>{staged.length} photo{staged.length === 1 ? "" : "s"} in {groups.length} group{groups.length === 1 ? "" : "s"}. Check each location, edit it if it’s wrong, or remove photos you don’t want.</p>
              </div>
              <button className="adm-btn ghost" onClick={cancelReview}>Cancel</button>
            </header>

            <div className="adm-review-body">
              {groups.map((g) => {
                const label = labels[g.name] ?? "";
                return (
                  <section className="adm-group" key={g.name || "__loose"}>
                    <div className="adm-group-head">
                      <label className="adm-group-loc">
                        <span>Location for {g.items.length} photo{g.items.length === 1 ? "" : "s"}</span>
                        <input
                          className="adm-input"
                          value={label}
                          maxLength={80}
                          placeholder="Type a location (optional)"
                          onChange={(e) => setLabels((l) => ({ ...l, [g.name]: e.target.value }))}
                        />
                      </label>
                      <p className="adm-group-src">
                        {g.name ? <>From folder <b>“{g.name}”</b></> : <>Loose photos (not from a folder)</>}
                        {!label.trim() && <em> · will upload with no location</em>}
                      </p>
                    </div>
                    <ul className="adm-thumbs">
                      {g.items.map((s) => (
                        <li key={s.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.url} alt={s.file.name} loading="lazy" decoding="async" />
                          <button onClick={() => removeStaged(s.id)} aria-label={`Remove ${s.file.name}`} title="Remove">✕</button>
                          <span>{s.file.name}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <footer className="adm-review-foot">
              <span>{unlabeled > 0 ? `${unlabeled} photo${unlabeled === 1 ? "" : "s"} will have no location` : "All photos have a location"}</span>
              <div className="adm-actions">
                <button className="adm-btn ghost" onClick={cancelReview}>Cancel</button>
                <button className="adm-btn primary" onClick={upload}>Upload {staged.length} photo{staged.length === 1 ? "" : "s"}</button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {confirm && (
        <div className="adm-modal" role="presentation" onClick={(e) => e.target === e.currentTarget && !deleting && setConfirm(null)}>
          <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-t">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={confirm.thumbUrl} alt="" />
            <h3 id="del-t">Delete this photo?</h3>
            <p>“{confirm.title || "Untitled"}” will be removed from your site. This can’t be undone.</p>
            <div className="adm-actions">
              <button className="adm-btn ghost" onClick={() => setConfirm(null)} disabled={deleting} autoFocus>Cancel</button>
              <button className="adm-btn danger" onClick={remove} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.id} className={"adm-toast " + toast.kind} role="status">{toast.text}</div>
      )}
    </div>
  );
}
