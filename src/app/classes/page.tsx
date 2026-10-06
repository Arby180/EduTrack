import { Shell } from "~/app/_components/shell";
import { Classes } from "~/app/_components/classes";
import { requireSession } from "~/server/auth/require-session";
export default async function Page() {
  const session = await requireSession(true);
  return (
    <Shell role={session.user.role} name={session.user.name}>
      <Classes />
    </Shell>
  );
}
