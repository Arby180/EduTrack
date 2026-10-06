import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

process.env.RESEND_API_KEY = "re_mock_only";
process.env.EMAIL_FROM = "sender@example.test";
const originalFetch = globalThis.fetch;
let mode = "ok";
let sends = 0;
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith("https://api.resend.com/emails"));
  if (options?.method !== "POST" && mode === "restricted")
    return Response.json({ name: "restricted_api_key" }, { status: 401 });
  if (options?.method !== "POST")
    return Response.json({ last_event: "delivered" });
  sends++;
  if (mode === "timeout") throw new Error("Simulated timeout");
  if (mode === "reject") return new Response(null, { status: 403 });
  const body = JSON.parse(String(options.body)) as {
    to: string[];
    html: string;
  };
  assert.deepEqual(body.to, ["guardian@example.test"]);
  assert.ok(!body.html.includes("<script>"));
  return Response.json({ id: crypto.randomUUID() });
};
const { db, client } = await import("../src/server/db");
const { users, students, classRooms, emailLogs } =
  await import("../src/server/db/schema");
const { appRouter } = await import("../src/server/api/root");
const { schoolToday } = await import("../src/lib/school");
const rollback = new Error("ROLLBACK_EMAIL_TEST");
try {
  try {
    await db.transaction(async (tx) => {
      const adminId = crypto.randomUUID(),
        studentId = crypto.randomUUID();
      await tx.insert(users).values([
        { id: adminId, email: `${adminId}@example.test`, role: "admin" },
        {
          id: studentId,
          name: "Email test student",
          email: `${studentId}@example.test`,
          role: "student",
        },
      ]);
      const [group] = await tx
        .insert(classRooms)
        .values({ name: "Email test" })
        .returning();
      assert.ok(group);
      await tx.insert(students).values({
        userId: studentId,
        studentNumber: studentId,
        classRoomId: group.id,
        guardianEmail: "guardian@example.test",
        guardianEmailConsent: false,
      });
      const caller = (id: string, role: "admin" | "student") =>
        appRouter.createCaller({
          db: tx as unknown as typeof db,
          session: { user: { id, role }, expires: "2099-01-01" },
          headers: new Headers(),
        });
      const admin = caller(adminId, "admin"),
        student = caller(studentId, "student");
      const denied = (promise: Promise<unknown>, code: string) =>
        assert.rejects(
          promise,
          (e) => e instanceof TRPCError && e.code === code,
        );
      const save = (status: "absent" | "present") =>
        admin.attendance.saveClass({
          classRoomId: group.id,
          date: schoolToday(),
          rows: [{ studentId, status, remarks: "" }],
        });
      await save("absent");
      let logs = await tx.select().from(emailLogs);
      const baseline = logs.length;
      await tx
        .update(students)
        .set({ guardianEmailConsent: true })
        .where(eq(students.userId, studentId));
      await save("absent");
      await save("absent");
      logs = await tx.select().from(emailLogs);
      assert.equal(logs.length, baseline + 1);
      const log = logs.find((l) => l.toEmail === "guardian@example.test")!;
      assert.ok(log);
      await denied(student.notification.emailHistory(), "FORBIDDEN");
      await denied(student.notification.sendEmail({ id: log.id }), "FORBIDDEN");
      await save("present");
      assert.equal(
        (
          await tx.query.emailLogs.findFirst({
            where: eq(emailLogs.id, log.id),
          })
        )?.status,
        "cancelled",
      );
      await denied(
        admin.notification.sendEmail({ id: log.id }),
        "PRECONDITION_FAILED",
      );
      await save("absent");
      await tx
        .update(students)
        .set({ guardianEmailConsent: false })
        .where(eq(students.userId, studentId));
      await denied(
        admin.notification.sendEmail({ id: log.id }),
        "PRECONDITION_FAILED",
      );
      await tx
        .update(students)
        .set({
          guardianEmailConsent: true,
          guardianEmail: "changed@example.test",
        })
        .where(eq(students.userId, studentId));
      await denied(
        admin.notification.sendEmail({ id: log.id }),
        "PRECONDITION_FAILED",
      );
      await tx
        .update(students)
        .set({ guardianEmail: "guardian@example.test" })
        .where(eq(students.userId, studentId));
      assert.equal(sends, 0);
      assert.equal(
        (await admin.notification.sendEmail({ id: log.id })).status,
        "accepted",
      );
      await denied(admin.notification.sendEmail({ id: log.id }), "CONFLICT");
      assert.equal(sends, 1);
      mode = "restricted";
      await denied(
        admin.notification.refreshEmail({ id: log.id }),
        "PRECONDITION_FAILED",
      );
      assert.equal(
        (
          await tx.query.emailLogs.findFirst({
            where: eq(emailLogs.id, log.id),
          })
        )?.status,
        "accepted",
      );
      assert.equal(sends, 1);
      mode = "ok";
      assert.equal(
        (await admin.notification.refreshEmail({ id: log.id })).status,
        "provider:delivered",
      );
      await save("present");
      assert.equal(
        (
          await tx.query.emailLogs.findFirst({
            where: eq(emailLogs.id, log.id),
          })
        )?.status,
        "provider:delivered",
      );
      assert.match(
        (await tx.query.emailLogs.findFirst({
          where: eq(emailLogs.id, log.id),
        }))!.message,
        /marked absent/,
      );
      const compose = async () => {
        assert.equal(
          (
            await admin.notification.compose({
              studentIds: [studentId, studentId],
              message: "Test <script>alert(1)</script>",
            })
          ).emailsQueued,
          1,
        );
        return (await admin.notification.emailHistory())[0]!;
      };
      const second = await compose();
      mode = "reject";
      assert.equal(
        (await admin.notification.sendEmail({ id: second.id })).status,
        "failed",
      );
      mode = "ok";
      assert.equal(
        (await admin.notification.sendEmail({ id: second.id })).status,
        "accepted",
      );
      const third = await compose();
      mode = "timeout";
      assert.equal(
        (await admin.notification.sendEmail({ id: third.id })).status,
        "unknown",
      );
      await denied(admin.notification.sendEmail({ id: third.id }), "CONFLICT");
      const fourth = await compose();
      await admin.notification.cancelEmail({ id: fourth.id });
      await denied(admin.notification.sendEmail({ id: fourth.id }), "CONFLICT");
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
  console.log(
    "Guardian email tests passed: consent, deduplication, role restrictions, corrections, send once, delivery status, rejection, timeout, cancellation, HTML escaping. All data rolled back; no real email sent.",
  );
} finally {
  globalThis.fetch = originalFetch;
  await client.end();
}
