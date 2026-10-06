import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
export async function requireSession(adminOnly = false) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (adminOnly && session.user.role !== "admin") redirect("/student");
  return session;
}
