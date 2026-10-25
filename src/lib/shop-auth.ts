// Shop panel sign-in. Admin creates a one-time setup link per staff member; they open it on their phone and pick a
// 4-digit PIN. The phone remembers who they are, so later sign-ins need only the PIN.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { db, schema } from "../db";
import { weakPin } from "../domain/pin";

const SESSION_COOKIE = "atta_shop";
const DEVICE_COOKIE = "atta_shop_u"; // which staff member uses this phone; not a credential on its own
const LINK_HOURS = 48;
const SESSION_IDLE_DAYS = 7;
export const MAX_PIN_TRIES = 5;

const secure = () => process.env.COOKIE_SECURE === "1";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(24).toString("base64url");

export class ShopAuthError extends Error {}

export type ShopUser = typeof schema.shopUsers.$inferSelect;
export type Shop = typeof schema.shops.$inferSelect;

// PINs -------------------------------------------------------------------------

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

function pinMatches(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(pin, salt, 32));
}

// Setup links ------------------------------------------------------------------

/** New one-time link for a staff member. Clears their PIN and signs out their other phones. */
export async function issueSetupLink(shopUserId: string) {
  const t = token();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.shopUsers)
      .set({ linkTokenHash: sha256(t), linkExpiresAt: new Date(Date.now() + LINK_HOURS * 3600_000), pinHash: null, failedPins: 0 })
      .where(eq(schema.shopUsers.id, shopUserId));
    await revokeAllSessions(shopUserId, tx);
  });
  return t;
}

/** The active staff member a setup link belongs to, if it's still valid. */
export async function userForLink(t: string) {
  if (!/^[\w-]{20,64}$/.test(t)) return null;
  const [row] = await db
    .select({ user: schema.shopUsers, shop: schema.shops })
    .from(schema.shopUsers)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.shopUsers.shopId))
    .where(eq(schema.shopUsers.linkTokenHash, sha256(t)))
    .limit(1);
  if (!row || !row.user.active || !row.shop.active) return null;
  if (!row.user.linkExpiresAt || row.user.linkExpiresAt.getTime() < Date.now()) return null;
  return row;
}

/** Use a setup link: set the PIN, burn the link, sign this phone in. */
export async function completeSetup(c: Context, t: string, pin: string) {
  const row = await userForLink(t);
  if (!row) throw new ShopAuthError("This link has expired or was already used. Ask for a new one.");
  const weak = weakPin(pin);
  if (weak) throw new ShopAuthError(weak);
  await db
    .update(schema.shopUsers)
    .set({ pinHash: hashPin(pin), linkTokenHash: null, linkExpiresAt: null, failedPins: 0 })
    .where(eq(schema.shopUsers.id, row.user.id));
  await startSession(c, row.user.id);
}

// Sessions ---------------------------------------------------------------------

async function startSession(c: Context, shopUserId: string) {
  const t = token();
  await db.insert(schema.shopSessions).values({ shopUserId, tokenHash: sha256(t) });
  const opts = { httpOnly: true, secure: secure(), sameSite: "Lax" as const, path: "/shop" };
  setCookie(c, SESSION_COOKIE, t, { ...opts, maxAge: SESSION_IDLE_DAYS * 86400 });
  setCookie(c, DEVICE_COOKIE, shopUserId, { ...opts, maxAge: 365 * 86400 });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function revokeAllSessions(shopUserId: string, tx: Tx | typeof db = db) {
  await tx
    .update(schema.shopSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.shopSessions.shopUserId, shopUserId), isNull(schema.shopSessions.revokedAt)));
}

/** Signed-in staff member and their shop, or null. Slides the idle timeout. */
export async function currentShopUser(c: Context) {
  const t = getCookie(c, SESSION_COOKIE);
  if (!t) return null;
  const [row] = await db
    .select({ session: schema.shopSessions, user: schema.shopUsers, shop: schema.shops })
    .from(schema.shopSessions)
    .innerJoin(schema.shopUsers, eq(schema.shopUsers.id, schema.shopSessions.shopUserId))
    .innerJoin(schema.shops, eq(schema.shops.id, schema.shopUsers.shopId))
    .where(eq(schema.shopSessions.tokenHash, sha256(t)))
    .limit(1);
  if (!row || row.session.revokedAt || !row.user.active || !row.shop.active) return null;
  if (Date.now() - row.session.lastSeenAt.getTime() > SESSION_IDLE_DAYS * 86400_000) return null;
  if (Date.now() - row.session.lastSeenAt.getTime() > 3600_000)
    await db.update(schema.shopSessions).set({ lastSeenAt: new Date() }).where(eq(schema.shopSessions.id, row.session.id));
  return { user: row.user, shop: row.shop };
}

/** The staff member this phone was set up for (for the PIN screen), or null. */
export async function rememberedUser(c: Context) {
  const id = getCookie(c, DEVICE_COOKIE);
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db
    .select({ user: schema.shopUsers, shop: schema.shops })
    .from(schema.shopUsers)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.shopUsers.shopId))
    .where(eq(schema.shopUsers.id, id))
    .limit(1);
  return row && row.user.active && row.shop.active && row.user.pinHash ? row : null;
}

/** PIN sign-in for the remembered staff member. Locks after MAX_PIN_TRIES wrong PINs until admin sends a new link. */
export async function signInWithPin(c: Context, pin: string) {
  const row = await rememberedUser(c);
  if (!row) throw new ShopAuthError("This phone isn't set up. Ask for a login link.");
  const { user } = row;
  if (user.failedPins >= MAX_PIN_TRIES) throw new ShopAuthError("Too many wrong PINs. Ask for a new login link.");
  if (!/^\d{4}$/.test(pin) || !pinMatches(pin, user.pinHash!)) {
    const tries = user.failedPins + 1;
    await db.update(schema.shopUsers).set({ failedPins: tries }).where(eq(schema.shopUsers.id, user.id));
    const left = MAX_PIN_TRIES - tries;
    throw new ShopAuthError(left > 0 ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong PINs. Ask for a new login link.");
  }
  if (user.failedPins) await db.update(schema.shopUsers).set({ failedPins: 0 }).where(eq(schema.shopUsers.id, user.id));
  await startSession(c, user.id);
}

export async function signOut(c: Context) {
  const t = getCookie(c, SESSION_COOKIE);
  if (t) await db.update(schema.shopSessions).set({ revokedAt: new Date() }).where(eq(schema.shopSessions.tokenHash, sha256(t)));
  deleteCookie(c, SESSION_COOKIE, { path: "/shop" });
}

/** Forget this phone entirely ("Not you?"). */
export const forgetDevice = (c: Context) => deleteCookie(c, DEVICE_COOKIE, { path: "/shop" });
