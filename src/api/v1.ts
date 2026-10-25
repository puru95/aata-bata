// JSON API for the customer app. Bearer-token auth; errors are { error, field?, code? }.
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { availableSlots, loadCatalog } from "../lib/catalog";
import { blendInput, createOrder, OrderError, transitionOrder } from "../lib/orders";
import { appUserFromRequest, AuthError, requestCode, revokeSession, verifyCode } from "../lib/app-auth";
import { normalizeIndianMobile, orderNumber } from "../lib/format";
import { quote, SIZES_GRAMS, STEP_GRAMS, validateBlend } from "../domain/pricing";
import { STATUS_LABEL, TIMELINE, timelineIndex, type Status } from "../domain/order-status";

type AppUser = NonNullable<Awaited<ReturnType<typeof appUserFromRequest>>>;
type Env = { Variables: { user: AppUser } };

export const api = new Hono<Env>();
api.use("*", cors({ origin: "*", allowHeaders: ["authorization", "content-type"], allowMethods: ["GET", "POST", "PATCH", "DELETE"] }));

const fail = (c: Context, status: 400 | 401 | 404 | 409 | 429 | 503, error: string, extra: { field?: string; code?: string } = {}) =>
  c.json({ error, ...extra }, status);

async function body<T extends z.ZodTypeAny>(c: Context, s: T): Promise<z.infer<T> | null> {
  const raw = await c.req.json().catch(() => null);
  const r = s.safeParse(raw);
  return r.success ? r.data : null;
}

// Simple per-IP limiter for auth endpoints.
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
const ip = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";

api.onError((err, c) => {
  if (err instanceof AuthError) return fail(c, err.status, err.message, { code: err.code });
  if (err instanceof OrderError) return fail(c, err.code === "not_found" ? 404 : 400, err.message, { field: err.field, code: err.code });
  console.error(err);
  return c.json({ error: "Something went wrong on our side. Please try again." }, 500);
});

// Public --------------------------------------------------------------------------

api.get("/catalog", async (c) => {
  const cat = await loadCatalog();
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    grains: cat.grains.map((g) => ({ id: g.id, name: g.name, nameHi: g.nameHi, tip: g.tip, color: g.color, sellPaisePerKg: g.sellPaisePerKg, nutrition: g.nutrition })),
    presets: cat.presets.map((p) => ({ id: p.id, name: p.name, description: p.description, ratio: p.ratio })),
    price: { grindChargePaisePerKg: cat.settings.grindChargePaisePerKg, deliveryChargePaise: cat.settings.deliveryChargePaise },
    societies: cat.societies.map((s) => s.name),
    sizesGrams: SIZES_GRAMS,
    stepGrams: STEP_GRAMS,
    upiId: cat.settings.upiId,
    whatsappNumber: cat.settings.whatsappNumber,
  });
});

api.get("/slots", async (c) => {
  const cat = await loadCatalog();
  const slots = await availableSlots(cat.settings.cutoffHours, cat.settings.daysAhead);
  c.header("Cache-Control", "no-store");
  return c.json({ slots });
});

const blendSchema = z.object(blendInput);
api.post("/quote", async (c) => {
  const b = await body(c, blendSchema);
  if (!b) return fail(c, 400, "Send sizeGrams, grind and lines.");
  const cat = await loadCatalog();
  const err = validateBlend(b.lines, b.sizeGrams, new Set(cat.grains.map((g) => g.id)));
  const q = quote(b.lines, cat.grains, cat.settings);
  return c.json({ valid: !err, error: err?.message, totalPaise: q.totalPaise, perKgPaise: q.perKgPaise, grainSubtotalPaise: q.grainSubtotalPaise, grindChargePaise: q.grindChargePaise, deliveryChargePaise: q.deliveryChargePaise, bags: q.bags });
});

// Auth ----------------------------------------------------------------------------

api.post("/auth/otp", async (c) => {
  const b = await body(c, z.object({ phone: z.string().max(20) }));
  const phone = b && normalizeIndianMobile(b.phone);
  if (!phone) return fail(c, 400, "Enter a 10-digit mobile number", { field: "phone" });
  if (limited("otp:" + ip(c), 10, 3600_000)) return fail(c, 429, "Too many requests from this network. Try again later.", { code: "too_many" });
  await requestCode(phone);
  return c.json({ ok: true, phone });
});

api.post("/auth/verify", async (c) => {
  const b = await body(c, z.object({ phone: z.string().max(20), code: z.string().max(6) }));
  const phone = b && normalizeIndianMobile(b.phone);
  if (!b || !phone) return fail(c, 400, "Enter a 10-digit mobile number", { field: "phone" });
  if (limited("verify:" + ip(c), 30, 3600_000)) return fail(c, 429, "Too many tries. Try again later.", { code: "too_many" });
  const { token, user, isNew } = await verifyCode(phone, b.code.trim());
  return c.json({ token, isNew, user: publicUser(user) });
});

// Signed-in -----------------------------------------------------------------------

