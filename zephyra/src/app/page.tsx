import Link from "next/link";
import Gallery from "@/components/Gallery";
import { getStore, toPhoto } from "@/lib/store";

export const dynamic = "force-dynamic"; // always show the newest photos

export default async function Home() {
  const store = getStore();
  const photos = (await store.list()).map((r) => toPhoto(store, r));
  return (
    <>
      <header className="head">
        <h1 className="logo">ZEPHYRA</h1>
      </header>
      <main>{photos.length ? <Gallery photos={photos} /> : <p className="empty">No photographs yet</p>}</main>
      <footer className="foot">
        <Link href="/admin">Admin</Link>
      </footer>
    </>
  );
}
