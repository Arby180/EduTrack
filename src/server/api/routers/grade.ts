import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { grades, gradeTypes, subjects, students } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedProcedure,
  roleProcedure,
} from "~/server/api/trpc";
import { percentage } from "~/lib/school";
const studentInput = z
  .object({
    studentId: z.string().optional(),
    quarter: z.number().int().min(1).max(4).optional(),
  })
  .default({});
export const gradeRouter = createTRPCRouter({
  save: roleProcedure(["admin"])
    .input(
      z
        .object({
          id: z.number().int().positive().optional(),
          studentId: z.string().min(1),
          subjectId: z.number().int().positive(),
          type: z.enum(gradeTypes),
          label: z.string().trim().min(1).max(128),
          score: z.number().finite().min(0),
          total: z.number().finite().positive(),
          quarter: z.number().int().min(1).max(4),
          remarks: z.string().trim().max(1000).default(""),
        })
        .refine((v) => v.score <= v.total, {
          message: "Score cannot exceed the total.",
          path: ["score"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const [student, subject] = await Promise.all([
        ctx.db.query.students.findFirst({
          where: eq(students.userId, input.studentId),
        }),
        ctx.db.query.subjects.findFirst({
          where: eq(subjects.id, input.subjectId),
        }),
      ]);
      const existing = id
        ? await ctx.db.query.grades.findFirst({ where: eq(grades.id, id) })
        : null;
      if (id && !existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        !student ||
        !subject ||
        (student.classRoomId !== subject.classRoomId &&
          !(
            existing?.studentId === input.studentId &&
            existing.subjectId === input.subjectId
          ))
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a subject assigned to the student's class.",
        });
      const data = { ...values, recordedById: ctx.session.user.id };
      return id
        ? ctx.db.update(grades).set(data).where(eq(grades.id, id)).returning()
        : ctx.db.insert(grades).values(data).returning();
    }),
  remove: roleProcedure(["admin"])
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      ctx.db.delete(grades).where(eq(grades.id, input.id)),
    ),
  getGradesByStudent: protectedProcedure
    .input(studentInput)
    .query(({ ctx, input }) => {
      const studentId = input.studentId ?? ctx.session.user.id;
      if (
        ctx.session.user.role !== "admin" &&
        studentId !== ctx.session.user.id
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db
        .select({
          id: grades.id,
          studentId: grades.studentId,
          subjectId: grades.subjectId,
          subject: subjects.name,
          type: grades.type,
          label: grades.label,
          score: grades.score,
          total: grades.total,
          quarter: grades.quarter,
          remarks: grades.remarks,
        })
        .from(grades)
        .innerJoin(subjects, eq(subjects.id, grades.subjectId))
        .where(
          and(
            eq(grades.studentId, studentId),
            input.quarter ? eq(grades.quarter, input.quarter) : undefined,
          ),
        )
        .orderBy(desc(grades.createdAt));
    }),
  getGradeSummaryBySubject: protectedProcedure
    .input(studentInput)
    .query(async ({ ctx, input }) => {
      const studentId = input.studentId ?? ctx.session.user.id;
      if (
        ctx.session.user.role !== "admin" &&
        studentId !== ctx.session.user.id
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await ctx.db
        .select({
          subjectId: grades.subjectId,
          subject: subjects.name,
          score: grades.score,
          total: grades.total,
        })
        .from(grades)
        .innerJoin(subjects, eq(subjects.id, grades.subjectId))
        .where(
          and(
            eq(grades.studentId, studentId),
            input.quarter ? eq(grades.quarter, input.quarter) : undefined,
          ),
        );
      const totals = new Map<
        number,
        {
          subjectId: number;
          subject: string;
          score: number;
          total: number;
          count: number;
        }
      >();
      for (const r of rows) {
        const v = totals.get(r.subjectId) ?? {
          subjectId: r.subjectId,
          subject: r.subject,
          score: 0,
          total: 0,
          count: 0,
        };
        v.score += r.score;
        v.total += r.total;
        v.count++;
        totals.set(r.subjectId, v);
      }
      return [...totals.values()].map((v) => ({
        ...v,
        percentage: percentage(v.score, v.total),
      }));
    }),
});
