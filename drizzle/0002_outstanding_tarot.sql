CREATE TABLE "edutrack_google_registration" (
	"email" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"googleId" varchar(255) NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"requestedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "edutrack_google_registration_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "edutrack_google_registration" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "edutrack_user" ADD COLUMN "approvalPending" boolean DEFAULT false NOT NULL;