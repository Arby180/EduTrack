import { Shell } from "~/app/_components/shell";
import { People } from "~/app/_components/people";
import { requireSession } from "~/server/auth/require-session";
export default async function Page() {
  const session = await requireSession(true);
  return (
    <Shell role={session.user.role} name={session.user.name}>
      <People />
    </Shell>
  );
}
