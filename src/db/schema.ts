import { boolean, date, index, integer, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Bag, Nutrition } from "../domain/pricing";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// Catalog ------------------------------------------------------------------

export const grains = pgTable("grains", {
  id: text("id").primaryKey(), // slug, e.g. "wheat"
  name: text("name").notNull(),
  nameHi: text("name_hi").notNull(),
  tip: text("tip").notNull().default(""),
  color: text("color").notNull(),
  sellPaisePerKg: integer("sell_paise_per_kg").notNull(),
  costPaisePerKg: integer("cost_paise_per_kg").notNull(), // estimated
  nutrition: jsonb("nutrition").$type<Nutrition>().notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const grainPriceHistory = pgTable("grain_price_history", {
  id: serial("id").primaryKey(),
  grainId: text("grain_id").notNull().references(() => grains.id),
  sellPaisePerKg: integer("sell_paise_per_kg").notNull(),
  costPaisePerKg: integer("cost_paise_per_kg").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const presets = pgTable("presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  ratio: jsonb("ratio").$type<Record<string, number>>().notNull(), // basis points
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

/** Single row (id = 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  grindChargePaisePerKg: integer("grind_charge_paise_per_kg").notNull(),
  grindCostPaisePerKg: integer("grind_cost_paise_per_kg").notNull(),
  deliveryChargePaise: integer("delivery_charge_paise").notNull(),
  deliveryCostPaise: integer("delivery_cost_paise").notNull(),
  bagCostPaise: integer("bag_cost_paise").notNull(),
  cutoffHours: integer("cutoff_hours").notNull(),
  daysAhead: integer("days_ahead").notNull(),
  upiId: text("upi_id").notNull().default(""),
  whatsappNumber: text("whatsapp_number").notNull().default(""), // digits with country code
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const societies = pgTable("societies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const slots = pgTable("slots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(), // "Morning"
  startTime: text("start_time").notNull(), // "07:00", IST
  endTime: text("end_time").notNull(),
  capacity: integer("capacity").notNull(),
  active: boolean("active").notNull().default(true),
});

// Customers ----------------------------------------------------------------

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(), // E.164, +91XXXXXXXXXX
  createdAt: createdAt(),
});

/** A browser that has placed orders. Only the token hash is stored. */
export const deviceSessions = pgTable("device_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

// Shops (partner chakkis) ----------------------------------------------------

export const shops = pgTable("shops", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull().default(""),
  phone: text("phone").notNull().default(""), // E.164
  address: text("address").notNull().default(""),
  grindRatePaisePerKg: integer("grind_rate_paise_per_kg").notNull(), // what we pay the shop
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/** A person at a shop. Logs in once via a link from admin, then with a 4-digit PIN. */
export const shopUsers = pgTable("shop_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopId: uuid("shop_id").notNull().references(() => shops.id),
  name: text("name").notNull(),
  pinHash: text("pin_hash"), // null until set on first login
  linkTokenHash: text("link_token_hash"), // one-time setup link
  linkExpiresAt: timestamp("link_expires_at", { withTimezone: true }),
  failedPins: integer("failed_pins").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const shopSessions = pgTable("shop_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopUserId: uuid("shop_user_id").notNull().references(() => shopUsers.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  shopId: uuid("shop_id").notNull().references(() => shops.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  grams: integer("grams").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note").notNull().default(""),
});

// App users (customer app, phone + OTP) --------------------------------------

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(), // E.164, verified by OTP
  name: text("name").notNull().default(""),
  language: text("language").notNull().default("en"), // en | hi
  createdAt: createdAt(),
});

export const authCodes = pgTable(
  "auth_codes",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("auth_codes_phone_idx").on(t.phone, t.createdAt)],
);

export const appSessions = pgTable("app_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  appUserId: uuid("app_user_id").notNull().references(() => appUsers.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  appUserId: uuid("app_user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Home"),
  societyName: text("society_name").notNull(),
  tower: text("tower").notNull(),
  flat: text("flat").notNull(),
  note: text("note").notNull().default(""),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
});

export const savedBlends = pgTable("saved_blends", {
  id: uuid("id").primaryKey().defaultRandom(),
  appUserId: uuid("app_user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sizeGrams: integer("size_grams").notNull(),
  grind: text("grind").notNull(),
  lines: jsonb("lines").$type<{ grainId: string; grams: number }[]>().notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  appUserId: uuid("app_user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(), // ios | android
  createdAt: createdAt(),
});

// Orders -------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: serial("seq").notNull().unique(), // shown as PA-00042
    publicToken: text("public_token").notNull().unique(),
    sessionId: uuid("session_id").references(() => deviceSessions.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    status: text("status").notNull().default("PLACED"),
    grind: text("grind").notNull(),
    sizeGrams: integer("size_grams").notNull(),
    bags: jsonb("bags").$type<Bag[]>().notNull(),
    deliveryDate: date("delivery_date").notNull(), // IST date
    slotId: integer("slot_id").references(() => slots.id),
    slotLabel: text("slot_label").notNull(), // snapshot, "Morning 7–9 AM"
    // customer + address snapshot
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    societyName: text("society_name").notNull(),
    tower: text("tower").notNull(),
    flat: text("flat").notNull(),
    note: text("note").notNull().default(""),
    paymentMethod: text("payment_method").notNull(), // upi | cod
    paymentStatus: text("payment_status").notNull().default("pending"), // pending | paid | refunded
    grainSubtotalPaise: integer("grain_subtotal_paise").notNull(),
    grindChargePaise: integer("grind_charge_paise").notNull(),
    deliveryChargePaise: integer("delivery_charge_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    estCostPaise: integer("est_cost_paise").notNull(),
    internalNote: text("internal_note").notNull().default(""),
    source: text("source").notNull().default("web"), // web | app
    appUserId: uuid("app_user_id").references(() => appUsers.id),
    shopId: uuid("shop_id").references(() => shops.id),
    outputGrams: integer("output_grams"), // weighed by the shop at READY
    problem: text("problem").notNull().default(""), // raised by the shop, cleared by admin
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_delivery_idx").on(t.deliveryDate, t.slotId),
    index("orders_session_idx").on(t.sessionId),
    index("orders_status_idx").on(t.status),
    index("orders_app_user_idx").on(t.appUserId),
    index("orders_shop_idx").on(t.shopId, t.status),
  ],
);

/** What an order really cost, recorded by admin after delivery. */
export const orderActuals = pgTable("order_actuals", {
  orderId: uuid("order_id").primaryKey().references(() => orders.id, { onDelete: "cascade" }),
  grainCostPaise: integer("grain_cost_paise").notNull(),
  grindCostPaise: integer("grind_cost_paise").notNull(),
  bagCostPaise: integer("bag_cost_paise").notNull(),
  deliveryCostPaise: integer("delivery_cost_paise").notNull(),
  otherCostPaise: integer("other_cost_paise").notNull().default(0),
  note: text("note").notNull().default(""),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  grainId: text("grain_id").notNull().references(() => grains.id),
  grainName: text("grain_name").notNull(),
  grams: integer("grams").notNull(),
  sellPaisePerKg: integer("sell_paise_per_kg").notNull(),
  costPaisePerKg: integer("cost_paise_per_kg").notNull(),
  lineTotalPaise: integer("line_total_paise").notNull(),
});

export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actor: text("actor").notNull(), // customer | admin | system
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
});
