import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "student") redirect("/student");
  if (session.user.role === "admin") redirect("/admin");
  redirect("/login");
}
