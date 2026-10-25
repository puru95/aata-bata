// Shop panel (/shop): partner chakki staff sign in with a PIN and work through their order queue.
// Shops see order number, blend, bags and pickup slot only — never the customer's name, phone or flat.
import { Hono, type Context } from "hono";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { OrderError, reportProblem, transitionOrder } from "../lib/orders";
import { completeSetup, currentShopUser, forgetDevice, rememberedUser, ShopAuthError, signInWithPin, signOut, userForLink } from "../lib/shop-auth";
import { SHOP_ACTIVE, type Status } from "../domain/order-status";
import { ShopLinkInvalidPage, ShopNotSetUpPage, ShopPinPage, ShopQueuePage, ShopSetupPage, type QueueOrder } from "../views/shop";

type Me = NonNullable<Awaited<ReturnType<typeof currentShopUser>>>;
export const shop = new Hono<{ Variables: { me: Me } }>();

const noStore = (c: Context) => c.header("Cache-Control", "private, no-store");

// Per-IP limit on PIN tries, on top of the per-user lockout.
const hits = new Map<string, number[]>();
function limited(key: string, max = 20, windowMs = 900_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
const ip = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";

shop.use("*", async (c, next) => {
  noStore(c);
  await next();
});

// Setup link -------------------------------------------------------------------

shop.get("/setup/:token", async (c) => {
  const row = await userForLink(c.req.param("token"));
  if (!row) return c.html(ShopLinkInvalidPage(), 410);
  return c.html(ShopSetupPage({ name: row.user.name, shopName: row.shop.name }));
});

shop.post("/setup/:token", async (c) => {
  const t = c.req.param("token");
  const row = await userForLink(t);
  if (!row) return c.html(ShopLinkInvalidPage(), 410);
  const form = await c.req.parseBody();
  const pin = String(form.pin ?? "");
  const again = (error: string) => c.html(ShopSetupPage({ name: row.user.name, shopName: row.shop.name, error }), 400);
  if (pin !== String(form.pin2 ?? "")) return again("The two PINs don't match. · दोनों PIN एक जैसे नहीं हैं।");
  try {
    await completeSetup(c, t, pin);
  } catch (e) {
    if (e instanceof ShopAuthError) return again(e.message);
    throw e;
  }
  return c.redirect("/shop");
});

// PIN sign-in ------------------------------------------------------------------

shop.get("/login", async (c) => {
  if (await currentShopUser(c)) return c.redirect("/shop");
  const row = await rememberedUser(c);
  return row ? c.html(ShopPinPage({ name: row.user.name, shopName: row.shop.name })) : c.html(ShopNotSetUpPage());
});

shop.post("/login", async (c) => {
  const row = await rememberedUser(c);
  if (!row) return c.html(ShopNotSetUpPage());
  const page = (error: string, status: 401 | 429) => c.html(ShopPinPage({ name: row.user.name, shopName: row.shop.name, error }), status);
  if (limited("pin:" + ip(c))) return page("Too many tries. Wait 15 minutes.", 429);
  try {
    await signInWithPin(c, String((await c.req.parseBody()).pin ?? ""));
  } catch (e) {
    if (e instanceof ShopAuthError) return page(e.message, 401);
    throw e;
  }
  return c.redirect("/shop");
});

shop.post("/forget", async (c) => {
  await signOut(c);
  forgetDevice(c);
  return c.redirect("/shop/login");
});

// Signed-in pages --------------------------------------------------------------

shop.use("*", async (c, next) => {
  const me = await currentShopUser(c);
  if (!me) return c.redirect("/shop/login");
  c.set("me", me);
  return next();
});

shop.post("/logout", async (c) => {
  await signOut(c);
  return c.redirect("/shop/login");
});

async function withItems(orders: (typeof schema.orders.$inferSelect)[]): Promise<QueueOrder[]> {
  if (!orders.length) return [];
  const items = await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((o) => o.id))).orderBy(asc(schema.orderItems.id));
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
}

async function renderQueue(c: Context<{ Variables: { me: Me } }>, opts: { flash?: string; error?: { id: string; text: string } } = {}) {
  const { user, shop: s } = c.get("me");
  const [active, done] = await Promise.all([
    db.select().from(schema.orders)
      .where(and(eq(schema.orders.shopId, s.id), inArray(schema.orders.status, SHOP_ACTIVE)))
      .orderBy(asc(schema.orders.deliveryDate), asc(schema.orders.slotId), asc(schema.orders.seq)),
    db.select().from(schema.orders)
      .where(and(eq(schema.orders.shopId, s.id), inArray(schema.orders.status, ["OUT_FOR_DELIVERY", "DELIVERED"])))
      .orderBy(desc(schema.orders.updatedAt))
      .limit(10),
  ]);
  return c.html(ShopQueuePage({ name: user.name, shopName: s.name, orders: await withItems(active), done: await withItems(done), ...opts }), opts.error ? 400 : 200);
}

shop.get("/", (c) => renderQueue(c, { flash: c.req.query("ok") ?? undefined }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
shop.use("/o/:id/*", async (c, next) => (UUID.test(c.req.param("id")) ? next() : c.redirect("/shop")));

const STEPS: Record<string, { to: Status; ok: string }> = {
  accept: { to: "ACCEPTED", ok: "Accepted" },
  grind: { to: "GRINDING", ok: "Grinding started" },
  ready: { to: "READY", ok: "Marked ready" },
};

shop.post("/o/:id/:step{accept|grind|ready}", async (c) => {
  const id = c.req.param("id");
  const step = STEPS[c.req.param("step")]!;
  const { user, shop: s } = c.get("me");
  let outputGrams: number | undefined;
  if (step.to === "READY") {
    const kg = String((await c.req.parseBody()).kg ?? "").trim().replace(",", ".");
    outputGrams = /^\d{1,3}(\.\d{1,3})?$/.test(kg) ? Math.round(Number(kg) * 1000) : NaN;
  }
  try {
    await transitionOrder(id, step.to, { role: "shop", shopId: s.id, userId: user.id }, { outputGrams });
  } catch (e) {
    if (e instanceof OrderError) return renderQueue(c, { error: { id, text: e.message } });
    throw e;
  }
  return c.redirect(`/shop?ok=${encodeURIComponent(step.ok)}`);
});

shop.post("/o/:id/problem", async (c) => {
  const id = c.req.param("id");
  const { user, shop: s } = c.get("me");
  try {
    await reportProblem(id, { shopId: s.id, userId: user.id }, String((await c.req.parseBody()).problem ?? ""));
  } catch (e) {
    if (e instanceof OrderError) return renderQueue(c, { error: { id, text: e.message } });
    throw e;
  }
  return c.redirect("/shop?ok=Problem+sent");
});
