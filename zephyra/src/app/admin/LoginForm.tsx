"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
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
      if (res.ok) router.refresh();
      else setError(res.status === 401 ? "Wrong password" : "Something went wrong");
    } catch {
      setError("Could not reach the server");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <h2>Log in</h2>
      <input className="field" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      <button className="btn" type="submit" disabled={busy || !password}>{busy ? "…" : "Enter"}</button>
      {error && <p className="msg err">{error}</p>}
    </form>
  );
}
