import Link from "next/link";
import { redirect } from "next/navigation";
import {
  confirmGoogleRegistration,
  hasValidRegistration,
} from "~/server/auth/google-registration";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

async function confirm(form: FormData) {
  "use server";
  const token = form.get("token");
  let result = "invalid";
  if (typeof token === "string") {
    try {
      result = await confirmGoogleRegistration(token);
    } catch {
      result = "unavailable";
    }
  }
  if (result === "pending") redirect("/login?error=ApprovalPending");
  if (result === "existing") redirect("/login");
  redirect(`/confirm-account?result=${result}`);
}

export default async function ConfirmAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; result?: string }>;
}) {
  const { token, result } = await searchParams;
  const valid = token ? await hasValidRegistration(token) : false;
  const title =
    result === "pending"
      ? "Email confirmed."
      : valid
        ? "Confirm your account."
        : "Account confirmation";
  const message =
    result === "pending"
      ? "Your student account has been created and is now listed in the administrator's People page as Awaiting approval. After approval, choose Continue with Google on the login page. You do not have an EduTrack password unless your administrator sets one."
      : result === "existing"
        ? "An account already exists for this email. Sign in, or contact your school administrator if access is unavailable."
        : result === "unavailable"
          ? "Confirmation is temporarily unavailable. Please reopen the link in your email and try again."
          : valid
            ? "Create your EduTrack student account with the Google identity you verified. Administrator approval is required before access is granted."
            : "This confirmation link is invalid, expired, or already used. Return to sign in and select Continue with Google to check your account or request a new link.";
  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow">EDUTRACK REGISTRATION</p>
        <h1>{title}</h1>
        <p className="muted mt-5" role="status">
          {message}
        </p>
        {valid && (
          <form action={confirm} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <button className="btn">Confirm my account</button>
          </form>
        )}
        <Link className="btn secondary mt-5" href="/login">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
