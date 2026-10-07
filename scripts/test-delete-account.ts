import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
process.env.REGISTRATION_EMAIL_PROVIDER = "resend";
process.env.RESEND_API_KEY = "test-only";
process.env.EMAIL_FROM = "sender@example.test";
process.env.AUTH_URL = "http://localhost:3000";
const { db, client } = await import("../src/server/db");
const s = await import("../src/server/db/schema");
const { appRouter } = await import("../src/server/api/root");
const { requestGoogleRegistration, confirmGoogleRegistration } =
  await import("../src/server/auth/google-registration");
const rollback = new Error("ROLLBACK_DELETE_TEST");
try {
  try {
    await db.transaction(async (tx) => {
      const adminId = crypto.randomUUID(),
        id = crypto.randomUUID();
      const email = `${id}@example.test`;
      await tx.insert(s.users).values([
        { id: adminId, email: `${adminId}@example.test`, role: "admin" },
        { id, email, role: "student" },
      ]);
      await tx.insert(s.students).values({ userId: id, studentNumber: id });
      await tx
        .insert(s.accounts)
        .values({
          userId: id,
          provider: "google",
          providerAccountId: id,
          type: "oidc",
        });
      await tx
        .insert(s.sessions)
        .values({
          userId: id,
          sessionToken: id,
          expires: new Date(Date.now() + 60000),
        });
      const [attendance] = await tx
        .insert(s.attendance)
        .values({
          studentId: id,
          date: "2026-10-07",
          status: "present",
          recordedById: adminId,
        })
        .returning();
      const [notification] = await tx
        .insert(s.notifications)
        .values({
          recipientId: id,
          attendanceId: attendance!.id,
          message: "test",
        })
        .returning();
      await tx
        .insert(s.emailLogs)
        .values({
          notificationId: notification!.id,
          toEmail: email,
          message: "test",
        });
      await tx
        .insert(s.smsLogs)
        .values({
          notificationId: notification!.id,
          toPhoneNumber: "+639000000000",
          status: "test",
        });
      const caller = (userId: string, role: "admin" | "student") =>
        appRouter.createCaller({
          db: tx as unknown as typeof db,
          session: { user: { id: userId, role }, expires: "2099-01-01" },
          headers: new Headers(),
        });
      await assert.rejects(
        caller(id, "student").admin.deleteUser({ id: adminId }),
        { code: "FORBIDDEN" },
      );
      await assert.rejects(
        caller(adminId, "admin").admin.deleteUser({ id: adminId }),
        { code: "BAD_REQUEST" },
      );
      await caller(adminId, "admin").admin.deleteUser({ id });
      assert.equal(
        await tx.query.users.findFirst({ where: eq(s.users.id, id) }),
        undefined,
      );
      assert.equal(
        await tx.query.accounts.findFirst({ where: eq(s.accounts.userId, id) }),
        undefined,
      );
      assert.equal(
        await tx.query.sessions.findFirst({ where: eq(s.sessions.userId, id) }),
        undefined,
      );
      assert.equal(
        await tx.query.students.findFirst({ where: eq(s.students.userId, id) }),
        undefined,
      );
      assert.equal(
        await tx.query.emailLogs.findFirst({
          where: eq(s.emailLogs.notificationId, notification!.id),
        }),
        undefined,
      );
      let link = "";
      assert.equal(
        await requestGoogleRegistration(
          { email, name: "Register again", googleId: id },
          tx,
          async (options) => {
            link = options.confirmationUrl;
            return "accepted";
          },
        ),
        "sent",
      );
      assert.equal(
        await confirmGoogleRegistration(
          new URL(link).searchParams.get("token")!,
          tx,
        ),
        "pending",
      );
      const fresh = await tx.query.users.findFirst({
        where: eq(s.users.email, email),
      });
      assert.ok(fresh);
      assert.notEqual(fresh.id, id);
      assert.equal(fresh.isActive, false);
      assert.equal(fresh.approvalPending, true);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Delete permissions, dependent-record cleanup and fresh Google registration passed. All test data rolled back; no emails sent.",
  );
} finally {
  await client.end();
}
