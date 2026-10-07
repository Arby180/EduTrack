import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// No real mail is sent; database changes are rolled back even on failure.
process.env.RESEND_API_KEY = "re_test_only";
process.env.EMAIL_FROM = "sender@example.test";
process.env.AUTH_URL = "http://localhost:3000";
const { db, client } = await import("../src/server/db");
const { users, students, googleRegistrations, accounts, classRooms } =
  await import("../src/server/db/schema");
const {
  requestGoogleRegistration,
  confirmGoogleRegistration,
  hasValidRegistration,
} = await import("../src/server/auth/google-registration");
const { appRouter } = await import("../src/server/api/root");
const rollback = new Error("ROLLBACK_REGISTRATION_TEST");
let checks = 0;
try {
  try {
    await db.transaction(async (tx) => {
      const marker = crypto.randomUUID();
      const identity = {
        email: `${marker}@example.test`,
        name: "Registration test",
        googleId: marker,
      };
      let link = "";
      let sent = 0;
      const send = async (options: { confirmationUrl: string }) => {
        link = options.confirmationUrl;
        sent++;
        return "accepted" as const;
      };
      assert.equal(await requestGoogleRegistration(identity, tx, send), "sent");
      assert.equal(
        await tx.query.users.findFirst({
          where: eq(users.email, identity.email),
        }),
        undefined,
      );
      const token = new URL(link).searchParams.get("token")!;
      const pending = await tx.query.googleRegistrations.findFirst({
        where: eq(googleRegistrations.email, identity.email),
      });
      assert.notEqual(pending?.tokenHash, token);
      assert.equal(await hasValidRegistration(token, tx), true);
      assert.equal(await requestGoogleRegistration(identity, tx, send), "wait");
      assert.equal(sent, 1);
      assert.equal(await confirmGoogleRegistration("bad-token", tx), "invalid");
      assert.equal(await confirmGoogleRegistration(token, tx), "pending");
      assert.equal(await confirmGoogleRegistration(token, tx), "invalid");
      assert.equal(await hasValidRegistration(token, tx), false);
      const user = await tx.query.users.findFirst({
        where: eq(users.email, identity.email),
      });
      assert.ok(user);
      assert.equal(user.role, "student");
      assert.equal(user.isActive, false);
      assert.equal(user.approvalPending, true);
      assert.equal(user.passwordHash, null);
      assert.ok(user.emailVerified);
      assert.ok(
        await tx.query.students.findFirst({
          where: eq(students.userId, user.id),
        }),
      );
      assert.equal(
        (
          await tx.query.accounts.findFirst({
            where: eq(accounts.providerAccountId, marker),
          })
        )?.userId,
        user.id,
      );
      checks += 18;

      const adminId = crypto.randomUUID();
      await tx.insert(users).values({
        id: adminId,
        email: `${adminId}@example.test`,
        role: "admin",
      });
      const caller = (role: "admin" | "student", id: string) =>
        appRouter.createCaller({
          db: tx as unknown as typeof db,
          session: {
            user: { id, role, email: identity.email },
            expires: "2099-01-01",
          },
          headers: new Headers(),
        });
      await assert.rejects(
        caller("student", user.id).admin.setActive({
          id: user.id,
          isActive: true,
        }),
        (e) => e instanceof TRPCError && e.code === "FORBIDDEN",
      );
      await assert.rejects(
        caller("admin", adminId).admin.setActive({
          id: user.id,
          isActive: true,
        }),
        (e) => e instanceof TRPCError && e.code === "BAD_REQUEST",
      );
      const [group] = await tx
        .insert(classRooms)
        .values({ name: "Registration test class" })
        .returning();
      assert.ok(group);
      await tx
        .update(students)
        .set({ studentNumber: marker, classRoomId: group.id })
        .where(eq(students.userId, user.id));
      await caller("admin", adminId).admin.setActive({
        id: user.id,
        isActive: true,
      });
      const approved = await tx.query.users.findFirst({
        where: eq(users.id, user.id),
      });
      assert.equal(approved?.isActive, true);
      assert.equal(approved?.approvalPending, false);
      checks += 5;

      const pendingAdminId = crypto.randomUUID();
      const pendingAdminEmail = `${pendingAdminId}@example.test`;
      await tx
        .insert(users)
        .values({
          id: pendingAdminId,
          email: pendingAdminEmail,
          role: "student",
          isActive: false,
          approvalPending: true,
        });
      await tx
        .insert(students)
        .values({
          userId: pendingAdminId,
          studentNumber: `PENDING-${pendingAdminId}`,
        });
      await caller("admin", adminId).admin.saveUser({
        id: pendingAdminId,
        name: "Pending administrator",
        email: pendingAdminEmail,
        role: "admin",
        classRoomId: null,
      });
      const assigned = await tx.query.users.findFirst({
        where: eq(users.id, pendingAdminId),
      });
      assert.equal(assigned?.role, "admin");
      assert.equal(assigned?.isActive, false);
      assert.equal(assigned?.approvalPending, true);
      assert.equal(
        await tx.query.students.findFirst({
          where: eq(students.userId, pendingAdminId),
        }),
        undefined,
      );
      await caller("admin", adminId).admin.setActive({
        id: pendingAdminId,
        isActive: true,
      });
      const approvedAdmin = await tx.query.users.findFirst({
        where: eq(users.id, pendingAdminId),
      });
      assert.equal(approvedAdmin?.isActive, true);
      assert.equal(approvedAdmin?.approvalPending, false);
      checks += 6;

      const expired = {
        ...identity,
        email: `expired-${marker}@example.test`,
        googleId: `expired-${marker}`,
      };
      await requestGoogleRegistration(expired, tx, send);
      const expiredToken = new URL(link).searchParams.get("token")!;
      await tx
        .update(googleRegistrations)
        .set({ expires: new Date(0) })
        .where(eq(googleRegistrations.email, expired.email));
      assert.equal(
        await confirmGoogleRegistration(expiredToken, tx),
        "invalid",
      );
      assert.equal(
        await tx.query.users.findFirst({
          where: eq(users.email, expired.email),
        }),
        undefined,
      );

      const failed = {
        ...identity,
        email: `failed-${marker}@example.test`,
        googleId: `failed-${marker}`,
      };
      assert.equal(
        await requestGoogleRegistration(failed, tx, async () => "failed"),
        "unavailable",
      );
      assert.equal(
        await tx.query.users.findFirst({
          where: eq(users.email, failed.email),
        }),
        undefined,
      );
      // Reissued links invalidate their predecessors.
      await tx
        .update(googleRegistrations)
        .set({ requestedAt: new Date(0) })
        .where(eq(googleRegistrations.email, expired.email));
      await requestGoogleRegistration(expired, tx, send);
      assert.equal(await hasValidRegistration(expiredToken, tx), false);
      const replacement = new URL(link).searchParams.get("token")!;
      assert.equal(await hasValidRegistration(replacement, tx), true);
      // An admin-created account racing confirmation is never modified.
      await tx
        .insert(users)
        .values({ email: expired.email, role: "admin", isActive: false });
      assert.equal(
        await confirmGoogleRegistration(replacement, tx),
        "existing",
      );
      const existing = await tx.query.users.findFirst({
        where: eq(users.email, expired.email),
      });
      assert.equal(existing?.role, "admin");
      assert.equal(existing?.isActive, false);
      checks += 9;
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    `${checks} Google registration checks passed. All test data rolled back; no email sent.`,
  );
} finally {
  await client.end();
}
