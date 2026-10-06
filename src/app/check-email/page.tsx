import Link from "next/link";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow">EDUTRACK REGISTRATION</p>
        <h1>Check your email.</h1>
        <p className="muted mt-5">
          {status === "wait"
            ? "You recently requested a confirmation email. Check your inbox and spam folder. Wait one minute before trying again."
            : "We sent a confirmation link to the Google email you selected. Check your inbox and spam folder."}
        </p>
        <p className="muted mt-5">
          Confirm your email to create your student account. A school
          administrator must approve it before you can sign in. Links expire
          after 30 minutes; requesting another email replaces the previous link.
        </p>
        <Link className="btn secondary mt-5" href="/login">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
