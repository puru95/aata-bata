import { conn } from "./index";

if (conn.kind === "postgres") {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(conn.db, { migrationsFolder: "./drizzle" });
} else {
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(conn.db as any, { migrationsFolder: "./drizzle" });
}
console.log(`Migrated (${conn.kind}).`);
await conn.close();
