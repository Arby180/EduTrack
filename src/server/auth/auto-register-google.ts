import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { accounts, students, users } from "~/server/db/schema";

type Database = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Call only after verifying Google's email_verified claim in the OAuth callback.
export async function autoRegisterGoogle(
  identity: { email: string; name: string; googleId: string },
  database: Database = db,
) {
  return database.transaction(async (tx) => {
    const email = identity.email.toLowerCase();
    const [created] = await tx
      .insert(users)
      .values({
        email,
        name: identity.name.slice(0, 255),
        role: "student",
        isActive: true,
        approvalPending: false,
        emailVerified: new Date(),
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    // Never reactivate or change roles on an existing account, including races.
    if (!created)
      return tx.query.users.findFirst({ where: eq(users.email, email) });
    await tx.insert(students).values({
      userId: created.id,
      studentNumber: `PENDING-${created.id}`,
    });
    await tx.insert(accounts).values({
      userId: created.id,
      type: "oidc",
      provider: "google",
      providerAccountId: identity.googleId,
    });
    return created;
  });
}
