import assert from "node:assert/strict";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";

// These values and fetch stub exist only in this process. No SMS leaves this test.
process.env.TWILIO_ACCOUNT_SID = `AC${"0".repeat(32)}`;
process.env.TWILIO_AUTH_TOKEN = "test-only-not-a-real-token";
process.env.TWILIO_FROM_NUMBER = "+15005550006";
let smsRequests = 0;
let simulateTimeout = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.ok(
    String(url).startsWith("https://api.twilio.com/"),
    "Unexpected outbound HTTP request.",
  );
  if (options?.method === "POST") {
    smsRequests++;
    if (simulateTimeout) throw new Error("Simulated timeout");
    return Response.json({ sid: `SM${"0".repeat(32)}`, status: "queued" });
  }
  return Response.json({
    sid: `SM${"0".repeat(32)}`,
    status: "delivered",
    error_code: null,
  });
};
const { db, client } = await import("../src/server/db");
const { appRouter } = await import("../src/server/api/root");
const { users, students, attendance, smsLogs, notifications } =
  await import("../src/server/db/schema");
const { schoolToday, dateInput, percentage, csvCell } =
  await import("../src/lib/school");
const marker = crypto.randomUUID();
const rollback = new Error("ROLL_BACK_WORKFLOW_TESTS");
let assertions = 0;
async function denied(promise: Promise<unknown>, code: string) {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof TRPCError && error.code === code,
  );
  assertions++;
}
try {
  assert.equal(dateInput.safeParse("2026-02-30").success, false);
  assert.equal(dateInput.safeParse("2028-02-29").success, true);
  assert.equal(percentage(15, 20), 75);
  assert.equal(percentage(0, 0), null);
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assertions += 5;
  try {
    await db.transaction(async (tx) => {
      const actorId = `test-admin-${marker}`;
      await tx
        .insert(users)
        .values({
          id: actorId,
          name: "Workflow test admin",
          email: `${actorId}@example.test`,
          role: "admin",
        });
      const session = (id: string, role: "admin" | "student"): Session => ({
        user: { id, role, name: "Workflow tester", email: "test@example.test" },
        expires: "2099-01-01T00:00:00Z",
      });
      const caller = (value: Session | null) =>
        appRouter.createCaller({
          db: tx as unknown as typeof db,
          session: value,
          headers: new Headers(),
        });
      const admin = caller(session(actorId, "admin"));
      await denied(caller(null).admin.listUsers(), "UNAUTHORIZED");
      const [classroom] = await admin.admin.saveClass({
        name: `TEST-${marker}`,
        gradeLevel: "3",
        schoolYear: "2026-2027",
      });
      assert.ok(classroom);
      const [subject] = await admin.admin.saveSubject({
        name: "Test Mathematics",
        classRoomId: classroom.id,
      });
      assert.ok(subject);
      const [otherClass] = await admin.admin.saveClass({
        name: `TEST-other-${marker}`,
        gradeLevel: "4",
        schoolYear: "2026-2027",
      });
      assert.ok(otherClass);
      const [otherSubject] = await admin.admin.saveSubject({
        name: "Other subject",
        classRoomId: otherClass.id,
      });
      assert.ok(otherSubject);
      const profile = {
        name: "Workflow Student",
        email: `student-${marker}@example.test`,
        role: "student" as const,
        password: "Test-password-123",
        studentNumber: `T-${marker}`,
        classRoomId: classroom.id,
        gradeLevel: "3",
        guardianName: "Test guardian",
        guardianPhone: "+15005550006",
        guardianSmsConsent: true,
      };
      const student = await admin.admin.saveUser(profile);
      const second = await admin.admin.saveUser({
        ...profile,
        email: `second-${marker}@example.test`,
        studentNumber: `U-${marker}`,
      });
      const own = caller(session(student.id, "student"));
      const other = caller(session(second.id, "student"));
      await denied(own.admin.listUsers(), "FORBIDDEN");
      await denied(
        own.admin.saveClass({
          name: "Forbidden",
          gradeLevel: "",
          schoolYear: "",
        }),
        "FORBIDDEN",
      );
      await denied(admin.admin.saveUser(profile), "CONFLICT");
      await denied(
        admin.admin.setActive({ id: actorId, isActive: false }),
        "BAD_REQUEST",
      );
      const payload = {
        classRoomId: classroom.id,
        date: schoolToday(),
        rows: [
          {
            studentId: student.id,
            status: "absent" as const,
            remarks: "Test absence",
          },
          { studentId: second.id, status: "present" as const, remarks: "" },
        ],
      };
      await admin.attendance.saveClass(payload);
      await admin.attendance.saveClass(payload);
      assert.equal(
        (
          await tx
            .select()
            .from(attendance)
            .where(
              and(
                eq(attendance.studentId, student.id),
                eq(attendance.date, payload.date),
              ),
            )
        ).length,
        1,
      );
      let notices = await own.notification.list();
      assert.equal(notices.length, 1);
      const notice = notices[0]!;
      const logs = await tx
        .select()
        .from(smsLogs)
        .where(eq(smsLogs.notificationId, notice.id));
      assert.equal(logs.length, 1);
      assert.equal(logs[0]!.status, "pending");
      await other.notification.markRead({ id: notice.id });
      assert.equal(
        (
          await tx.query.notifications.findFirst({
            where: eq(notifications.id, notice.id),
          })
        )?.readAt,
        null,
      );
      await own.notification.markRead({ id: notice.id });
      assert.ok((await own.notification.list())[0]?.readAt);
      await denied(
        other.attendance.getAttendanceByStudent({ studentId: student.id }),
        "FORBIDDEN",
      );
      await denied(own.attendance.saveClass(payload), "FORBIDDEN");
      await denied(
        admin.attendance.saveClass({
          ...payload,
          rows: [payload.rows[0]!, payload.rows[0]!],
        }),
        "BAD_REQUEST",
      );
      await denied(
        admin.attendance.saveClass({ ...payload, date: "2099-01-01" }),
        "BAD_REQUEST",
      );
      await admin.attendance.saveClass({
        ...payload,
        rows: [
          { studentId: student.id, status: "present", remarks: "Corrected" },
        ],
      });
      assert.equal(
        (
          await tx.query.smsLogs.findFirst({
            where: eq(smsLogs.id, logs[0]!.id),
          })
        )?.status,
        "cancelled",
      );
      await denied(
        admin.notification.sendSms({ id: logs[0]!.id }),
        "PRECONDITION_FAILED",
      );
      await admin.attendance.saveClass(payload);
      assert.equal(
        (await admin.notification.sendSms({ id: logs[0]!.id })).status,
        "queued",
      );
      await denied(admin.notification.sendSms({ id: logs[0]!.id }), "CONFLICT");
      assert.equal(smsRequests, 1);
      await admin.notification.refreshSms({ id: logs[0]!.id });
      assert.equal(
        (
          await tx.query.smsLogs.findFirst({
            where: eq(smsLogs.id, logs[0]!.id),
          })
        )?.status,
        "delivered",
      );
      const assessment = {
        studentId: student.id,
        subjectId: subject.id,
        type: "quiz" as const,
        label: "Test quiz",
        score: 15,
        total: 20,
        quarter: 1,
        remarks: "",
      };
      const [grade] = await admin.grade.save(assessment);
      assert.ok(grade);
      await denied(
        admin.grade.save({ ...assessment, score: 21 }),
        "BAD_REQUEST",
      );
      await denied(
        admin.grade.save({ ...assessment, subjectId: otherSubject.id }),
        "BAD_REQUEST",
      );
      await denied(own.grade.save(assessment), "FORBIDDEN");
      await denied(
        other.grade.getGradesByStudent({ studentId: student.id }),
        "FORBIDDEN",
      );
      await denied(
        other.grade.getGradeSummaryBySubject({ studentId: student.id }),
        "FORBIDDEN",
      );
      assert.equal(
        (await own.grade.getGradeSummaryBySubject({}))[0]?.percentage,
        75,
      );
      await admin.grade.save({ ...assessment, id: grade.id, score: 18 });
      assert.equal(
        (await own.grade.getGradeSummaryBySubject({}))[0]?.percentage,
        90,
      );
      const report = await own.report.overview({
        from: payload.date,
        to: payload.date,
      });
      assert.equal(report.roster.length, 1);
      assert.equal(report.gradeRows.length, 1);
      assert.equal(report.average, 90);
      assert.equal(report.counts.absent, 1);
      assert.equal(
        (await other.report.overview({ from: payload.date, to: payload.date }))
          .gradeRows.length,
        0,
      );
      await denied(admin.admin.deleteSubject({ id: subject.id }), "CONFLICT");
      // A failed constraint statement is isolated in a savepoint by the router.
      const [announcement] = await admin.announcement.save({
        title: `Test ${marker}`,
        body: "Test message",
      });
      assert.ok(announcement);
      assert.ok(
        (await own.announcement.list()).some((a) => a.id === announcement.id),
      );
      await denied(
        own.announcement.remove({ id: announcement.id }),
        "FORBIDDEN",
      );
      await admin.announcement.remove({ id: announcement.id });
      const result = await admin.notification.compose({
        studentIds: [student.id, second.id],
        message: "Test school reminder",
      });
      assert.equal(result.queued, 2);
      notices = await own.notification.list();
      const reminder = notices.find(
        (n) => n.message === "Test school reminder",
      )!;
      const pending = (
        await tx
          .select()
          .from(smsLogs)
          .where(eq(smsLogs.notificationId, reminder.id))
      )[0]!;
      simulateTimeout = true;
      assert.equal(
        (await admin.notification.sendSms({ id: pending.id })).status,
        "unknown",
      );
      await denied(admin.notification.sendSms({ id: pending.id }), "CONFLICT");
      assert.equal(smsRequests, 2);
      await admin.admin.setActive({ id: student.id, isActive: false });
      assert.equal(
        (
          await admin.attendance.roster({
            classRoomId: classroom.id,
            date: payload.date,
          })
        ).length,
        1,
      );
      await admin.grade.remove({ id: grade.id });
      assert.equal((await own.grade.getGradesByStudent({})).length, 0);
      assert.ok(
        await tx.query.students.findFirst({
          where: eq(students.userId, student.id),
        }),
      );
      assertions += 30;
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(
    await db.query.users.findFirst({
      where: eq(users.id, `test-admin-${marker}`),
    }),
    undefined,
  );
  console.log(
    `PASS: ${assertions}+ checks covering CRUD, authorization, attendance upserts, corrections, reports, inbox privacy, and simulated SMS delivery. All test records rolled back; no real SMS sent.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  await client.end();
}