const authed = new Hono<Env>();
authed.use("*", async (c, next) => {
  const user = await appUserFromRequest(c);
  if (!user) return fail(c, 401, "Please sign in again.", { code: "auth" });
  c.set("user", user);
  c.header("Cache-Control", "private, no-store");
  return next();
});

const publicUser = (u: { id: string; phone: string; name: string; language: string }) => ({ id: u.id, phone: u.phone, name: u.name, language: u.language });

authed.post("/auth/logout", async (c) => {
  await revokeSession(c.get("user").sessionId);
  return c.json({ ok: true });
});

authed.get("/me", (c) => c.json({ user: publicUser(c.get("user")) }));

authed.patch("/me", async (c) => {
  const b = await body(c, z.object({ name: z.string().trim().min(1).max(80).optional(), language: z.enum(["en", "hi"]).optional() }));
  if (!b) return fail(c, 400, "Check your name and language.");
  const [u] = await db.update(schema.appUsers).set(b).where(eq(schema.appUsers.id, c.get("user").id)).returning();
  return c.json({ user: publicUser(u!) });
});

// Addresses
const addressSchema = z.object({
  label: z.string().trim().max(30).optional().default("Home"),
  societyName: z.string().trim().min(1).max(120),
  tower: z.string().trim().min(1).max(20),
  flat: z.string().trim().min(1).max(20),
  note: z.string().trim().max(200).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

authed.get("/addresses", async (c) => {
  const rows = await db.select().from(schema.addresses).where(eq(schema.addresses.appUserId, c.get("user").id)).orderBy(desc(schema.addresses.isDefault), asc(schema.addresses.createdAt));
  return c.json({ addresses: rows.map(({ appUserId: _, ...a }) => a) });
});

authed.post("/addresses", async (c) => {
  const b = await body(c, addressSchema);
  if (!b) return fail(c, 400, "Add your society, tower and flat.");
  const cat = await loadCatalog();
  if (!cat.societies.some((s) => s.name === b.societyName)) return fail(c, 400, "We don't deliver to that society yet.", { field: "societyName" });
  const uid = c.get("user").id;
  const existing = await db.select({ id: schema.addresses.id }).from(schema.addresses).where(eq(schema.addresses.appUserId, uid)).limit(1);
  const makeDefault = b.isDefault || existing.length === 0;
  const row = await db.transaction(async (tx) => {
    if (makeDefault) await tx.update(schema.addresses).set({ isDefault: false }).where(eq(schema.addresses.appUserId, uid));
    const [r] = await tx.insert(schema.addresses).values({ ...b, isDefault: makeDefault, appUserId: uid }).returning();
    return r!;
  });
  const { appUserId: _, ...a } = row;
  return c.json({ address: a }, 201);
});

authed.delete("/addresses/:id", async (c) => {
  await db.delete(schema.addresses).where(and(eq(schema.addresses.id, c.req.param("id")), eq(schema.addresses.appUserId, c.get("user").id)));
  return c.json({ ok: true });
});

// Saved blends
const savedBlendSchema = z.object({ name: z.string().trim().min(1).max(40), ...blendInput });

authed.get("/blends", async (c) => {
  const rows = await db.select().from(schema.savedBlends).where(eq(schema.savedBlends.appUserId, c.get("user").id)).orderBy(desc(schema.savedBlends.updatedAt));
  return c.json({ blends: rows.map(({ appUserId: _, ...b }) => b) });
});

async function checkBlend(b: z.infer<typeof savedBlendSchema>) {
  const cat = await loadCatalog();
  return validateBlend(b.lines, b.sizeGrams, new Set(cat.grains.map((g) => g.id)));
}

authed.post("/blends", async (c) => {
  const b = await body(c, savedBlendSchema);
  if (!b) return fail(c, 400, "Give the blend a name.");
  const err = await checkBlend(b);
  if (err) return fail(c, 400, err.message, { code: err.code });
  const [row] = await db.insert(schema.savedBlends).values({ ...b, appUserId: c.get("user").id }).returning();
  const { appUserId: _, ...out } = row!;
  return c.json({ blend: out }, 201);
});

authed.patch("/blends/:id", async (c) => {
  const b = await body(c, savedBlendSchema);
  if (!b) return fail(c, 400, "Give the blend a name.");
  const err = await checkBlend(b);
  if (err) return fail(c, 400, err.message, { code: err.code });
  const [row] = await db
    .update(schema.savedBlends)
    .set({ ...b, updatedAt: new Date() })
    .where(and(eq(schema.savedBlends.id, c.req.param("id")), eq(schema.savedBlends.appUserId, c.get("user").id)))
    .returning();
  if (!row) return fail(c, 404, "Blend not found.");
  const { appUserId: _, ...out } = row;
  return c.json({ blend: out });
});

authed.delete("/blends/:id", async (c) => {
  await db.delete(schema.savedBlends).where(and(eq(schema.savedBlends.id, c.req.param("id")), eq(schema.savedBlends.appUserId, c.get("user").id)));
  return c.json({ ok: true });
});

// Orders
const appOrderSchema = z.object({
  ...blendInput,
  slot: z.string(),
  payment: z.enum(["upi", "cod"]),
  addressId: z.string().uuid(),
  name: z.string().trim().max(80).optional(),
  note: z.string().trim().max(200).optional().default(""),
});

authed.post("/orders", async (c) => {
  const b = await body(c, appOrderSchema);
  if (!b) return fail(c, 400, "Some details are missing. Please check and try again.");
  const user = c.get("user");
  const [addr] = await db.select().from(schema.addresses).where(and(eq(schema.addresses.id, b.addressId), eq(schema.addresses.appUserId, user.id))).limit(1);
  if (!addr) return fail(c, 400, "Pick a delivery address.", { field: "addressId" });
  const name = b.name || user.name;
  if (!name) return fail(c, 400, "Add your name in Profile first.", { field: "name" });
  if (b.name && b.name !== user.name) await db.update(schema.appUsers).set({ name: b.name }).where(eq(schema.appUsers.id, user.id));
  const order = await createOrder(
    {
      sizeGrams: b.sizeGrams,
      grind: b.grind,
      lines: b.lines,
      slot: b.slot,
      payment: b.payment,
      name,
      phone: user.phone,
      society: addr.societyName,
      tower: addr.tower,
      flat: addr.flat,
      note: [addr.note, b.note].filter(Boolean).join(" · "),
    },
    { source: "app", appUserId: user.id },
  );
  return c.json({ order: await orderJson(order.id) }, 201);
});

authed.get("/orders", async (c) => {
  const rows = await db.select().from(schema.orders).where(eq(schema.orders.appUserId, c.get("user").id)).orderBy(desc(schema.orders.createdAt)).limit(50);
  return c.json({ orders: rows.map(orderSummary) });
});

authed.get("/orders/:id", async (c) => {
  const id = c.req.param("id");
  const [o] = await db.select({ id: schema.orders.id }).from(schema.orders).where(and(eq(schema.orders.id, id), eq(schema.orders.appUserId, c.get("user").id))).limit(1);
  if (!o) return fail(c, 404, "Order not found.");
  return c.json({ order: await orderJson(id) });
});

authed.post("/orders/:id/cancel", async (c) => {
  await transitionOrder(c.req.param("id"), "CANCELLED", { role: "customer", appUserId: c.get("user").id }, { note: "Cancelled in app" });
  return c.json({ order: await orderJson(c.req.param("id")) });
});

authed.post("/push-token", async (c) => {
  const b = await body(c, z.object({ token: z.string().min(10).max(200), platform: z.enum(["ios", "android"]) }));
  if (!b) return fail(c, 400, "Invalid push token.");
  await db
    .insert(schema.pushTokens)
    .values({ ...b, appUserId: c.get("user").id })
    .onConflictDoUpdate({ target: schema.pushTokens.token, set: { appUserId: c.get("user").id, platform: b.platform } });
  return c.json({ ok: true });
});

api.route("/", authed);

// Serializers -----------------------------------------------------------------------

type OrderRow = typeof schema.orders.$inferSelect;

function orderSummary(o: OrderRow) {
  const status = o.status as Status;
  return {
    id: o.id,
    number: orderNumber(o.seq),
    status,
    statusLabel: STATUS_LABEL[status],
    sizeGrams: o.sizeGrams,
    grind: o.grind,
    deliveryDate: o.deliveryDate,
    slotLabel: o.slotLabel,
    totalPaise: o.totalPaise,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt,
  };
}

async function orderJson(id: string) {
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  const [items, events] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id)).orderBy(asc(schema.orderItems.id)),
    db
      .select()
      .from(schema.orderEvents)
      .where(and(eq(schema.orderEvents.orderId, id), inArray(schema.orderEvents.toStatus, [...Object.keys(STATUS_LABEL)])))
      .orderBy(asc(schema.orderEvents.id)),
  ]);
  const status = o!.status as Status;
  const idx = timelineIndex(status);
  return {
    ...orderSummary(o!),
    publicToken: o!.publicToken,
    bags: o!.bags,
    address: { societyName: o!.societyName, tower: o!.tower, flat: o!.flat },
    note: o!.note,
    grainSubtotalPaise: o!.grainSubtotalPaise,
    grindChargePaise: o!.grindChargePaise,
    deliveryChargePaise: o!.deliveryChargePaise,
    items: items.map((i) => ({ grainId: i.grainId, grainName: i.grainName, grams: i.grams, lineTotalPaise: i.lineTotalPaise })),
    timeline: TIMELINE.map((t, i) => {
      const at = events.find((e) => (t.statuses as readonly string[]).includes(e.toStatus))?.createdAt ?? null;
      return { label: t.label, state: status === "CANCELLED" ? "off" : i < idx || (i === idx && status === "DELIVERED") ? "done" : i === idx ? "current" : "todo", at };
    }),
    canCancel: status === "PLACED",
  };
}
