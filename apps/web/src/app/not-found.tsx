import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="error-panel">
        <h1>That screening isn’t on our list.</h1>
        <Link className="button button-primary" href="/">Back to films</Link>
      </section>
    </main>
  );
}
