import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { compress } from "hono/compress";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { db, schema } from "./db";
import { availableSlots, loadCatalog } from "./lib/catalog";
import { createOrder, OrderError, transitionOrder } from "./lib/orders";
import { checkAdminPassword, endOpsSession, ensureDeviceSession, getDeviceSession, isOps, startOpsSession } from "./lib/session";
import { STATUSES, type Status } from "./domain/order-status";
import { HomePage } from "./views/home";
import { MessagePage, MyOrdersPage, OrderPage } from "./views/customer";
import { LoginPage, OrderDetailPage, OrdersPage, PricesPage } from "./views/ops/pages";

export const app = new Hono();

app.use(compress());
app.use(secureHeaders({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: undefined }));
app.use(csrf()); // rejects cross-site form and JSON posts

const noStore = (c: Context) => c.header("Cache-Control", "private, no-store");
const origin = (c: Context) => new URL(c.req.url).origin;
/** JSON safe to place inside a <script> tag. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

// Very small in-memory rate limit for order creation (per IP). Enough for one server in a pilot.
const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 8, windowMs = 3600_000) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}
const clientIp = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";

// Customer ---------------------------------------------------------------------

app.get("/", async (c) => {
  const [cat, session] = await Promise.all([loadCatalog(), getDeviceSession(c)]);
  const slots = await availableSlots(cat.settings.cutoffHours, cat.settings.daysAhead);
  const hasOrders = session
    ? (await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.sessionId, session.id)).limit(1)).length > 0
    : false;
  const data = {
    grains: cat.grains.map((g) => ({ id: g.id, name: g.name, nameHi: g.nameHi, tip: g.tip, color: g.color, sell: g.sellPaisePerKg, n: g.nutrition })),
    presets: cat.presets.map((p) => ({ id: p.id, name: p.name, description: p.description, ratio: p.ratio })),
    price: { grindChargePaisePerKg: cat.settings.grindChargePaisePerKg, deliveryChargePaise: cat.settings.deliveryChargePaise },
    societies: cat.societies.map((s) => s.name),
    slots: slots.map((s) => ({ key: s.key, dateLabel: s.dateLabel, label: s.label, left: s.left })),
  };
  noStore(c);
  return c.html(HomePage({ dataJson: scriptJson(data), hasOrders }));
});

app.post("/api/orders", async (c) => {
  if (rateLimited(clientIp(c))) return c.json({ error: "Too many orders from this network. Please message us on WhatsApp." }, 429);
  const body = await c.req.json().catch(() => null);
  try {
    const session = await ensureDeviceSession(c);
    const order = await createOrder(body, session.id);
    return c.json({ url: `/o/${order.publicToken}?new=1` });
  } catch (e) {
    if (e instanceof OrderError) return c.json({ error: e.message, field: e.field, code: e.code }, 400);
    console.error(e);
    return c.json({ error: "Something went wrong on our side. Please try again." }, 500);
  }
});

app.get("/o/:token", async (c) => {
  const token = c.req.param("token");
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.publicToken, token)).limit(1);
  if (!order) return c.html(MessagePage({ title: "Order not found", text: "This order link doesn't work. Check the link, or message us on WhatsApp." }), 404);
  const [items, settingsRows] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id)).orderBy(asc(schema.orderItems.id)),
    db.select().from(schema.settings).where(eq(schema.settings.id, 1)),
  ]);
  const s = settingsRows[0];
  noStore(c);
  return c.html(
    OrderPage({ order, items, upiId: s?.upiId ?? "", whatsappNumber: s?.whatsappNumber ?? "", justPlaced: c.req.query("new") === "1", url: `${origin(c)}/o/${token}` }),
  );
});

app.get("/my", async (c) => {
  const session = await getDeviceSession(c);
  const orders = session
    ? await db.select().from(schema.orders).where(eq(schema.orders.sessionId, session.id)).orderBy(desc(schema.orders.createdAt)).limit(50)
    : [];
  noStore(c);
  return c.html(MyOrdersPage({ orders }));
});

app.get("/favicon.svg", (c) => {
  c.header("Cache-Control", "public, max-age=604800");
  return c.body(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#2f4237"/><circle cx="16" cy="16" r="5" fill="#c98c0c"/></svg>',
    200,
    { "Content-Type": "image/svg+xml" },
  );
});

app.get("/health", (c) => c.text("ok"));

// Ops (founders) ---------------------------------------------------------------

const ops = new Hono();

ops.get("/login", (c) => c.html(LoginPage({})));
ops.post("/login", async (c) => {
  const form = await c.req.parseBody();
  if (rateLimited("login:" + clientIp(c), 10, 900_000)) return c.html(LoginPage({ error: "Too many tries. Wait 15 minutes." }), 429);
  if (!checkAdminPassword(String(form.password ?? ""))) return c.html(LoginPage({ error: "Wrong password." }), 401);
  await startOpsSession(c);
  return c.redirect("/ops");
});

ops.use("*", async (c, next) => {
  if (c.req.path === "/ops/login") return next();
  if (!(await isOps(c))) return c.redirect("/ops/login");
  noStore(c);
  return next();
});

ops.post("/logout", (c) => {
  endOpsSession(c);
  return c.redirect("/ops/login");
});

ops.get("/", async (c) => {
  const status = c.req.query("status") ?? "";
  const date = c.req.query("date") ?? "";
  const where = [];
  if (status === "") where.push(notInArray(schema.orders.status, ["DELIVERED", "CANCELLED"]));
  else if ((STATUSES as readonly string[]).includes(status)) where.push(eq(schema.orders.status, status));
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) where.push(eq(schema.orders.deliveryDate, date));
  const orders = await db
    .select()
    .from(schema.orders)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(schema.orders.deliveryDate), asc(schema.orders.slotId), asc(schema.orders.seq))
    .limit(300);
  const counted = orders.filter((o) => o.status !== "CANCELLED");
  const stats = {
    orders: counted.length,
    kg: counted.reduce((a, o) => a + o.sizeGrams, 0),
    revenue: counted.reduce((a, o) => a + o.totalPaise, 0),
    est: counted.reduce((a, o) => a + o.estCostPaise, 0),
  };
  return c.html(OrdersPage({ orders, status, date, stats }));
});

async function renderOrderDetail(c: Context, id: string, flash?: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return c.html(MessagePage({ title: "Not found", text: "No such order." }), 404);
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!order) return c.html(MessagePage({ title: "Not found", text: "No such order." }), 404);
  const [items, events] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id)).orderBy(asc(schema.orderItems.id)),
    db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id)).orderBy(asc(schema.orderEvents.id)),
  ]);
  return c.html(OrderDetailPage({ order, items, events, flash, publicUrl: `${origin(c)}/o/${order.publicToken}` }));
}

ops.get("/o/:id", (c) => renderOrderDetail(c, c.req.param("id"), c.req.query("ok") ?? undefined));

ops.post("/o/:id/status", async (c) => {
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  const to = String(form.to ?? "") as Status;
  if (!(STATUSES as readonly string[]).includes(to)) return renderOrderDetail(c, id, "Unknown status.");
  try {
    await transitionOrder(id, to, "admin");
  } catch (e) {
    if (e instanceof OrderError) return renderOrderDetail(c, id, e.message);
    throw e;
  }
  return c.redirect(`/ops/o/${id}?ok=Status+updated`);
});

ops.post("/o/:id/paid", async (c) => {
  const id = c.req.param("id");
  await db.update(schema.orders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(schema.orders.id, id));
  await db.insert(schema.orderEvents).values({ orderId: id, toStatus: "PAID", actor: "admin", note: "Marked paid" });
  return c.redirect(`/ops/o/${id}?ok=Marked+paid`);
});

ops.post("/o/:id/note", async (c) => {
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  await db.update(schema.orders).set({ internalNote: String(form.note ?? "").slice(0, 500), updatedAt: new Date() }).where(eq(schema.orders.id, id));
  return c.redirect(`/ops/o/${id}?ok=Note+saved`);
});

async function renderPrices(c: Context, flash?: string, error?: string) {
  const [grains, settingsRows] = await Promise.all([
    db.select().from(schema.grains).orderBy(asc(schema.grains.sort)),
    db.select().from(schema.settings).where(eq(schema.settings.id, 1)),
  ]);
  return c.html(PricesPage({ grains, settings: settingsRows[0]!, flash, error }), error ? 400 : 200);
}

ops.get("/prices", (c) => renderPrices(c, c.req.query("ok") ?? undefined));

/** "45.50" → 4550 paise; null if not a non-negative amount. */
const toPaise = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
};

