import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  attendance,
  attendanceStatuses,
  notifications,
  students,
  users,
  smsLogs,
  emailLogs,
} from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedProcedure,
  roleProcedure,
} from "~/server/api/trpc";
import { dateInput, schoolToday } from "~/lib/school";

export const attendanceRouter = createTRPCRouter({
  roster: roleProcedure(["admin"])
    .input(
      z.object({ classRoomId: z.number().int().positive(), date: dateInput }),
    )
    .query(async ({ ctx, input }) => {
      const roster = await ctx.db
        .select({
          id: students.userId,
          name: users.name,
          studentNumber: students.studentNumber,
        })
        .from(students)
        .innerJoin(users, eq(users.id, students.userId))
        .where(
          and(
            eq(students.classRoomId, input.classRoomId),
            eq(users.isActive, true),
          ),
        )
        .orderBy(asc(users.name));
      const records = roster.length
        ? await ctx.db
            .select()
            .from(attendance)
            .where(
              and(
                eq(attendance.date, input.date),
                inArray(
                  attendance.studentId,
                  roster.map((s) => s.id),
                ),
              ),
            )
        : [];
      return roster.map((s) => ({
        ...s,
        record: records.find((r) => r.studentId === s.id) ?? null,
      }));
    }),
  saveClass: roleProcedure(["admin"])
    .input(
      z.object({
        classRoomId: z.number().int().positive(),
        date: dateInput,
        rows: z
          .array(
            z.object({
              studentId: z.string().min(1),
              status: z.enum(attendanceStatuses),
              remarks: z.string().trim().max(1000).default(""),
            }),
          )
          .min(1)
          .max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.date > schoolToday())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Attendance cannot be recorded for a future date.",
        });
      if (
        new Set(input.rows.map((r) => r.studentId)).size !== input.rows.length
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duplicate students in attendance.",
        });
      return ctx.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`attendance:${input.classRoomId}:${input.date}`}))`,
        );
        const roster = await tx
          .select({
            id: students.userId,
            name: users.name,
            phone: students.guardianPhone,
            consent: students.guardianSmsConsent,
            email: students.guardianEmail,
            emailConsent: students.guardianEmailConsent,
          })
          .from(students)
          .innerJoin(users, eq(users.id, students.userId))
          .where(
            and(
              eq(students.classRoomId, input.classRoomId),
              eq(users.isActive, true),
            ),
          );
        for (const row of input.rows) {
          const student = roster.find((s) => s.id === row.studentId);
          if (!student)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "A student is no longer active in this class. Reload the roster.",
            });
          const [record] = await tx
            .insert(attendance)
            .values({
              ...row,
              date: input.date,
              classRoomId: input.classRoomId,
              recordedById: ctx.session.user.id,
            })
            .onConflictDoUpdate({
              target: [attendance.studentId, attendance.date],
              set: {
                status: row.status,
                remarks: row.remarks,
                recordedById: ctx.session.user.id,
              },
            })
            .returning();
          if (!record) throw new Error("Attendance was not saved.");
          const existing = await tx.query.notifications.findFirst({
            where: and(
              eq(notifications.attendanceId, record.id),
              eq(notifications.recipientId, row.studentId),
            ),
          });
          if (row.status === "absent") {
            const message = `EduTrack: ${student.name ?? "Your child"} was marked absent on ${input.date}. Please contact the school office for assistance.`;
            const notification =
              existing ??
              (
                await tx
                  .insert(notifications)
                  .values({
                    recipientId: row.studentId,
                    attendanceId: record.id,
                    message,
                  })
                  .returning()
              )[0];
            if (existing)
              await tx
                .update(notifications)
                .set({ message, readAt: null })
                .where(eq(notifications.id, existing.id));
            if (notification && student.email && student.emailConsent) {
              await tx
                .insert(emailLogs)
                .values({
                  notificationId: notification.id,
                  toEmail: student.email,
                  message,
                })
                .onConflictDoUpdate({
                  target: emailLogs.notificationId,
                  set: {
                    toEmail: student.email,
                    message,
                    status: "pending",
                    errorMessage: null,
                  },
                  setWhere: inArray(emailLogs.status, [
                    "pending",
                    "failed",
                    "cancelled",
                  ]),
                });
            }
            if (notification && student.phone && student.consent) {
              const log = await tx.query.smsLogs.findFirst({
                where: eq(smsLogs.notificationId, notification.id),
              });
              if (!log)
                await tx.insert(smsLogs).values({
                  notificationId: notification.id,
                  toPhoneNumber: student.phone,
                  status: "pending",
                });
              else if (log.status === "cancelled")
                await tx
                  .update(smsLogs)
                  .set({
                    status: "pending",
                    toPhoneNumber: student.phone,
                    errorMessage: null,
                  })
                  .where(eq(smsLogs.id, log.id));
            }
          } else if (existing) {
            await tx
              .update(emailLogs)
              .set({ status: "cancelled" })
              .where(
                and(
                  eq(emailLogs.notificationId, existing.id),
                  inArray(emailLogs.status, ["pending", "failed"]),
                ),
              );
            await tx
              .update(notifications)
              .set({
                message: `Attendance on ${input.date} was corrected to ${row.status}.`,
                readAt: null,
              })
              .where(eq(notifications.id, existing.id));
            await tx
              .update(smsLogs)
              .set({ status: "cancelled" })
              .where(
                and(
                  eq(smsLogs.notificationId, existing.id),
                  inArray(smsLogs.status, ["pending", "failed"]),
                ),
              );
          }
        }
        return { saved: input.rows.length };
      });
    }),
  getAttendanceByStudent: protectedProcedure
    .input(z.object({ studentId: z.string().optional() }).default({}))
    .query(({ ctx, input }) => {
      const studentId = input.studentId ?? ctx.session.user.id;
      if (
        ctx.session.user.role !== "admin" &&
        studentId !== ctx.session.user.id
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db
        .select()
        .from(attendance)
        .where(eq(attendance.studentId, studentId))
        .orderBy(desc(attendance.date));
    }),
});
