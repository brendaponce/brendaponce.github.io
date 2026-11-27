import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { getStore, storageProblem, toPhoto } from "@/lib/store";
import AdminClient from "./AdminClient";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Zephyra · Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const loggedIn = await isAdmin();
  const problem = storageProblem();
  const store = getStore();
  const photos = loggedIn && !problem ? (await store.list()).map((r) => toPhoto(store, r)) : [];
  return (
    <>
      <header className="head">
        <Link href="/" className="logo">ZEPHYRA</Link>
      </header>
      <div className="panel">
        {!loggedIn ? <LoginForm /> : problem ? <p className="msg err">{problem}</p> : <AdminClient initial={photos} />}
      </div>
    </>
  );
}