ops.post("/prices", async (c) => {
  const form = await c.req.parseBody();
  const grains = await db.select().from(schema.grains);
  const updates: { id: string; sell: number; cost: number; active: boolean }[] = [];
  for (const g of grains) {
    const sell = toPaise(form[`sell_${g.id}`]);
    const cost = toPaise(form[`cost_${g.id}`]);
    if (sell === null || cost === null || sell === 0) return renderPrices(c, undefined, `Check the prices for ${g.name}: use numbers like 42 or 42.50.`);
    updates.push({ id: g.id, sell, cost, active: form[`active_${g.id}`] === "on" });
  }
  const fields = ["grindCharge", "grindCost", "deliveryCharge", "deliveryCost", "bagCost"] as const;
  const vals = Object.fromEntries(fields.map((f) => [f, toPaise(form[f])])) as Record<(typeof fields)[number], number | null>;
  if (Object.values(vals).some((v) => v === null)) return renderPrices(c, undefined, "Check the charges: use numbers like 5 or 5.50.");
  const cutoff = Number(form.cutoff);
  if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 72) return renderPrices(c, undefined, "Cutoff must be a whole number of hours, 0–72.");
  const wa = String(form.wa ?? "").replace(/\D/g, "");
  if (wa && !/^91[6-9]\d{9}$/.test(wa)) return renderPrices(c, undefined, "WhatsApp number should be 91 followed by the 10-digit mobile number.");
  if (!updates.some((u) => u.active)) return renderPrices(c, undefined, "Keep at least one grain on sale.");

  await db.transaction(async (tx) => {
    for (const u of updates) {
      const before = grains.find((g) => g.id === u.id)!;
      await tx.update(schema.grains).set({ sellPaisePerKg: u.sell, costPaisePerKg: u.cost, active: u.active }).where(eq(schema.grains.id, u.id));
      if (before.sellPaisePerKg !== u.sell || before.costPaisePerKg !== u.cost)
        await tx.insert(schema.grainPriceHistory).values({ grainId: u.id, sellPaisePerKg: u.sell, costPaisePerKg: u.cost });
    }
    await tx
      .update(schema.settings)
      .set({
        grindChargePaisePerKg: vals.grindCharge!,
        grindCostPaisePerKg: vals.grindCost!,
        deliveryChargePaise: vals.deliveryCharge!,
        deliveryCostPaise: vals.deliveryCost!,
        bagCostPaise: vals.bagCost!,
        cutoffHours: cutoff,
        upiId: String(form.upi ?? "").trim().slice(0, 100),
        whatsappNumber: wa,
        updatedAt: new Date(),
      })
      .where(eq(schema.settings.id, 1));
  });
  return c.redirect("/ops/prices?ok=Saved");
});

app.route("/ops", ops);

app.notFound((c) => c.html(MessagePage({ title: "Page not found", text: "This link doesn't go anywhere." }), 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.html(MessagePage({ title: "Something went wrong", text: "Please try again in a minute." }), 500);
});

