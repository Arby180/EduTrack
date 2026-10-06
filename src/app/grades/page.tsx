import { Shell } from "~/app/_components/shell";
import { GradesWorkspace } from "~/app/_components/grades-workspace";
import { requireSession } from "~/server/auth/require-session";
export default async function Page() {
  const session = await requireSession(false);
  return (
    <Shell role={session.user.role} name={session.user.name}>
      <GradesWorkspace role={session.user.role} userId={session.user.id} />
    </Shell>
  );
}
