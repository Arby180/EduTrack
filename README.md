# EduTrack

Student attendance and academic performance monitoring with Next.js, tRPC, Drizzle, NextAuth, and Supabase PostgreSQL.

## Database setup

Follow [the Supabase setup guide](docs/supabase-setup.md). The PostgreSQL schema and initial migration are ready; creating a Supabase project and configuring its connection string are required before running the app.

Only **admin** and **student** can log in. Admins manage attendance, grades, classes, accounts, and announcements. Guardian contact details and separate email/SMS consent are stored on student records; guardians do not have login accounts.

After configuring your local .env:

```sh
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev
```

On Windows PowerShell, use npm.cmd if npm.ps1 is blocked by execution policy.

## Demo accounts

The optional seed creates these two test accounts with password `edutrack123`:

- `student@edutrack.test`
- `admin@edutrack.test`

Seed only a development project. Running the seed again preserves existing passwords and does not recreate teacher or parent accounts.

## Database commands

- `npm run db:generate`: generate a migration after changing the schema.
- `npm run db:migrate`: apply versioned migrations.
- `npm run db:seed`: insert demo accounts and basic school data.
- `npm run db:check`: verify connectivity, all 14 tables, RLS, and roles.
- `npm run db:studio`: inspect the database locally.

The old `db.sqlite` file is retained locally. PostgreSQL setup creates a new database schema; it does not import SQLite records. `scripts/remove-legacy-accounts.mjs` is only for the old SQLite database and must not be run against Supabase.

## School workflows

- **People:** create/edit student or admin accounts, assign classes, reset passwords, record guardian contacts and consent, deactivate/reactivate accounts. Deactivation preserves records and blocks authentication.
- **Classes & subjects:** create/edit academic structure; deletion is blocked while related records exist.
- **Attendance:** choose class/date, mark each student, save or correct records. One record per student/day; future dates are rejected. Absences create inbox notifications and, when consent and a number exist, pending guardian texts. With a guardian email and email consent, absences also prepare guardian emails. Correcting an absence cancels unsent alerts.
- **Grades:** create/edit/delete assessments with subject, type, quarter, score, total, and remarks. Scores must be within their total. Summaries use total points earned divided by total possible points, not a school-specific weighted/transmuted grade.
- **Reports:** Chart.js attendance trends and subject performance, date/class/quarter filters, CSV exports, and printable reports. Attendance uses the selected date range; grades use the selected quarter. School days use Asia/Manila time.
- **Announcements:** publish/edit/remove notices visible to authenticated users.
- **Notifications:** student inbox with read tracking; admin composition, guardian email review queue, optional SMS, sending and delivery-status refresh. Pending messages do not send automatically. Unknown delivery outcomes are not automatically retried.

Students can only access their own attendance, grades, report data, and inbox. Admin-only procedures enforce permissions on the server. All database tables retain RLS; the privileged server connection relies on application authorization.

## Integrations

Chart.js is installed and used in dashboards and reports. Google OAuth and Twilio are implemented but need your provider credentials before live use. Follow [the integration setup guide](docs/integrations.md). Authentication remains NextAuth; Supabase Auth configuration is not required.

New Google registrations require email confirmation and administrator approval. An admin assigns a student number and class in People, then selects Approve access. See the integration guide for Resend setup.

## Verification

`npm run check` runs lint and TypeScript checks. `npm run build` produces the production build.

`npm run test:workflows` runs Supabase integration checks inside a transaction that always rolls back. It covers role restrictions, record isolation, CRUD, attendance corrections, reports, and simulated SMS delivery. It replaces Twilio HTTP calls with test responses; no real SMS is sent. Use a development database for tests.

For browser checks, build the app, run it on port 3100 with AUTH_URL=http://localhost:3100, then run `npm run test:browser`. Set PLAYWRIGHT_CHANNEL=msedge to use installed Edge, or install Chromium with `npx playwright install chromium`. The suite uses the two demo logins and checks desktop/mobile pages and CSV downloads without changing school records. Screenshots and traces are saved under the ignored test-results directory.
