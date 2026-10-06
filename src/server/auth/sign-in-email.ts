type SignInEmailOptions = {
  apiKey?: string;
  from?: string;
  email: string;
  confirmationUrl: string;
  fetcher?: typeof fetch;
};

// Called only after Google verifies the identity of a new registration.
export async function sendRegistrationEmail({
  apiKey,
  from,
  email,
  confirmationUrl,
  fetcher = fetch,
}: SignInEmailOptions): Promise<"accepted" | "disabled" | "failed"> {
  if (!apiKey || !from) return "disabled";
  const safeUrl = confirmationUrl.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `google-registration/${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        from: `EduTrack <${from}>`,
        to: [email],
        subject: "Confirm your EduTrack account",
        html: `<!doctype html><html><body style="margin:0;background:#f3f7f5;font-family:Arial,sans-serif;color:#123c3a;padding:32px 16px">
          <table role="presentation" style="width:100%;max-width:560px;margin:auto;background:#ffffff;border:1px solid #dce7e3;border-radius:16px"><tr><td style="padding:36px">
            <p style="font-size:24px;font-weight:bold;margin:0 0 28px">EduTrack<span style="color:#d7a844">.</span></p>
            <h1 style="font-size:26px;line-height:1.3">Confirm your student account</h1>
            <p style="font-size:16px;line-height:1.6">You're one step closer. Use the button below to open EduTrack, then select <strong>Confirm my account</strong>.</p>
            <table role="presentation" style="margin:28px 0"><tr><td style="background:#196d62;border-radius:8px;text-align:center"><a href="${safeUrl}" style="display:inline-block;padding:16px 28px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold">Confirm my account</a></td></tr></table>
            <p style="font-size:14px;line-height:1.6">This link expires in 30 minutes. After confirmation, your account will appear for your school administrator to approve. Once approved, use <strong>Continue with Google</strong> to sign in.</p>
            <p style="font-size:13px;color:#657a76;line-height:1.6">If the button doesn't work, copy this link into your browser:<br><a href="${safeUrl}" style="color:#196d62;word-break:break-all">${safeUrl}</a></p>
            <p style="font-size:13px;color:#657a76">Didn't request this account? You can ignore this email.</p>
          </td></tr></table></body></html>`,
        text: [
          "You requested an EduTrack student account using Google.",
          "Open the link below, then select Confirm my account. The link expires in 30 minutes and can be used once.",
          confirmationUrl,
          "Your account will be created after confirmation. A school administrator must approve it before you can sign in.",
          "If you did not request this account, ignore this email.",
          "EduTrack",
        ].join("\n\n"),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.warn(
        "Google sign-in email was rejected by the email provider.",
        response.status,
      );
      return "failed";
    }
    return "accepted";
  } catch {
    // Do not log provider responses, tokens, email addresses, or request details.
    console.warn("Google sign-in email could not be sent.");
    return "failed";
  }
}
