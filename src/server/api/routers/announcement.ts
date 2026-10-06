import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { announcements } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedProcedure,
  roleProcedure,
} from "~/server/api/trpc";
export const announcementRouter = createTRPCRouter({
  save: roleProcedure(["admin"])
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        title: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(10000),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return id
        ? ctx.db
            .update(announcements)
            .set(data)
            .where(eq(announcements.id, id))
            .returning()
        : ctx.db
            .insert(announcements)
            .values({ ...data, createdById: ctx.session.user.id })
            .returning();
    }),
  remove: roleProcedure(["admin"])
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      ctx.db.delete(announcements).where(eq(announcements.id, input.id)),
    ),
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.select().from(announcements).orderBy(desc(announcements.createdAt)),
  ),
});
