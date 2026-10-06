import assert from "node:assert/strict";
import { authConfig } from "../src/server/auth/config";
import { client, db } from "../src/server/db";

// Read-only checks: no OAuth exchange, account writes, or emails.
try {
  const records = await db.query.users.findMany();
  let checked = 0;
  for (const record of records) {
    const allowed =
      record.isActive &&
      !record.approvalPending &&
      (record.role === "admin" || record.role === "student");
    const result = await authConfig.callbacks.signIn({
      user: { id: record.id, email: record.email },
      account: {
        provider: "google",
        type: "oidc",
        providerAccountId: "read-only-auth-test",
      },
      profile: { email: record.email, email_verified: true },
    });
    assert.equal(
      result,
      record.approvalPending ? "/login?error=ApprovalPending" : record.isActive,
    );
    const token = await authConfig.callbacks.jwt({
      token: {
        id: record.id,
        role: record.role === "admin" ? "student" : "admin",
      },
      user: {},
      account: null,
    });
    if (allowed) {
      assert.ok(token);
      assert.equal(token.id, record.id);
      assert.equal(
        token.role,
        record.role,
        "Database role must override an outdated token role",
      );
    } else assert.equal(token, null);
    checked++;
  }
  assert.equal(
    await authConfig.callbacks.signIn({
      user: {},
      account: {
        provider: "google",
        type: "oidc",
        providerAccountId: "read-only-auth-test",
      },
      profile: { email: records[0]!.email, email_verified: false },
    }),
    false,
  );
  console.log(
    `Verified ${checked} existing accounts: Google approval checks and current database roles. No records changed or emails sent.`,
  );
} finally {
  await client.end();
}
