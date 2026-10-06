import { Shell } from "~/app/_components/shell";
import { AnnouncementsWorkspace } from "~/app/_components/announcements-workspace";
import { requireSession } from "~/server/auth/require-session";
export default async function Page() {
  const session = await requireSession(false);
  return (
    <Shell role={session.user.role} name={session.user.name}>
      <AnnouncementsWorkspace role={session.user.role} />
    </Shell>
  );
}
