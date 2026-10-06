import assert from "node:assert/strict";
import { client, db } from "../src/server/db";

try {
  await client`select 1`;
  const tables = await client<{ tablename: string; rowsecurity: boolean }[]>`
    select tablename, rowsecurity from pg_tables
    where schemaname = 'public' and starts_with(tablename, 'edutrack_')
    order by tablename
  `;
  assert.equal(
    tables.length,
    14,
    "Run npm run db:migrate to create all 14 EduTrack tables.",
  );
  assert.ok(
    tables.every((table) => table.rowsecurity),
    "Every EduTrack table must have RLS enabled.",
  );
  // Exercise the same relational query used during sign-in without printing credentials.
  const users = await db.query.users.findMany({ columns: { role: true } });
  assert.ok(
    users.every((user) => user.role === "student" || user.role === "admin"),
  );
  console.log(
    "Connected to PostgreSQL. All 14 tables exist and have RLS enabled.",
  );
  console.log(
    `User accounts: ${users.length}. Roles: ${[...new Set(users.map((user) => user.role))].join(", ") || "none (run db:seed for demo accounts)"}.`,
  );
} finally {
  await client.end();
}
