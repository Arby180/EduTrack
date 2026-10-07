import { Shell } from "~/app/_components/shell";
import { Reports } from "~/app/_components/reports";
import { requireSession } from "~/server/auth/require-session";
import { db } from "~/server/db";
import { students } from "~/server/db/schema";
import { eq } from "drizzle-orm";
export default async function Page() {
  const session = await requireSession(false);
  const student = await db.query.students.findFirst({
    where: eq(students.userId, session.user.id),
  });
  return (
    <Shell role={session.user.role} name={session.user.name}>
      {session.user.role === "student" && !student?.classRoomId && (
        <p className="notice" role="status">
          Welcome to EduTrack! No class assigned yet. Your account is recorded;
          contact your school administrator to assign your student number and
          class.
        </p>
      )}
      <Reports role={session.user.role} name={session.user.name} dashboard />
    </Shell>
  );
}
