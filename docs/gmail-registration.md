# Gmail API confirmation emails

This provider sends registration confirmations only. Guardian notifications still use Resend.
New Google users receive a Confirm my account email button. The link opens a confirmation page; its explicit submit protects against email scanners consuming the link. Confirmation returns to login with an awaiting-approval message. An administrator chooses Student or Admin in People, saves, then approves access. No session is issued before approval.

## Authorize the dedicated sender

1. Create a separate Google Cloud project for EduTrack mail and enable **Gmail API** in APIs & Services > Library. Keep the existing student-login OAuth client unchanged.
2. Configure Google Auth Platform branding and an External audience. During testing, add only the dedicated EduTrack Gmail sender as a test user.
3. Add the scope `https://www.googleapis.com/auth/gmail.send` under Data Access. It permits sending, not reading inboxes.
4. Create a Web application OAuth client. Add this authorized redirect URI: `https://developers.google.com/oauthplayground`.
5. Open Google's OAuth Playground. In its settings, enable **Use your own OAuth credentials** and enter this new client's ID and secret. Use offline access and consent prompting.
6. Enter the `gmail.send` scope above, select Authorize APIs, sign in as the dedicated EduTrack Gmail account, and grant sending permission.
7. Exchange the authorization code for tokens. Store the **refresh token** privately, not the short-lived access token. Do not share screenshots containing either token or the client secret.

## Environment settings

Set these in local `.env` and Vercel's Production environment:

```dotenv
REGISTRATION_EMAIL_PROVIDER="gmail"
GMAIL_CLIENT_ID="your-mail-client-id"
GMAIL_CLIENT_SECRET="your-mail-client-secret"
GMAIL_REFRESH_TOKEN="your-sender-refresh-token"
GMAIL_SENDER="your-dedicated-account@gmail.com"
```

Keep production `AUTH_URL=https://edu-track-sepia.vercel.app` and the existing `AUTH_GOOGLE_*` login credentials. Restart locally and redeploy Vercel after configuration. EMAIL_FROM remains the Resend guardian sender; Gmail uses GMAIL_SENDER. Gmail mode fails closed if configuration is missing or authorization fails; it does not silently fall back to Resend.

Test registration using a new Google identity, open the confirmation email, confirm, and verify dashboard access remains denied. Approve from a separate admin session, then sign in again to verify the assigned role. Gmail acceptance does not guarantee inbox delivery; check spam and the sender's Sent folder.

## Google limits

External OAuth projects in Testing issue Gmail refresh tokens that expire after seven days. This setup is suitable for an initial test; plan the project's publishing status and any applicable verification before relying on unattended delivery. Using your own Playground credentials avoids the Playground's separate temporary-token revocation but does not remove Google's Testing expiration. Gmail sending limits still apply. Only the sender authorizes gmail.send; students continue using ordinary Google sign-in.

References: [OAuth Playground](https://developers.google.com/oauthplayground/), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2), [Sending MIME messages](https://developers.google.com/workspace/gmail/api/guides/sending).
