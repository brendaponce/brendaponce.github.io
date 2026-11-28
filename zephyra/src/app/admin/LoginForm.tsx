"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setError(res.status === 401 ? "That password isn’t right. Try again." : "Something went wrong. Try again.");
    } catch {
      setError("Couldn’t reach the server.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="adm-form">
      <h1 className="adm-title">Sign in</h1>
      <p className="adm-sub">Enter your password to manage your photos.</p>
      <label className="adm-label" htmlFor="pw">Password</label>
      <div className="adm-pw">
        <input
          id="pw"
          className="adm-input"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          aria-invalid={!!error}
          aria-describedby={error ? "pw-err" : undefined}
          autoFocus
        />
        <button type="button" className="adm-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p id="pw-err" className="adm-error" role="alert">{error}</p>}
      <button className="adm-btn primary block" type="submit" disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
