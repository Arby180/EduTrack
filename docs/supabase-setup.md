# Set up EduTrack on Supabase

## 1. Create the project

1. Sign in at https://supabase.com/dashboard.
2. Choose **New project**, select your organization, and name the project **EduTrack**.
3. Set a strong database password and store it privately.
4. Choose a nearby region and create the project. Wait for provisioning to finish.

## 2. Configure the connection

Open **Connect** in the project dashboard. Copy the PostgreSQL URI for **Session pooler**, port **5432**. This supports IPv4 networks and works for both local development and migrations.

In your local `.env`, replace only `DATABASE_URL`, preserving `AUTH_SECRET`:

```dotenv
DATABASE_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require"
```

Use the exact project reference and hostname from Connect. Replace the password placeholder with your database password, URL-encoding special characters (for example, @ becomes %40 and # becomes %23). Keep this value on your machine; do not paste it into chat or commit .env.

This is a PostgreSQL connection URI, not the https project URL or a publishable/anon API key. The existing T3 app accesses the database through Drizzle on the server. It does not need Supabase JS or a browser API key.

For a future serverless deployment, runtime `DATABASE_URL` can use the transaction pooler on port 6543. Set `DATABASE_MIGRATION_URL` to the session pooler on port 5432 (or a reachable direct connection) for migrations and Studio. The runtime driver disables prepared statements and requires TLS.

## 3. Apply the schema

From the project directory:

```sh
npm run db:migrate
npm run db:check
```

Use `npm.cmd` instead of `npm` if PowerShell blocks npm.ps1. Node.js 22 is supported; the scripts load .env explicitly.

The migration in `drizzle/0000_supabase_initial.sql` creates 12 tables in the public schema:

| Table                       | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| edutrack_user               | User profiles, password hashes, and student/admin roles           |
| edutrack_student            | Student numbers, class membership, grade level, guardian contacts |
| edutrack_class_room         | Classes, grade levels, school years, admin adviser                |
| edutrack_subject            | Subjects belonging to a class                                     |
| edutrack_attendance         | Daily attendance, remarks, recording admin                        |
| edutrack_grade              | Assessment scores, quarter, remarks, recording admin              |
| edutrack_announcement       | School announcements                                              |
| edutrack_notification       | Notifications, recipient, read time, attendance link              |
| edutrack_sms_log            | SMS review queue and delivery tracking                                      |
| edutrack_account            | NextAuth OAuth account links for Google login              |
| edutrack_session            | NextAuth adapter sessions (current login uses JWTs)               |
| edutrack_verification_token | NextAuth verification tokens                                      |

Foreign keys protect relationships. PostgreSQL enums restrict roles and status values. Attendance is unique per student/day. Grade checks enforce positive totals, scores within the total, and quarters from 1 to 4 when supplied. These fields prepare the database; their full UI workflows come later.

Do not manually run the SQL and then run db:migrate: the migration command keeps its own history. Prefer db:migrate over db:push so schema changes are versioned.

## 4. Add development accounts

```sh
npm run db:seed
npm run db:check
npm run dev
```

Visit http://localhost:3000/login. Demo emails are student@edutrack.test and admin@edutrack.test; both initially use edutrack123. Seed only a development database. Existing passwords are preserved on repeat runs.

The seed runs in a transaction and closes its connection when finished. It also adds a 3A classroom, Mathematics subject, and welcome announcement.

## Access model

Every application table has Row Level Security enabled with no public access policies. Browser Supabase Data API requests cannot read or write these tables. Drizzle uses a privileged server database connection; NextAuth and tRPC are responsible for per-user authorization. RLS does not impose student-level restrictions on that privileged connection.

The database password must remain server-only. Supabase Auth is not configured in this stage. Because this app only uses Drizzle, you may disable the Supabase Data API in project API settings.

## Existing local data

The old SQLite file is retained and is not automatically imported. Do not point the legacy remove-legacy-accounts.mjs script at Supabase. A fresh Supabase project receives the new schema and, optionally, demo seed data.

## Troubleshooting

- **Invalid DATABASE_URL**: replace the old file:./db.sqlite value with the PostgreSQL URI.
- **Password authentication failed**: confirm the database password and URL encoding, and copy the complete pooler username.
- **Connection timeout**: confirm the project is active and use the session pooler on port 5432 for an IPv4 network.
- **Relation does not exist**: run db:migrate against the same project used by DATABASE_URL.
- **Empty tables**: run db:seed if you want the development demo accounts.

References: [Supabase with Drizzle](https://supabase.com/docs/guides/database/drizzle), [connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres), [Drizzle RLS](https://orm.drizzle.team/docs/rls).
