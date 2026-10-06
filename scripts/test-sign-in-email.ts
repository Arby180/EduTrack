import assert from "node:assert/strict";
import { sendRegistrationEmail as sendSignInEmail } from "../src/server/auth/sign-in-email";

let calls = 0;
const fetcher: typeof fetch = async (_url, options) => {
  calls++;
  const body = JSON.parse(String(options?.body)) as {
    to: string[];
    text: string;
    html: string;
  };
  assert.deepEqual(body.to, ["student@example.com"]);
  assert.match(body.text, /administrator must approve/);
  assert.match(
    body.html,
    /<a href="https:\/\/edutrack.example\/confirm-account\?token=test"[^>]*>Confirm my account<\/a>/,
  );
  assert.match(body.html, /Continue with Google/);
  assert.match(
    body.text,
    /https:\/\/edutrack.example\/confirm-account\?token=test/,
  );
  return new Response('{"id":"test-only"}', { status: 200 });
};
const input = {
  email: "student@example.com",
  confirmationUrl: "https://edutrack.example/confirm-account?token=test",
  fetcher,
};
assert.equal(await sendSignInEmail(input), "disabled");
assert.equal(calls, 0);
const configured = { ...input, apiKey: "fake-key", from: "sender@example.com" };
assert.equal(await sendSignInEmail(configured), "accepted");
assert.equal(calls, 1);
assert.equal(
  await sendSignInEmail({
    ...configured,
    fetcher: async () => new Response(null, { status: 403 }),
  }),
  "failed",
);
assert.equal(
  await sendSignInEmail({
    ...configured,
    fetcher: async () => {
      throw new Error("timeout");
    },
  }),
  "failed",
);
console.log("Sign-in email checks passed; no real email sent.");
