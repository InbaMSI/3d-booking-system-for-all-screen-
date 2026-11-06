"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="error-panel" role="alert">
        <p>We couldn’t load this part of the cinema.</p>
        <p>{error.message}</p>
        <button className="button button-outline" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}
