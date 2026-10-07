import assert from "node:assert/strict";
import { sendRegistrationEmail } from "../src/server/auth/sign-in-email";
const gmail = { clientId: "test-client", clientSecret: "test-secret", refreshToken: "test-refresh", sender: "sender@example.test" };
let calls = 0;
const fetcher: typeof fetch = async (url, options) => {
  calls++;
  if (String(url).includes("oauth2.googleapis.com")) {
    const body = options?.body as URLSearchParams;
    assert.equal(body.get("grant_type"), "refresh_token");
    return Response.json({ access_token: "test-access" });
  }
  assert.equal(String(url), "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  const { raw } = JSON.parse(String(options?.body)) as { raw: string };
  const mime = Buffer.from(raw, "base64url").toString();
  assert.match(mime, /From: EduTrack <sender@example.test>/);
  assert.match(mime, /To: student@example.test/);
  const htmlPart = mime.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1]!;
  const html = Buffer.from(htmlPart.split('\r\n--')[0]!, 'base64').toString();
  assert.match(html, />Confirm my account<\/a>/);
  assert.match(html, /https:\/\/example.test\/confirm-account\?token=test/);
  return Response.json({ id: "test-message" });
};
const input = { gmail, email: "student@example.test", confirmationUrl: "https://example.test/confirm-account?token=test", fetcher };
assert.equal(await sendRegistrationEmail(input), "accepted");
assert.equal(calls, 2);
assert.equal(await sendRegistrationEmail({ ...input, fetcher: async () => new Response(null, { status: 401 }) }), "failed");
assert.equal(await sendRegistrationEmail({ ...input, fetcher: async () => Response.json({}) }), "failed");
assert.equal(await sendRegistrationEmail({ ...input, fetcher: async () => { throw Error("timeout"); } }), "failed");
assert.equal(await sendRegistrationEmail({ ...input, email: "bad\r\nBcc: injected@example.test" }), "failed");
assert.equal(calls, 2);
console.log("Gmail MIME button, OAuth refresh, rejection, timeout and header injection tests passed; no email sent.");
