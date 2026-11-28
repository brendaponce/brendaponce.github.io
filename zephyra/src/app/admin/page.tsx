import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { emptySocials } from "@/lib/socials";
import { getStore, storageProblem, toPhoto } from "@/lib/store";
import AdminClient from "./AdminClient";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nectar · Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const loggedIn = await isAdmin();
  const problem = storageProblem();
  const store = getStore();
  const photos = loggedIn && !problem ? (await store.list()).map((r) => toPhoto(store, r)) : [];
  const socials = loggedIn && !problem ? (await store.getSettings()).socials : emptySocials();

  if (loggedIn && !problem) return <AdminClient initial={photos} storage={store.kind} socials={socials} />;

  return (
    <main className="adm adm-center">
      <div className="adm-card">
        <Link href="/" className="adm-blogo big" aria-label="Brenda Ponce, home">
          <span className="s">Brenda</span>
          <span className="b">Ponce</span>
        </Link>
        {problem ? <p className="adm-alert">{problem}</p> : <LoginForm />}
      </div>
      <Link href="/" className="adm-back">← Back to site</Link>
    </main>
  );
}
