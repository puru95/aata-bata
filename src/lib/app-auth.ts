// Customer app login: mobile number + 6-digit one-time code, then a bearer token.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Context } from "hono";
import { db, schema } from "../db";
import { randomToken } from "./session";

const CODE_TTL_MS = 10 * 60_000;
const MAX_CODES_PER_10_MIN = 3;
const MAX_ATTEMPTS = 5;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const codeHash = (phone: string, code: string) => sha(`${process.env.SESSION_SECRET ?? "dev"}|${phone}|${code}`);

export class AuthError extends Error {
  constructor(message: string, public status: 400 | 401 | 429 | 503 = 400, public code = "auth") {
    super(message);
  }
}

/** Fixed codes for store reviewers and testing, e.g. OTP_TEST_ACCOUNTS="+919000000000:123456". */
function testAccounts(): Map<string, string> {
  const m = new Map<string, string>();
  for (const pair of (process.env.OTP_TEST_ACCOUNTS ?? "").split(",")) {
    const [phone, code] = pair.split(":").map((x) => x.trim());
    if (phone && code && /^\d{6}$/.test(code)) m.set(phone, code);
  }
  return m;
}

/**
 * How codes are delivered. "test" (dev only) accepts OTP_TEST_CODE (default 123456) for every number.
 * A real SMS/WhatsApp provider plugs in here once chosen (see docs/BUILD-PLAN.md §8).
 */
async function deliver(phone: string, code: string) {
  const provider = process.env.OTP_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "test");
  if (provider === "test") return;
  if (provider === "console") {
    console.log(`[otp] ${phone} → ${code}`);
    return;
  }
  throw new AuthError("Sign-in by SMS isn't switched on yet. Please order from the website for now.", 503, "otp_unavailable");
}

export async function requestCode(phone: string) {
  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.authCodes)
    .where(and(eq(schema.authCodes.phone, phone), gt(schema.authCodes.createdAt, new Date(Date.now() - 10 * 60_000))));
  if (Number(recent[0]?.n ?? 0) >= MAX_CODES_PER_10_MIN) throw new AuthError("Too many codes requested. Try again in 10 minutes.", 429, "too_many");

  const fixed = testAccounts().get(phone);
  const provider = process.env.OTP_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "test");
  const code = fixed ?? (provider === "test" ? process.env.OTP_TEST_CODE || "123456" : String(randomInt(0, 1_000_000)).padStart(6, "0"));
  if (!fixed) await deliver(phone, code);
  await db.insert(schema.authCodes).values({ phone, codeHash: codeHash(phone, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
}

/** Check the code; on success create (or find) the user and return a new session token. */
export async function verifyCode(phone: string, code: string) {
  const [row] = await db
    .select()
    .from(schema.authCodes)
    .where(and(eq(schema.authCodes.phone, phone), isNull(schema.authCodes.usedAt), gt(schema.authCodes.expiresAt, new Date())))
    .orderBy(desc(schema.authCodes.createdAt))
    .limit(1);
  if (!row) throw new AuthError("That code has expired. Ask for a new one.", 400, "expired");
  if (row.attempts >= MAX_ATTEMPTS) throw new AuthError("Too many wrong tries. Ask for a new code.", 429, "too_many");

  const ok = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(codeHash(phone, code)));
  if (!ok) {
    await db.update(schema.authCodes).set({ attempts: row.attempts + 1 }).where(eq(schema.authCodes.id, row.id));
    throw new AuthError("That code isn't right. Check the SMS and try again.", 400, "wrong_code");
  }
  await db.update(schema.authCodes).set({ usedAt: new Date() }).where(eq(schema.authCodes.id, row.id));

  let [user] = await db.select().from(schema.appUsers).where(eq(schema.appUsers.phone, phone)).limit(1);
  const isNew = !user;
  if (!user) [user] = await db.insert(schema.appUsers).values({ phone }).returning();
  const token = randomToken(32);
  await db.insert(schema.appSessions).values({ appUserId: user!.id, tokenHash: sha(token) });
  return { token, user: user!, isNew };
}

/** The signed-in app user for this request, or null. */
export async function appUserFromRequest(c: Context) {
  const h = c.req.header("authorization") ?? "";
  const m = h.match(/^Bearer ([\w-]{20,})$/);
  if (!m) return null;
  const rows = await db
    .select({ user: schema.appUsers, sessionId: schema.appSessions.id })
    .from(schema.appSessions)
    .innerJoin(schema.appUsers, eq(schema.appUsers.id, schema.appSessions.appUserId))
    .where(and(eq(schema.appSessions.tokenHash, sha(m[1]!)), isNull(schema.appSessions.revokedAt)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  // Touch at most once an hour to keep writes low.
  void db
    .update(schema.appSessions)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(schema.appSessions.id, r.sessionId), sql`${schema.appSessions.lastSeenAt} < now() - interval '1 hour'`))
    .catch(() => {});
  return { ...r.user, sessionId: r.sessionId };
}

export async function revokeSession(sessionId: string) {
  await db.update(schema.appSessions).set({ revokedAt: new Date() }).where(eq(schema.appSessions.id, sessionId));
}
