import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env";
import {
  attendance,
  emailLogs,
  notifications,
  students,
  users,
} from "~/server/db/schema";
import { roleProcedure } from "~/server/api/trpc";

const admin = roleProcedure(["admin"]);
const idInput = z.object({ id: z.number().int().positive() });
const headers = () => ({
  Authorization: `Bearer ${env.RESEND_API_KEY}`,
  "Content-Type": "application/json",
});
const ready = () => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Configure RESEND_API_KEY and EMAIL_FROM, then restart EduTrack.",
    });
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export const guardianEmailProcedures = {
  emailHistory: admin.query(({ ctx }) =>
    ctx.db
      .select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.createdAt), desc(emailLogs.id)),
  ),
  cancelEmail: admin.input(idInput).mutation(({ ctx, input }) =>
    ctx.db
      .update(emailLogs)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(emailLogs.id, input.id),
          inArray(emailLogs.status, ["pending", "failed"]),
        ),
      ),
  ),
  sendEmail: admin.input(idInput).mutation(async ({ ctx, input }) => {
    ready();
    const log = await ctx.db.query.emailLogs.findFirst({
      where: eq(emailLogs.id, input.id),
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
      !user?.isActive ||
      !student?.guardianEmailConsent ||
      student.guardianEmail !== log.toEmail
    )
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Guardian email, consent, or student access changed. Cancel this email and prepare a new notification.",
      });
    if (notice.attendanceId) {
      const record = await ctx.db.query.attendance.findFirst({
        where: eq(attendance.id, notice.attendanceId),
      });
      if (record?.status !== "absent")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This absence was corrected. Cancel this email.",
        });
    }
    const [claimed] = await ctx.db
      .update(emailLogs)
      .set({ status: "sending", errorMessage: null })
      .where(
        and(
          eq(emailLogs.id, log.id),
          inArray(emailLogs.status, ["pending", "failed"]),
        ),
      )
      .returning();
    if (!claimed)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This email has already been sent, cancelled, or claimed for sending.",
      });
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          ...headers(),
          "Idempotency-Key": `guardian-email/${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          from: `EduTrack <${env.EMAIL_FROM}>`,
          to: [claimed.toEmail],
          subject: notice.attendanceId
            ? "EduTrack attendance alert"
            : "A message from EduTrack",
          text: claimed.message,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#123c3a"><h1>EduTrack</h1><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(claimed.message)}</p><hr><p style="font-size:13px">You receive these school notifications with guardian consent. Contact the school to update your preferences.</p></div>`,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const status =
          response.status >= 500 || response.status === 408
            ? "unknown"
            : "failed";
        await ctx.db
          .update(emailLogs)
          .set({
            status,
            errorMessage:
              response.status === 403
                ? "Resend rejected this recipient or sender. The test sender can only email your Resend account address; other recipients require a verified domain."
                : `Email provider returned HTTP ${response.status}. Check Resend logs.`,
          })
          .where(eq(emailLogs.id, log.id));
        return { status };
      }
      const result = z
        .object({ id: z.string().min(1) })
        .parse(await response.json());
      await ctx.db
        .update(emailLogs)
        .set({ status: "accepted", providerId: result.id })
        .where(eq(emailLogs.id, log.id));
      return { status: "accepted" };
    } catch {
      await ctx.db
        .update(emailLogs)
        .set({
          status: "unknown",
          errorMessage:
            "Delivery outcome is unknown. Check Resend logs before preparing another email. Automatic retry is disabled.",
        })
        .where(eq(emailLogs.id, log.id));
      return { status: "unknown" };
    }
  }),
  refreshEmail: admin.input(idInput).mutation(async ({ ctx, input }) => {
    ready();
    const log = await ctx.db.query.emailLogs.findFirst({
      where: eq(emailLogs.id, input.id),
    });
    if (!log?.providerId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No provider message ID is available. Check Resend logs.",
      });
    const response = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(log.providerId)}`,
      { headers: headers(), signal: AbortSignal.timeout(15000) },
    );
    if (response.status === 401 || response.status === 403)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Resend did not permit delivery-status lookup. A sending-only API key can send emails but cannot read their status. View delivery in the Resend dashboard, or configure a Full access API key and restart EduTrack. The email has not been resent.",
      });
    if (!response.ok)
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message:
          "Cannot retrieve delivery status. Check Resend logs; reading status requires an API key with full access.",
      });
    const result = z
      .object({ last_event: z.string().min(1).max(55) })
      .parse(await response.json());
    // Prefix prevents a provider status from becoming an actionable queue state.
    const status = `provider:${result.last_event}`;
    await ctx.db
      .update(emailLogs)
      .set({ status })
      .where(eq(emailLogs.id, log.id));
    return { status };
  }),
};
