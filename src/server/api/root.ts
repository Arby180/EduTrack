import { reportRouter } from "~/server/api/routers/report";
import { notificationRouter } from "~/server/api/routers/notification";
import { adminRouter } from "~/server/api/routers/admin";
import { announcementRouter } from "~/server/api/routers/announcement";
import { attendanceRouter } from "~/server/api/routers/attendance";
import { gradeRouter } from "~/server/api/routers/grade";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  attendance: attendanceRouter,
  grade: gradeRouter,
  announcement: announcementRouter,
  admin: adminRouter,
  report: reportRouter,
  notification: notificationRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
