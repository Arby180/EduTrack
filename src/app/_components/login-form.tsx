"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
export function LoginForm({
  googleEnabled,
  initialError,
}: {
  googleEnabled: boolean;
  initialError?: string;
}) {
  const [error, setError] = useState(
    initialError === "ApprovalPending"
      ? "Your email is confirmed. Your account is awaiting school administrator approval."
      : initialError === "RegistrationEmailUnavailable"
        ? "We could not send your confirmation email. Please wait one minute and try again, or contact your administrator."
        : initialError
          ? "Sign-in was not completed. Please try again or contact your school administrator if your account is inactive."
          : "",
  );
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const email = form.get("email");
      const result = await signIn("credentials", {
        email: typeof email === "string" ? email.trim() : "",
        password: form.get("password"),
        redirect: false,
      });
      if (result?.error)
        setError(
          "Invalid email or password, or your account is inactive. Registered with Google? Use Continue with Google after administrator approval.",
        );
      else window.location.href = "/dashboard";
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form action={submit}>
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {googleEnabled && (
        <button
          className="btn secondary mt-4 w-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signIn("google", { callbackUrl: "/dashboard" }).catch(() => {
              setError("Google sign-in could not be started.");
              setBusy(false);
            });
          }}
        >
          Continue with Google
        </button>
      )}
      <p className="muted mt-5 text-xs leading-5">
        Use your school account, or register with Google. New Google accounts
        require email confirmation and administrator approval.
      </p>
    </>
  );
}
