import { TRPCError } from "@trpc/server";
import { asc, eq, and, ne, or, inArray } from "drizzle-orm";
import {
  accounts,
  sessions,
  verificationTokens,
  googleRegistrations,
  attendance,
  grades,
  notifications,
  smsLogs,
  emailLogs,
  announcements,
} from "~/server/db/schema";
import { z } from "zod";
import { classRooms, subjects, users, students } from "~/server/db/schema";
import { createTRPCRouter, roleProcedure } from "~/server/api/trpc";
import { hashPassword } from "~/server/auth/password";
import { phoneInput } from "~/lib/school";

const admin = roleProcedure(["admin"]);
const userInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(255),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((v) => v.toLowerCase()),
  role: z.enum(["student", "admin"]),
  password: z.string().min(8).max(128).or(z.literal("")).optional(),
  studentNumber: z.string().trim().max(64).default(""),
  classRoomId: z.number().int().positive().nullable(),
  gradeLevel: z.string().trim().max(32).default(""),
  guardianName: z.string().trim().max(255).default(""),
  guardianPhone: phoneInput.default(""),
  guardianSmsConsent: z.boolean().default(false),
  guardianEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email().max(255).or(z.literal("")))
    .default(""),
  guardianEmailConsent: z.boolean().default(false),
});
const classInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(128),
  gradeLevel: z.string().trim().max(32),
  schoolYear: z.string().trim().max(32),
});
export const adminRouter = createTRPCRouter({
  deleteUser: admin
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot delete your own account.",
        });
      return ctx.db.transaction(async (tx) => {
        const [target] = await tx
          .select()
          .from(users)
          .where(eq(users.id, input.id))
          .for("update");
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account already deleted.",
          });
        const attendanceIds = tx
          .select({ id: attendance.id })
          .from(attendance)
          .where(eq(attendance.studentId, input.id));
        const notificationIds = tx
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            or(
              eq(notifications.recipientId, input.id),
              inArray(notifications.attendanceId, attendanceIds),
            ),
          );
        await tx
          .delete(emailLogs)
          .where(inArray(emailLogs.notificationId, notificationIds));
        await tx
          .delete(smsLogs)
          .where(inArray(smsLogs.notificationId, notificationIds));
        await tx
          .delete(notifications)
          .where(inArray(notifications.id, notificationIds));
        await tx.delete(grades).where(eq(grades.studentId, input.id));
        await tx.delete(attendance).where(eq(attendance.studentId, input.id));
        // Preserve other students' records; transfer required staff references to the deleting admin.
        await tx
          .update(grades)
          .set({ recordedById: ctx.session.user.id })
          .where(eq(grades.recordedById, input.id));
        await tx
          .update(attendance)
          .set({ recordedById: ctx.session.user.id })
          .where(eq(attendance.recordedById, input.id));
        await tx
          .update(announcements)
          .set({ createdById: null })
          .where(eq(announcements.createdById, input.id));
        await tx
          .update(classRooms)
          .set({ adviserId: null })
          .where(eq(classRooms.adviserId, input.id));
        const googleIds = tx
          .select({ id: accounts.providerAccountId })
          .from(accounts)
          .where(
            and(eq(accounts.userId, input.id), eq(accounts.provider, "google")),
          );
        await tx
          .delete(googleRegistrations)
          .where(
            or(
              eq(googleRegistrations.email, target.email),
              inArray(googleRegistrations.googleId, googleIds),
            ),
          );
        await tx
          .delete(verificationTokens)
          .where(eq(verificationTokens.identifier, target.email));
        await tx.delete(sessions).where(eq(sessions.userId, input.id));
        await tx.delete(accounts).where(eq(accounts.userId, input.id));
        await tx.delete(students).where(eq(students.userId, input.id));
        await tx.delete(users).where(eq(users.id, input.id));
        return { id: input.id };
      });
    }),
  listUsers: admin.query(({ ctx }) =>
    ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        approvalPending: users.approvalPending,
        studentNumber: students.studentNumber,
        classRoomId: students.classRoomId,
        gradeLevel: students.gradeLevel,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        guardianSmsConsent: students.guardianSmsConsent,
        guardianEmail: students.guardianEmail,
        guardianEmailConsent: students.guardianEmailConsent,
      })
      .from(users)
      .leftJoin(students, eq(students.userId, users.id))
      .orderBy(asc(users.name)),
  ),
  saveUser: admin.input(userInput).mutation(async ({ ctx, input }) => {
    if (input.role === "student" && !input.studentNumber)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Student number is required.",
      });
    if (!input.id && !input.password)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Set an initial password of at least 8 characters.",
      });
    return ctx.db.transaction(async (tx) => {
      if (input.id) {
        const existing = await tx.query.users.findFirst({
          where: eq(users.id, input.id),
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (existing.role !== input.role && !existing.approvalPending)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Account roles cannot be changed. Create a separate account.",
          });
        if (existing.approvalPending && input.role === "admin") {
          await tx.delete(students).where(eq(students.userId, existing.id));
        }
      }
      const duplicate = await tx.query.users.findFirst({
        where: and(
          eq(users.email, input.email),
          input.id ? ne(users.id, input.id) : undefined,
        ),
      });
      if (duplicate)
        throw new TRPCError({
          code: "CONFLICT",
          message: "That email is already registered.",
        });
      if (
        input.classRoomId &&
        !(await tx.query.classRooms.findFirst({
          where: eq(classRooms.id, input.classRoomId),
        }))
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Class no longer exists.",
        });
      if (input.role === "student") {
        const duplicateNumber = await tx.query.students.findFirst({
          where: and(
            eq(students.studentNumber, input.studentNumber),
            input.id ? ne(students.userId, input.id) : undefined,
          ),
        });
        if (duplicateNumber)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Student number is already in use.",
          });
      }
      const values = {
        name: input.name,
        email: input.email,
        role: input.role,
        ...(input.password
          ? { passwordHash: await hashPassword(input.password) }
          : {}),
      };
      const id = input.id ?? crypto.randomUUID();
      if (input.id) await tx.update(users).set(values).where(eq(users.id, id));
      else await tx.insert(users).values({ ...values, id, role: input.role });
      if (input.role === "student") {
        const profile = {
          studentNumber: input.studentNumber,
          classRoomId: input.classRoomId,
          gradeLevel: input.gradeLevel,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          guardianSmsConsent: input.guardianSmsConsent,
          guardianEmail: input.guardianEmail,
          guardianEmailConsent: input.guardianEmailConsent,
        };
        await tx
          .insert(students)
          .values({ ...profile, userId: id })
          .onConflictDoUpdate({ target: students.userId, set: profile });
      }
      return { id };
    });
  }),
  setActive: admin
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate your own account.",
        });
      const target = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.id),
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        input.isActive &&
        target.approvalPending &&
        target.role === "student"
      ) {
        const profile = await ctx.db.query.students.findFirst({
          where: eq(students.userId, input.id),
        });
        if (
          !profile?.classRoomId ||
          !profile.studentNumber ||
          profile.studentNumber.startsWith("PENDING-")
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Edit this student and assign a student number and class before approving access.",
          });
      }
      await ctx.db
        .update(users)
        .set({
          isActive: input.isActive,
          ...(input.isActive ? { approvalPending: false } : {}),
        })
        .where(eq(users.id, input.id));
    }),
  listClasses: admin.query(({ ctx }) =>
    ctx.db.select().from(classRooms).orderBy(asc(classRooms.name)),
  ),
  saveClass: admin.input(classInput).mutation(({ ctx, input }) => {
    const { id, ...values } = input;
    return id
      ? ctx.db
          .update(classRooms)
          .set(values)
          .where(eq(classRooms.id, id))
          .returning()
      : ctx.db
          .insert(classRooms)
          .values({ ...values, adviserId: ctx.session.user.id })
          .returning();
  }),
  deleteClass: admin
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction((tx) =>
          tx.delete(classRooms).where(eq(classRooms.id, input.id)),
        );
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This class has students, subjects, or attendance. Move or remove related records first.",
        });
      }
    }),
  listSubjects: admin.query(({ ctx }) =>
    ctx.db.select().from(subjects).orderBy(asc(subjects.name)),
  ),
  saveSubject: admin
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(128),
        classRoomId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      if (id) {
        const old = await ctx.db.query.subjects.findFirst({
          where: eq(subjects.id, id),
        });
        if (old && old.classRoomId !== values.classRoomId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Create a new subject to assign it to another class.",
          });
      }
      return id
        ? ctx.db
            .update(subjects)
            .set(values)
            .where(eq(subjects.id, id))
            .returning()
        : ctx.db.insert(subjects).values(values).returning();
    }),
  deleteSubject: admin
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction((tx) =>
          tx.delete(subjects).where(eq(subjects.id, input.id)),
        );
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This subject has grades and cannot be deleted.",
        });
      }
    }),
});
