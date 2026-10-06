import { Shell } from "~/app/_components/shell";
import { AttendanceWorkspace } from "~/app/_components/attendance-workspace";
import { requireSession } from "~/server/auth/require-session";
export default async function Page() {
  const session = await requireSession(false);
  return (
    <Shell role={session.user.role} name={session.user.name}>
      <AttendanceWorkspace role={session.user.role} />
    </Shell>
  );
}
