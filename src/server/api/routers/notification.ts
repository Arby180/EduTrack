import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env";
import {
  attendance,
  notifications,
  smsLogs,
  emailLogs,
  students,
  users,
} from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedProcedure,
  roleProcedure,
} from "~/server/api/trpc";
import { guardianEmailProcedures } from "./guardian-email";

const ready = () =>
  !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
const twilioResult = z.object({
  sid: z.string(),
  status: z.string(),
  error_code: z.number().nullable().optional(),
});
const authorization = () =>
  `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
export const notificationRouter = createTRPCRouter({
  ...guardianEmailProcedures,
  integrationStatus: roleProcedure(["admin"]).query(() => ({
    google: !!(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    twilio: ready(),
    email: !!(env.RESEND_API_KEY && env.EMAIL_FROM),
    emailTestMode: env.EMAIL_FROM?.endsWith("@resend.dev") ?? false,
  })),
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(notifications)
      .where(
        ctx.session.user.role === "admin"
          ? undefined
          : eq(notifications.recipientId, ctx.session.user.id),
      )
      .orderBy(desc(notifications.createdAt)),
  ),
  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.recipientId, ctx.session.user.id),
          ),
        ),
    ),
  smsHistory: roleProcedure(["admin"]).query(({ ctx }) =>
    ctx.db
      .select({
        id: smsLogs.id,
        notificationId: smsLogs.notificationId,
        to: smsLogs.toPhoneNumber,
        status: smsLogs.status,
        sid: smsLogs.twilioSid,
        error: smsLogs.errorMessage,
        createdAt: smsLogs.createdAt,
        message: notifications.message,
      })
      .from(smsLogs)
      .innerJoin(notifications, eq(notifications.id, smsLogs.notificationId))
      .orderBy(desc(smsLogs.createdAt)),
  ),
  compose: roleProcedure(["admin"])
    .input(
      z.object({
        studentIds: z.array(z.string().min(1)).min(1).max(200),
        message: z.string().trim().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ids = [...new Set(input.studentIds)];
      return ctx.db.transaction(async (tx) => {
        const recipients = await tx
          .select({
            id: students.userId,
            phone: students.guardianPhone,
            consent: students.guardianSmsConsent,
            email: students.guardianEmail,
            emailConsent: students.guardianEmailConsent,
          })
          .from(students)
          .innerJoin(users, eq(users.id, students.userId))
          .where(and(inArray(students.userId, ids), eq(users.isActive, true)));
        let queued = 0;
        let emailsQueued = 0;
        for (const recipient of recipients) {
          const [notice] = await tx
            .insert(notifications)
            .values({ recipientId: recipient.id, message: input.message })
            .returning();
          if (notice && recipient.email && recipient.emailConsent) {
            await tx
              .insert(emailLogs)
              .values({
                notificationId: notice.id,
                toEmail: recipient.email,
                message: input.message,
              });
            emailsQueued++;
          }
          if (notice && recipient.phone && recipient.consent) {
            await tx.insert(smsLogs).values({
              notificationId: notice.id,
              toPhoneNumber: recipient.phone,
              status: "pending",
            });
            queued++;
          }
        }
        return { notified: recipients.length, queued, emailsQueued };
      });
    }),
  cancelSms: roleProcedure(["admin"])
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(smsLogs)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(smsLogs.id, input.id),
            inArray(smsLogs.status, ["pending", "failed"]),
          ),
        ),
    ),
  sendSms: roleProcedure(["admin"])
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ready())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Twilio is not connected yet. Add its credentials to .env and restart the app.",
        });
      const log = await ctx.db.query.smsLogs.findFirst({
        where: eq(smsLogs.id, input.id),
      });
      if (!log) throw new TRPCError({ code: "NOT_FOUND" });
      const notice = await ctx.db.query.notifications.findFirst({
        where: eq(notifications.id, log.notificationId),
      });
      const student = notice?.recipientId
        ? await ctx.db.query.students.findFirst({
            where: eq(students.userId, notice.recipientId),
          })
        : null;
      const user = student
        ? await ctx.db.query.users.findFirst({
            where: eq(users.id, student.userId),
          })
        : null;
      if (
        !notice ||
        !student?.guardianSmsConsent ||
        !student.guardianPhone ||
        !user?.isActive ||
        student.guardianPhone !== log.toPhoneNumber
      )
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Recipient details or SMS consent changed. Cancel this text and create a new notification.",
        });
      if (notice.attendanceId) {
        const record = await ctx.db.query.attendance.findFirst({
          where: eq(attendance.id, notice.attendanceId),
        });
        if (record?.status !== "absent")
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This absence was corrected. Cancel this text.",
          });
      }
      const claimed = await ctx.db
        .update(smsLogs)
        .set({ status: "sending", errorMessage: null })
        .where(
          and(
            eq(smsLogs.id, input.id),
            inArray(smsLogs.status, ["pending", "failed"]),
          ),
        )
        .returning();
      if (!claimed.length)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This text has already been sent, cancelled, or claimed for sending.",
        });
      // A timeout has an unknown delivery outcome. Never automatically retry it.
      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: authorization(),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: log.toPhoneNumber,
              From: env.TWILIO_FROM_NUMBER!,
              Body: notice.message,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok) {
          await ctx.db
            .update(smsLogs)
            .set({
              status: response.status >= 500 ? "unknown" : "failed",
              errorMessage: `Twilio returned HTTP ${response.status}. Check the Twilio console.`,
            })
            .where(eq(smsLogs.id, log.id));
          return { status: response.status >= 500 ? "unknown" : "failed" };
        }
        const result = twilioResult.parse(await response.json());
        await ctx.db
          .update(smsLogs)
          .set({ status: result.status, twilioSid: result.sid })
          .where(eq(smsLogs.id, log.id));
        return { status: result.status };
      } catch {
        await ctx.db
          .update(smsLogs)
          .set({
            status: "unknown",
            errorMessage:
              "Delivery could not be confirmed. Check Twilio before sending another text.",
          })
          .where(eq(smsLogs.id, log.id));
        return { status: "unknown" };
      }
    }),
  refreshSms: roleProcedure(["admin"])
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ready())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Twilio is not configured.",
        });
      const log = await ctx.db.query.smsLogs.findFirst({
        where: eq(smsLogs.id, input.id),
      });
      if (!log?.twilioSid)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No Twilio message ID is available. Check the Twilio console.",
        });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages/${encodeURIComponent(log.twilioSid)}.json`,
        {
          headers: { Authorization: authorization() },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Twilio status could not be retrieved.",
        });
      const result = twilioResult.parse(await response.json());
      await ctx.db
        .update(smsLogs)
        .set({
          status: result.status,
          errorMessage: result.error_code
            ? `Twilio error ${result.error_code}`
            : null,
        })
        .where(eq(smsLogs.id, log.id));
      return { status: result.status };
    }),
});
