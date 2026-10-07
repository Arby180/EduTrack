# Google login and Twilio setup

The core school workflows work with the current email/password login and Supabase. Chart.js requires no API key. Google and Twilio credentials stay in the local `.env` or your deployment's server environment; never put them in `NEXT_PUBLIC_` variables.

## Google OAuth

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Configure the Google Auth Platform consent screen (branding, audience, and contact information). While testing, add your intended Google accounts as test users if required by your audience configuration.
3. Create an OAuth client with application type **Web application**.
4. Add `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Use the exact port where the app runs.
5. Copy the client ID and client secret into `.env`:

```dotenv
AUTH_GOOGLE_ID="your-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your-client-secret"
```

6. Restart the app. The login page now shows **Continue with Google**.
7. Existing active school accounts can sign in using their matching verified Google email. New Google users receive an email confirmation link. The `.test` demo emails cannot be used with Google.
8. New users confirm their email to create an inactive student account, then wait for administrator approval. In People, an admin assigns the student number and class and selects Approve access. Unverified, pending, and inactive accounts cannot sign in. Public registration never creates administrators.

For deployment, register `https://YOUR-DOMAIN/api/auth/callback/google`, configure the same server variables and a strong `AUTH_SECRET`, and set `AUTH_URL` to the deployed origin. Locally, use `AUTH_URL="http://localhost:3000"` (adjust the port if needed); this also allows authentication when using `npm run start`. Keep the localhost redirect while developing. Registering a callback in Supabase Auth is not necessary because NextAuth handles Google.

