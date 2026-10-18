import { mkdirSync } from "node:fs";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Production: DATABASE_URL (Supabase pooler, transaction mode → prepare: false).
 * Local: PGlite, a real Postgres running in-process, stored in ./.data. No Docker needed.
 */
async function connect(): Promise<{ db: DB; kind: "postgres" | "pglite"; close: () => Promise<void> }> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { prepare: false, max: 5 });
    return { db: drizzle(client, { schema }), kind: "postgres", close: () => client.end() };
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set for this Vercel environment. Add it in Project → Settings → Environment Variables, then redeploy.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  mkdirSync(".data", { recursive: true });
  const client = new PGlite(".data/pglite");
  return { db: drizzle(client, { schema }) as unknown as DB, kind: "pglite", close: () => client.close() };
}

export const conn = await connect();
export const db = conn.db;
export { schema };
