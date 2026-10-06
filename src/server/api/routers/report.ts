import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  attendance,
  grades,
  students,
  users,
  subjects,
  classRooms,
} from "~/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { dateInput, percentage, schoolToday } from "~/lib/school";
export const reportRouter = createTRPCRouter({
  overview: protectedProcedure
    .input(
      z
        .object({
          from: dateInput,
          to: dateInput,
          classRoomId: z.number().int().positive().optional(),
          quarter: z.number().int().min(1).max(4).optional(),
        })
        .refine((v) => v.from <= v.to, {
          message: "Start date must be before end date.",
        }),
    )
    .query(async ({ ctx, input }) => {
      const own =
        ctx.session.user.role === "student" ? ctx.session.user.id : undefined;
      const [attendanceRows, gradeRows, roster] = await Promise.all([
        ctx.db
          .select({
            id: attendance.id,
            studentId: students.userId,
            name: users.name,
            studentNumber: students.studentNumber,
            date: attendance.date,
            status: attendance.status,
            remarks: attendance.remarks,
          })
          .from(attendance)
          .innerJoin(students, eq(students.userId, attendance.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(
            and(
              gte(attendance.date, input.from),
              lte(attendance.date, input.to),
              own ? eq(students.userId, own) : undefined,
              input.classRoomId
                ? eq(attendance.classRoomId, input.classRoomId)
                : undefined,
            ),
          )
          .orderBy(asc(attendance.date)),
        ctx.db
          .select({
            id: grades.id,
            studentId: students.userId,
            name: users.name,
            studentNumber: students.studentNumber,
            subject: subjects.name,
            subjectId: subjects.id,
            classRoomId: subjects.classRoomId,
            label: grades.label,
            quarter: grades.quarter,
            score: grades.score,
            total: grades.total,
          })
          .from(grades)
          .innerJoin(students, eq(students.userId, grades.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .innerJoin(subjects, eq(subjects.id, grades.subjectId))
          .where(
            and(
              own ? eq(students.userId, own) : undefined,
              input.classRoomId
                ? eq(subjects.classRoomId, input.classRoomId)
                : undefined,
              input.quarter ? eq(grades.quarter, input.quarter) : undefined,
            ),
          ),
        ctx.db
          .select({
            id: students.userId,
            name: users.name,
            studentNumber: students.studentNumber,
            gradeLevel: students.gradeLevel,
            className: classRooms.name,
          })
          .from(students)
          .innerJoin(users, eq(users.id, students.userId))
          .leftJoin(classRooms, eq(classRooms.id, students.classRoomId))
          .where(
            and(
              eq(users.isActive, true),
              own ? eq(students.userId, own) : undefined,
              input.classRoomId
                ? eq(students.classRoomId, input.classRoomId)
                : undefined,
            ),
          ),
      ]);
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      const trend = new Map<
        string,
        {
          date: string;
          present: number;
          absent: number;
          late: number;
          excused: number;
        }
      >();
      for (const row of attendanceRows) {
        counts[row.status]++;
        const d = trend.get(row.date) ?? {
          date: row.date,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
        d[row.status]++;
        trend.set(row.date, d);
      }
      const bySubject = new Map<
        number,
        { subject: string; score: number; total: number }
      >();
      for (const row of gradeRows) {
        const s = bySubject.get(row.subjectId) ?? {
          subject: row.subject,
          score: 0,
          total: 0,
        };
        s.score += row.score;
        s.total += row.total;
        bySubject.set(row.subjectId, s);
      }
      const byStudent = new Map<
        string,
        { name: string; studentNumber: string; score: number; total: number }
      >();
      for (const row of gradeRows) {
        const s = byStudent.get(row.studentId) ?? {
          name: row.name ?? "Student",
          studentNumber: row.studentNumber,
          score: 0,
          total: 0,
        };
        s.score += row.score;
        s.total += row.total;
        byStudent.set(row.studentId, s);
      }
      return {
        roster,
        attendanceRows,
        gradeRows,
        counts,
        trend: [...trend.values()],
        subjects: [...bySubject.values()].map((v) => ({
          ...v,
          percentage: percentage(v.score, v.total),
        })),
        students: [...byStudent.values()].map((v) => ({
          ...v,
          percentage: percentage(v.score, v.total),
        })),
        attendanceRate: percentage(
          counts.present + counts.late,
          attendanceRows.length,
        ),
        average: percentage(
          gradeRows.reduce((s, r) => s + r.score, 0),
          gradeRows.reduce((s, r) => s + r.total, 0),
        ),
        today: schoolToday(),
        todayPresent: attendanceRows.filter(
          (r) =>
            r.date === schoolToday() &&
            (r.status === "present" || r.status === "late"),
        ).length,
        todayAbsent: attendanceRows.filter(
          (r) => r.date === schoolToday() && r.status === "absent",
        ).length,
      };
    }),
});
