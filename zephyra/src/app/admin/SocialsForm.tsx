"use client";

import { useState } from "react";
import { SOCIAL_META } from "@/lib/socials";
import { SOCIAL_KEYS, type SocialKey, type Socials } from "@/lib/types";

/** The social links shown down the side of the site. Usernames are turned into full links when saved. */
export default function SocialsForm({ initial }: { initial: Socials }) {
  const [saved, setSaved] = useState<Socials>(initial);
  const [values, setValues] = useState<Socials>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: SocialKey; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const dirty = SOCIAL_KEYS.some((k) => values[k].trim() !== saved[k]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ socials: values }) });
      const data = (await res.json().catch(() => null)) as { socials?: Socials; error?: string; field?: SocialKey } | null;
      if (res.ok && data?.socials) {
        setSaved(data.socials);
        setValues(data.socials); // shows the full links that were saved
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      } else {
        setError({ field: data?.field, text: data?.error ?? (res.status === 401 ? "You were signed out." : "Couldn’t save.") });
      }
    } catch {
      setError({ text: "Couldn’t reach the server." });
    }
    setBusy(false);
  }

  return (
    <form className="adm-socials" onSubmit={submit}>
      <div className="adm-socials-grid">
        {SOCIAL_KEYS.map((k) => (
          <label key={k} className="adm-sfield">
            <span>{SOCIAL_META[k].label}</span>
            <input
              className="adm-input"
              value={values[k]}
              maxLength={200}
              placeholder={SOCIAL_META[k].placeholder}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error?.field === k}
              onChange={(e) => {
                setValues((v) => ({ ...v, [k]: e.target.value }));
                setDone(false);
                if (error) setError(null);
              }}
            />
            <small>{SOCIAL_META[k].hint}. Leave empty to hide it.</small>
          </label>
        ))}
      </div>
      <div className="adm-socials-foot">
        <button className="adm-btn primary" type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : "Save links"}</button>
        {done && <span className="adm-ok">Saved ✓ · live on the site</span>}
        {error && <span className="adm-bad" role="alert">{error.text}</span>}
      </div>
    </form>
  );
}
