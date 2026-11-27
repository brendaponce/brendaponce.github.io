"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepare } from "@/lib/resize";
import type { Photo } from "@/lib/types";

interface QueueItem {
  key: number;
  name: string;
  status: "waiting" | "working" | "done" | "fail";
  note?: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function AdminClient({ initial }: { initial: Photo[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const patch = (key: number, p: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function addFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return setMsg("Those are not images.");
    setMsg("");
    const items = files.map((f) => ({ key: ++counter.current, name: f.name, status: "waiting" as const }));
    setQueue((q) => [...items, ...q]);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const key = items[i].key;
      patch(key, { status: "working" });
      try {
        const prep = await prepare(f);
        const form = new FormData();
        form.append("full", prep.full, "full.jpg");
        form.append("thumb", prep.thumb, "thumb.jpg");
        form.append("width", String(prep.width));
        form.append("height", String(prep.height));
        form.append("title", f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
        form.append("takenAt", new Date(f.lastModified || Date.now()).toISOString());
        const res = await fetch("/api/photos", { method: "POST", body: form });
        if (res.status === 401) {
          router.refresh();
          throw new Error("Logged out — log in again");
        }
        if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Upload failed");
        const photo = (await res.json()) as Photo;
        setPhotos((p) => [photo, ...p].sort((a, b) => b.takenAt.localeCompare(a.takenAt)));
        patch(key, { status: "done" });
      } catch (e) {
        patch(key, { status: "fail", note: e instanceof Error ? e.message : "Failed" });
      }
    }
    router.refresh();
  }

  async function rename(p: Photo, title: string) {
    const t = title.trim().slice(0, 80);
    if (t === p.title) return;
    const res = await fetch(`/api/photos/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) });
    if (res.ok) setPhotos((l) => l.map((x) => (x.id === p.id ? { ...x, title: t } : x)));
    else setMsg("Could not save that title.");
  }

  async function remove(p: Photo) {
    if (!confirm(`Delete “${p.title || "this photo"}” for good?`)) return;
    const res = await fetch(`/api/photos/${p.id}`, { method: "DELETE" });
    if (res.ok) setPhotos((l) => l.filter((x) => x.id !== p.id));
    else setMsg("Could not delete that photo.");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <>
      <div className="bar">
        <h2 style={{ margin: 0 }}>Add photos</h2>
        <button className="btn" onClick={logout}>Log out</button>
      </div>
      <div
        className={"drop" + (over ? " over" : "")}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
      >
        Drop photos here or click to choose
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      {msg && <p className="msg err">{msg}</p>}
      {queue.length > 0 && (
        <ul className="queue">
          {queue.map((it) => (
            <li key={it.key} className={it.status}>
              <span>{it.name}</span>
              <span>{it.status === "fail" ? it.note : it.status === "done" ? "Added" : it.status === "working" ? "Uploading…" : "Waiting"}</span>
            </li>
          ))}
        </ul>
      )}
      <h2>On the site · {photos.length}</h2>
      <ul className="rows">
        {photos.map((p) => (
          <li className="row" key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl} alt="" />
            <input defaultValue={p.title} maxLength={80} placeholder="Add a title" aria-label="Title" onBlur={(e) => rename(p, e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
            <span className="d">{fmt(p.takenAt)}</span>
            <button onClick={() => remove(p)} aria-label="Delete photo">✕</button>
          </li>
        ))}
      </ul>
    </>
  );
}
