import { Shell } from "~/app/_components/shell";
import { NotificationsWorkspace } from "~/app/_components/notifications-workspace";
import { requireSession } from "~/server/auth/require-session";
export default async function Page() {
  const session = await requireSession(false);
  return (
    <Shell role={session.user.role} name={session.user.name}>
      <NotificationsWorkspace role={session.user.role} />
    </Shell>
  );
}
