import { createClient } from "@libsql/client";

// Run once against an existing SQLite database with node --env-file=.env.
const db = createClient({ url: process.env.DATABASE_URL });
await db.execute("PRAGMA foreign_keys = OFF");
const tx = await db.transaction("write");
try {
  const admin = (
    await tx.execute(
      "SELECT id FROM edutrack_user WHERE role = 'admin' LIMIT 1",
    )
  ).rows[0];
  if (!admin)
    throw new Error(
      "An admin account is required before removing legacy accounts.",
    );

  // Rebuild dependent tables while preserving records and indexes.
  for (const name of ["attendance", "grade", "class_room", "student"]) {
    const table = `edutrack_${name}`;
    const definition = (
      await tx.execute({
        sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        args: [table],
      })
    ).rows[0];
    const indexes = (
      await tx.execute({
        sql: "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL",
        args: [table],
      })
    ).rows;
    const columns = (await tx.execute(`PRAGMA table_info(${table})`)).rows
      .map((column) => column.name)
      .filter((column) => column !== "parentId");
    const columnList = columns.map((column) => `"${column}"`).join(", ");
    const sql = String(definition.sql)
      .replace(
        /CREATE TABLE\s+[`"]?\w+[`"]?/i,
        `CREATE TABLE ${table}_replacement`,
      )
      .replaceAll("`edutrack_teacher`(`userId`)", "`edutrack_user`(`id`)")
      .replace(/\s*`parentId`[^\n]*\n/, "\n")
      .replace(/,?\s*FOREIGN KEY \(`parentId`\)[^\n]*/, "");
    await tx.execute(sql);
    await tx.execute(
      `INSERT INTO ${table}_replacement (${columnList}) SELECT ${columnList} FROM ${table}`,
    );
    await tx.execute(`DROP TABLE ${table}`);
    await tx.execute(`ALTER TABLE ${table}_replacement RENAME TO ${table}`);
    for (const index of indexes) await tx.execute(String(index.sql));
  }
  for (const [table, column] of [
    ["attendance", "recordedById"],
    ["grade", "recordedById"],
    ["class_room", "adviserId"],
  ]) {
    await tx.execute({
      sql: `UPDATE edutrack_${table} SET ${column} = ? WHERE ${column} IN (SELECT id FROM edutrack_user WHERE role IN ('teacher', 'parent'))`,
      args: [admin.id],
    });
  }
  for (const table of ["account", "session"]) {
    await tx.execute(
      `DELETE FROM edutrack_${table} WHERE userId IN (SELECT id FROM edutrack_user WHERE role IN ('teacher', 'parent'))`,
    );
  }
  await tx.execute("DROP TABLE IF EXISTS edutrack_teacher");
  await tx.execute("DROP TABLE IF EXISTS edutrack_parent");
  await tx.execute(
    "DELETE FROM edutrack_user WHERE role IN ('teacher', 'parent')",
  );
  const violations = await tx.execute("PRAGMA foreign_key_check");
  if (violations.rows.length)
    throw new Error("Foreign key validation failed; rolling back.");
  await tx.commit();
  console.log(
    "Removed teacher and parent accounts; preserved academic records under admin ownership.",
  );
} catch (error) {
  await tx.rollback();
  throw error;
} finally {
  await db.execute("PRAGMA foreign_keys = ON");
  db.close();
}
