import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { getCookie, getSignedCookie, setCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import { db, schema } from "../db";

const DEVICE_COOKIE = "atta_sid";
const OPS_COOKIE = "atta_ops";
const YEAR = 60 * 60 * 24 * 365;

const secure = () => process.env.COOKIE_SECURE === "1";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");

/** The device session for this browser, if it has one. */
export async function getDeviceSession(c: Context) {
  const token = getCookie(c, DEVICE_COOKIE);
  if (!token) return null;
  const rows = await db.select().from(schema.deviceSessions).where(eq(schema.deviceSessions.tokenHash, sha256(token))).limit(1);
  return rows[0] ?? null;
}

/** Existing device session, or a new one with a fresh cookie. */
export async function ensureDeviceSession(c: Context) {
  const existing = await getDeviceSession(c);
  if (existing) {
    await db.update(schema.deviceSessions).set({ lastSeenAt: new Date() }).where(eq(schema.deviceSessions.id, existing.id));
    return existing;
  }
  const token = randomToken(32);
  const [row] = await db.insert(schema.deviceSessions).values({ tokenHash: sha256(token) }).returning();
  setCookie(c, DEVICE_COOKIE, token, { httpOnly: true, secure: secure(), sameSite: "Lax", path: "/", maxAge: YEAR });
  return row!;
}

// Ops (founders) login -------------------------------------------------------

const opsSecret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("Set SESSION_SECRET (16+ characters) to use /ops.");
  return s;
};

export function checkAdminPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(sha256(input));
  const b = Buffer.from(sha256(expected));
  return timingSafeEqual(a, b);
}

export async function startOpsSession(c: Context) {
  const expires = Date.now() + 30 * 24 * 3600_000;
  await setSignedCookie(c, OPS_COOKIE, String(expires), opsSecret(), {
    httpOnly: true, secure: secure(), sameSite: "Strict", path: "/ops", maxAge: 30 * 24 * 3600,
  });
}

export async function isOps(c: Context) {
  if (!process.env.SESSION_SECRET) return false;
  const v = await getSignedCookie(c, opsSecret(), OPS_COOKIE);
  return typeof v === "string" && Number(v) > Date.now();
}

export const endOpsSession = (c: Context) => deleteCookie(c, OPS_COOKIE, { path: "/ops" });
