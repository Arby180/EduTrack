"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>We could not load this page.</h1>
        <p className="muted my-5">
          Please try again. If the problem continues, ask your administrator to
          check the database connection.
        </p>
        <button className="btn" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
