import Link from "next/link";
import { Icon } from "~/app/_components/icon";
import { redirect } from "next/navigation";
import { LoginForm } from "~/app/_components/login-form";
import { auth } from "~/server/auth";
import { env } from "~/env";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const params = await searchParams;
  return (
    <main className="login-page">
      <div className="login-card">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Icon size={28} />
          </span>
          EduTrack
          <span className="brand-dot">.</span>
        </Link>
        <p className="eyebrow mt-10">YOUR SCHOOL, CONNECTED</p>
        <h1>Welcome back.</h1>
        <p className="muted mt-3 mb-8">
          A clearer picture of every school day.
        </p>
        <LoginForm
          googleEnabled={!!(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET)}
          initialError={params.error}
        />
      </div>
    </main>
  );
}
