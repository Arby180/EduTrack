ALTER TABLE "edutrack_attendance" ADD COLUMN "classRoomId" integer;--> statement-breakpoint
ALTER TABLE "edutrack_student" ADD COLUMN "guardianSmsConsent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "edutrack_user" ADD COLUMN "isActive" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "edutrack_attendance" ADD CONSTRAINT "edutrack_attendance_classRoomId_edutrack_class_room_id_fk" FOREIGN KEY ("classRoomId") REFERENCES "public"."edutrack_class_room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "edutrack_attendance" AS a SET "classRoomId" = s."classRoomId" FROM "edutrack_student" AS s WHERE a."studentId" = s."userId" AND a."classRoomId" IS NULL;
