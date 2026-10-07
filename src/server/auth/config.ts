import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "~/env";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { verifyPassword } from "~/server/auth/password";
import { autoRegisterGoogle } from "~/server/auth/auto-register-google";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: "student" | "admin";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "student" | "admin";
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_ID,
            clientSecret: env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);
        if (!parsed.success) return null;
        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email.toLowerCase()),
        });
        if (
          !user?.passwordHash ||
          !user.isActive ||
          user.approvalPending ||
          (user.role !== "student" && user.role !== "admin") ||
          !(await verifyPassword(parsed.data.password, user.passwordHash))
        )
          return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (
        profile?.email_verified !== true ||
        !profile.email ||
        !account.providerAccountId
      )
        return false;
      const existing = await db.query.users.findFirst({
        where: eq(users.email, profile.email.toLowerCase()),
      });
      if (existing) {
        if (existing.approvalPending) return "/login?error=ApprovalPending";
        return existing.isActive;
      }
      const created = await autoRegisterGoogle({
        email: profile.email.toLowerCase(),
        name: (profile.name ?? profile.email).slice(0, 255),
        googleId: account.providerAccountId,
      });
      return (
        !!created?.isActive &&
        !created.approvalPending &&
        (created.role === "student" || created.role === "admin")
      );
    },
    async jwt({ token, user }) {
      const id = user?.id ?? token.id;
      if (typeof id !== "string") return null;
      const current = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      if (
        !current?.isActive ||
        current.approvalPending ||
        (current.role !== "student" && current.role !== "admin")
      )
        return null;
      return {
        ...token,
        id: current.id,
        role: current.role,
        name: current.name,
        email: current.email,
      };
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
        role: token.role as "student" | "admin",
      },
    }),
  },
} satisfies NextAuthConfig;
