import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  primaryKey,
  pgTableCreator,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "@auth/core/adapters";

// Only these two roles can authenticate in EduTrack.
export const userRoles = ["student", "admin"] as const;
export type UserRole = (typeof userRoles)[number];
export const attendanceStatuses = [
  "present",
  "absent",
  "late",
  "excused",
] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];
export const gradeTypes = [
  "quiz",
  "assignment",
  "exam",
  "activity",
  "project",
  "final",
] as const;
export type GradeType = (typeof gradeTypes)[number];
export const userRoleEnum = pgEnum("edutrack_user_role", userRoles);
export const attendanceStatusEnum = pgEnum(
  "edutrack_attendance_status",
  attendanceStatuses,
);
export const gradeTypeEnum = pgEnum("edutrack_grade_type", gradeTypes);
export const notificationChannelEnum = pgEnum("edutrack_notification_channel", [
  "sms",
  "in_app",
]);

export const createTable = pgTableCreator((name) => `edutrack_${name}`);

// RLS blocks browser/Data API access. NextAuth and tRPC authorize server queries.
export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull().unique(),
  passwordHash: d.varchar({ length: 255 }),
  role: userRoleEnum().notNull().default("student"),
  isActive: d.boolean().notNull().default(true),
  approvalPending: d.boolean().notNull().default(false),
  emailVerified: d.timestamp({ withTimezone: true }),
  image: d.text(),
  createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  student: many(students),
}));
export const students = createTable("student", (d) => ({
  userId: d
    .varchar({ length: 255 })
    .primaryKey()
    .references(() => users.id),
  studentNumber: d.varchar({ length: 64 }).notNull().unique(),
  gradeLevel: d.varchar({ length: 32 }),
  guardianName: d.varchar({ length: 255 }),
  guardianPhone: d.varchar({ length: 32 }),
  guardianSmsConsent: d.boolean().notNull().default(false),
  guardianEmail: d.varchar({ length: 255 }),
  guardianEmailConsent: d.boolean().notNull().default(false),
  classRoomId: d.integer().references(() => classRooms.id),
}));

export const classRooms = createTable("class_room", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  name: d.varchar({ length: 128 }).notNull(),
  adviserId: d.varchar({ length: 255 }).references(() => users.id),
  gradeLevel: d.varchar({ length: 32 }),
  schoolYear: d.varchar({ length: 32 }),
}));

export const subjects = createTable("subject", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  name: d.varchar({ length: 128 }).notNull(),
  classRoomId: d
    .integer()
    .notNull()
    .references(() => classRooms.id),
}));

export const attendance = createTable(
  "attendance",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    studentId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => students.userId),
    date: d.date({ mode: "string" }).notNull(),
    classRoomId: d.integer().references(() => classRooms.id),
    remarks: d.text(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    status: attendanceStatusEnum().notNull(),
    recordedById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
  }),
  (t) => [uniqueIndex("attendance_student_date_idx").on(t.studentId, t.date)],
);

export const grades = createTable(
  "grade",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    studentId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => students.userId),
    subjectId: d
      .integer()
      .notNull()
      .references(() => subjects.id),
    type: gradeTypeEnum().notNull(),
    label: d.varchar({ length: 128 }).notNull(),
    score: d.doublePrecision().notNull(),
    total: d.doublePrecision().notNull(),
    quarter: d.integer(),
    remarks: d.text(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    recordedById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
  }),
  (t) => [
    index("grade_student_subject_idx").on(t.studentId, t.subjectId),
    check(
      "grade_score_valid",
      sql`${t.score} >= 0 AND ${t.total} > 0 AND ${t.score} <= ${t.total}`,
    ),
    check("grade_quarter_valid", sql`${t.quarter} BETWEEN 1 AND 4`),
  ],
);

export const announcements = createTable("announcement", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  title: d.varchar({ length: 200 }).notNull(),
  body: d.text().notNull(),
  createdById: d.varchar({ length: 255 }).references(() => users.id),
  createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const notifications = createTable("notification", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  channel: notificationChannelEnum().notNull().default("in_app"),
  message: d.text().notNull(),
  recipientId: d.varchar({ length: 255 }).references(() => users.id),
  readAt: d.timestamp({ withTimezone: true }),
  attendanceId: d.integer().references(() => attendance.id),
  createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const smsLogs = createTable("sms_log", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  notificationId: d
    .integer()
    .notNull()
    .references(() => notifications.id),
  toPhoneNumber: d.varchar({ length: 32 }).notNull(),
  status: d.varchar({ length: 64 }).notNull(),
  twilioSid: d.varchar({ length: 128 }),
  errorMessage: d.text(),
  createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({
      columns: [t.provider, t.providerAccountId],
    }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const emailLogs = createTable("email_log", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  notificationId: d
    .integer()
    .notNull()
    .unique()
    .references(() => notifications.id),
  toEmail: d.varchar({ length: 255 }).notNull(),
  message: d.text().notNull(),
  status: d.varchar({ length: 64 }).notNull().default("pending"),
  providerId: d.varchar({ length: 255 }),
  errorMessage: d.text(),
  createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ withTimezone: true }).notNull(),
  }),
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// No school account exists until this single-use email confirmation is consumed.
export const googleRegistrations = createTable("google_registration", (d) => ({
  email: d.varchar({ length: 255 }).primaryKey(),
  name: d.varchar({ length: 255 }).notNull(),
  googleId: d.varchar({ length: 255 }).notNull(),
  tokenHash: d.varchar({ length: 64 }).notNull().unique(),
  expires: d.timestamp({ withTimezone: true }).notNull(),
  requestedAt: d.timestamp({ withTimezone: true }).notNull(),
}));

// Enable RLS separately to retain the table types expected by the NextAuth adapter.
for (const table of [
  users,
  students,
  classRooms,
  subjects,
  attendance,
  grades,
  announcements,
  notifications,
  smsLogs,
  accounts,
  sessions,
  verificationTokens,
  googleRegistrations,
  emailLogs,
]) {
  table.enableRLS();
}