References: [Auth.js Google provider](https://authjs.dev/getting-started/providers/google), [Google web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).

## Google registration confirmation emails

For Gmail API delivery without an App Password or custom domain, follow [Gmail registration setup](gmail-registration.md). Set `REGISTRATION_EMAIL_PROVIDER=gmail` and the four `GMAIL_*` server variables described there. The Resend setup below is an alternative, not a requirement for Gmail registration delivery. Guardian emails continue to use Resend.

Google verifies the selected identity first. For a new email, EduTrack sends a confirmation link and shows Check your email. No school account or session is created yet. The email link opens a page with a **Confirm my account** button; the explicit submission prevents email scanners from creating accounts just by opening links.

Confirmation atomically consumes the link and creates an inactive student account and Google account link. Administrators see **Awaiting approval** in People. Edit the pending account to choose Student or Admin. For students, assign a real student number and class. Save, then select **Approve access**. Confirmation returns the user to login without creating a session. The student can then sign in with Google. Existing active accounts sign in normally; deactivated accounts remain blocked. No extra success-notification email is sent on routine logins.

1. Create a [Resend account](https://resend.com) using the Gmail address you will test with.
2. Create an API key with sending permission and save these server variables locally:

```dotenv
RESEND_API_KEY="your-resend-api-key"
EMAIL_FROM="onboarding@resend.dev"
AUTH_URL="http://localhost:3000"
```

3. The test sender only sends to your Resend account email. For other recipients, verify a domain you own and set EMAIL_FROM to an address on it. A personal Gmail address cannot be used as this sender.
4. Restart EduTrack. Test with a Google email that does not already have an EduTrack account. Check the inbox/spam folder, follow the link, and confirm the account.
5. Log in separately as an existing administrator, review the pending account in People, assign its student number and class, then approve access. Return to Google sign-in as the student.

Links expire after 30 minutes and can be consumed once. Only a SHA-256 hash is stored. Requests are limited to one email per address per minute; a replacement invalidates the previous link. Failed email requests show an error and never create an account. Requests time out after eight seconds without automatic retry; inspect Resend logs if delivery is uncertain. Expired pending requests can be replaced by another Google attempt.

AUTH_URL determines the confirmation link's origin. For deployment, set it to the real HTTPS domain. A localhost link must be opened on the computer running EduTrack, not a phone. Google OAuth audience/test-user restrictions also still apply. Keep API keys and confirmation links private.

Run `npm run test:registration` for rollback-only Supabase tests with mocked emails. No real messages are sent by the tests.

References: [Resend test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [send email API](https://resend.com/docs/api-reference/emails/send-email).

## Guardian email notifications (Resend)

Guardian emails reuse RESEND_API_KEY and EMAIL_FROM from registration. Twilio and Android apps are not required.

1. In People, edit a student, enter Guardian email, and record the guardian's agreement using the separate email-consent checkbox. SMS consent does not authorize email. Save the account.
2. Mark the student absent and save attendance, or prepare a school message in Notifications. Eligible guardian emails enter the review queue; student inbox notifications still work without guardian contact details.
3. In Notifications, review the guardian email and message, then choose Send email and confirm. This sends a real message using your Resend quota. Saving attendance alone never sends email.
4. Accepted means Resend accepted the request, not that it arrived. Use Refresh email status or Resend logs to inspect delivery. Status retrieval requires an API key with read/full access; sending-only keys may send but cannot retrieve status.

With onboarding@resend.dev, only the email registered to your Resend account can receive test mail. To email other guardians, verify a domain you own and set EMAIL_FROM to an address on it. Sending remains subject to Resend's plan limits. See [test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Repeated attendance saves do not duplicate the same email. Correcting an absence cancels pending/failed emails; already submitted messages cannot be recalled. Changing guardian email, withdrawing consent, or deactivating the student blocks sending previously prepared messages. Cancel those messages and prepare a new one if appropriate. The delivery log preserves the submitted message text even if attendance is later corrected.

Email requests are claimed atomically to prevent double sends. Timeouts or ambiguous failures are marked unknown, with no automatic retry. A process interruption can leave sending status; check Resend logs before preparing another message. No automatic delivery webhook or background sender is configured.

Run `npm run test:guardian-email` for rollback-only integration tests with simulated email requests. No real email is sent by the test suite.

## Twilio SMS (optional)

1. Create or sign in to your [Twilio Console](https://console.twilio.com/) account.
2. Obtain an SMS-capable Twilio number. Complete the sender requirements for that number and destination region. With a trial account, verify the recipient number as required by Twilio.
3. Copy the Account SID, Auth Token, and Twilio sender number into `.env`:

```dotenv
TWILIO_ACCOUNT_SID="AC followed by your account identifier"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_FROM_NUMBER="+your-Twilio-number"
```

The SID must be `AC` plus 32 hexadecimal characters. Phone numbers must use international E.164 format, such as `+639171234567`. The From number is your Twilio sender, not your personal phone.

4. Restart the app and open **Notifications** as admin. Twilio should show **configured**. This confirms the environment values are present, not that Twilio has accepted a message yet.
5. On **People**, enter a guardian number and record SMS consent for a test student.
6. Mark that student absent, or prepare a message in **Notifications**. A student inbox message and a pending guardian SMS are created. Without a number and consent, the message is inbox-only.
7. Review the recipient and message, then click **Send SMS**. This performs a real Twilio API request and may incur messaging charges. No message is sent just by configuring credentials.
8. Click **Refresh status** to retrieve the provider's latest result. `queued` and `sent` do not guarantee handset delivery; `delivered` is a separate status. This implementation uses on-demand refresh rather than a public status callback.

If a request times out, its status becomes `unknown`. It might already have reached Twilio, so the app prevents automatic resending; inspect the Twilio console first. If the server stops while sending, a row can remain `sending`; inspect Twilio before any manual recovery. Correcting an absence cancels pending or failed texts, but cannot recall messages already submitted.

References: [Twilio SMS quickstart](https://www.twilio.com/docs/messaging/quickstart), [message resource and delivery statuses](https://www.twilio.com/docs/messaging/api/message-resource), [test credentials](https://www.twilio.com/docs/messaging/tutorials/automate-testing).

## Demo sequence

1. Admin: create a class and subject.
2. Admin: add a student, class assignment, and guardian contact; share the initial password with the student through your normal school process.
3. Admin: select the class and today's date, mark attendance, and save. Save again to verify updates rather than duplicates.
4. Admin: add two assessments with different totals and review the subject's points-based average.
5. Student: sign in and view only their own attendance, grades, report, and inbox.
6. Admin: publish an announcement and verify it appears for the student.
7. Admin: export a report and, once Twilio is configured, review and send an authorized test text.

Teacher and parent portals remain removed as requested. Admins perform the original proposal's teacher duties, and guardians receive notifications without login accounts. Google registration creates student accounts only after email confirmation, with administrator approval required for access.
