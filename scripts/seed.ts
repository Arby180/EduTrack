import { eq } from "drizzle-orm";

import { hashPassword } from "../src/server/auth/password";
import { client, db } from "../src/server/db";
import {
  announcements,
  classRooms,
  students,
  subjects,
  users,
  type UserRole,
} from "../src/server/db/schema";

const password = "edutrack123";
const accounts: Array<{
  id: string;
  name: string;
  email: string;
  role: UserRole;
}> = [
  {
    id: "seed-student",
    name: "Sam Student",
    email: "student@edutrack.test",
    role: "student",
  },
  {
    id: "seed-admin",
    name: "Alex Admin",
    email: "admin@edutrack.test",
    role: "admin",
  },
];

try {
  await db.transaction(async (tx) => {
    const ids = new Map<UserRole, string>();
    for (const account of accounts) {
      const existing = await tx.query.users.findFirst({
        where: eq(users.email, account.email),
      });
      if (existing && existing.role !== account.role) {
        throw new Error(
          `Seed email already belongs to a different role: ${account.email}`,
        );
      }
      if (!existing) {
        await tx
          .insert(users)
          .values({ ...account, passwordHash: await hashPassword(password) });
      }
      ids.set(account.role, existing?.id ?? account.id);
    }
    const studentId = ids.get("student")!;
    const adminId = ids.get("admin")!;
    const existingClass = await tx.query.classRooms.findFirst({
      where: eq(classRooms.name, "3A"),
    });
    const classroom =
      existingClass ??
      (
        await tx
          .insert(classRooms)
          .values({ name: "3A", adviserId: adminId })
          .returning()
      )[0];
    if (!classroom) throw new Error("Could not create the seed classroom.");
    await tx
      .insert(students)
      .values({
        userId: studentId,
        studentNumber: "STU-0001",
        classRoomId: classroom.id,
      })
      .onConflictDoNothing();
    if (
      !(await tx.query.subjects.findFirst({
        where: eq(subjects.classRoomId, classroom.id),
      }))
    ) {
      await tx
        .insert(subjects)
        .values({ name: "Mathematics", classRoomId: classroom.id });
    }
    if (
      !(await tx.query.announcements.findFirst({
        where: eq(announcements.title, "Welcome to EduTrack"),
      }))
    ) {
      await tx
        .insert(announcements)
        .values({
          title: "Welcome to EduTrack",
          body: "Your attendance and academic records will appear here.",
          createdById: adminId,
        });
    }
  });
  console.log(
    "Student and admin demo accounts are ready. Existing passwords were preserved.",
  );
} finally {
  await client.end();
}
