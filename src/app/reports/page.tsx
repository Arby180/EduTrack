import { Shell } from "~/app/_components/shell";
import { Reports } from "~/app/_components/reports";
import { requireSession } from "~/server/auth/require-session";
export default async function Page() {
  const session = await requireSession(false);
  return (
    <Shell role={session.user.role} name={session.user.name}>
      <Reports role={session.user.role} name={session.user.name} />
    </Shell>
  );
}
