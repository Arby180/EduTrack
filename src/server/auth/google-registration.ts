import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "~/server/db";
import {
  accounts,
  googleRegistrations,
  students,
  users,
} from "~/server/db/schema";
import { env } from "~/env";
import { sendRegistrationEmail } from "./sign-in-email";

type Database = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);

export async function requestGoogleRegistration(
  identity: { email: string; name: string; googleId: string },
  database: Database = db,
  send = sendRegistrationEmail,
): Promise<"sent" | "wait" | "unavailable"> {
  if (!env.AUTH_URL || !env.RESEND_API_KEY || !env.EMAIL_FROM)
    return "unavailable";
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const values = {
    ...identity,
    tokenHash: digest(token),
    expires: new Date(now.getTime() + 30 * 60_000),
    requestedAt: now,
  };
  // Conditional upsert serializes requests and limits email to once per minute.
  const reserved = await database
    .insert(googleRegistrations)
    .values(values)
    .onConflictDoUpdate({
      target: googleRegistrations.email,
      set: values,
      setWhere: lt(
        googleRegistrations.requestedAt,
        new Date(now.getTime() - 60_000),
      ),
    })
    .returning({ email: googleRegistrations.email });
  if (!reserved.length) return "wait";
  const url = new URL("/confirm-account", env.AUTH_URL);
  url.searchParams.set("token", token);
  const result = await send({
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    email: identity.email,
    confirmationUrl: url.toString(),
  });
  return result === "accepted" ? "sent" : "unavailable";
}

export async function hasValidRegistration(
  token: string,
  database: Database = db,
) {
  if (!validToken(token)) return false;
  return !!(await database.query.googleRegistrations.findFirst({
    where: and(
      eq(googleRegistrations.tokenHash, digest(token)),
      gt(googleRegistrations.expires, new Date()),
    ),
    columns: { email: true },
  }));
}

export async function confirmGoogleRegistration(
  token: string,
  database: Database = db,
): Promise<"pending" | "invalid" | "existing"> {
  if (!validToken(token)) return "invalid";
  return database.transaction(async (tx) => {
    // Consumption and account creation commit together, preventing token replay.
    const [request] = await tx
      .delete(googleRegistrations)
      .where(
        and(
          eq(googleRegistrations.tokenHash, digest(token)),
          gt(googleRegistrations.expires, new Date()),
        ),
      )
      .returning();
    if (!request) return "invalid";
    const id = crypto.randomUUID();
    const [created] = await tx
      .insert(users)
      .values({
        id,
        email: request.email,
        name: request.name,
        role: "student",
        isActive: false,
        approvalPending: true,
        emailVerified: new Date(),
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    // Confirmation must never change or reactivate an existing account.
    if (!created) return "existing";
    await tx
      .insert(students)
      .values({ userId: id, studentNumber: `PENDING-${id}` });
    await tx.insert(accounts).values({
      userId: id,
      type: "oidc",
      provider: "google",
      providerAccountId: request.googleId,
    });
    return "pending";
  });
}
