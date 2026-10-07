import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, client } from "../src/server/db";
import { users, students, accounts } from "../src/server/db/schema";
import { autoRegisterGoogle } from "../src/server/auth/auto-register-google";
import { appRouter } from "../src/server/api/root";

const rollback = new Error("ROLLBACK_AUTO_REGISTRATION");
try {
  try {
    await db.transaction(async (tx) => {
      const marker = crypto.randomUUID();
      const identity = {
        email: `${marker}@example.test`,
        name: "New student",
        googleId: marker,
      };
      const user = await autoRegisterGoogle(identity, tx);
      assert.ok(user);
      assert.equal(user.role, "student");
      assert.equal(user.isActive, true);
      assert.equal(user.approvalPending, false);
      assert.ok(user.emailVerified);
      const student = await tx.query.students.findFirst({
        where: eq(students.userId, user.id),
      });
      assert.ok(student);
      assert.equal(student.classRoomId, null);
      assert.equal(
        (
          await tx.query.accounts.findFirst({
            where: eq(accounts.userId, user.id),
          })
        )?.providerAccountId,
        marker,
      );
      assert.equal((await autoRegisterGoogle(identity, tx))?.id, user.id);
      const caller = appRouter.createCaller({
        db: tx as unknown as typeof db,
        session: {
          user: { id: user.id, role: "student", email: user.email },
          expires: new Date(Date.now() + 60000).toISOString(),
        },
        headers: new Headers(),
      });
      const report = await caller.report.overview({
        from: "2026-01-01",
        to: "2026-12-31",
      });
      assert.ok(report);
      assert.deepEqual(report.roster.map((row) => row.id), [user.id]);
      assert.equal(report.attendanceRows.length, 0);
      assert.equal(report.gradeRows.length, 0);
      await assert.rejects(caller.admin.listUsers(), { code: "FORBIDDEN" });
      await tx
        .update(users)
        .set({ role: "admin", isActive: false })
        .where(eq(users.id, user.id));
      const existing = await autoRegisterGoogle(identity, tx);
      assert.equal(existing?.role, "admin");
      assert.equal(existing?.isActive, false);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Automatic registration, duplicate prevention, unassigned dashboard, admin access denial and existing account protection passed. All data rolled back; no email sent.",
  );
} finally {
  await client.end();
}
