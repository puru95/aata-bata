import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { quote, validateBlend, bagSplit } from "../domain/pricing";
import { canTransition, type Status } from "../domain/order-status";
import { loadCatalog } from "./catalog";
import { istInstant, normalizeIndianMobile, slotText } from "./format";
import { randomToken } from "./session";

const text = (max: number) => z.string().trim().max(max);

export const orderInput = z.object({
  sizeGrams: z.number().int(),
  grind: z.enum(["fine", "medium", "coarse"]),
  lines: z.array(z.object({ grainId: z.string().max(40), grams: z.number().int() })).max(20),
  slot: z.string().regex(/^\d{4}-\d{2}-\d{2}\|\d+$/),
  payment: z.enum(["upi", "cod"]),
  name: text(80),
  phone: text(20),
  society: text(120),
  tower: text(20),
  flat: text(20),
  note: text(200).optional().default(""),
});

export class OrderError extends Error {
  constructor(message: string, public field?: string, public code?: string) {
    super(message);
  }
}

/** Validate, re-price on the server, and save. Returns the new order's public token. */
export async function createOrder(raw: unknown, sessionId: string) {
  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) throw new OrderError("Some details look wrong. Please check the form and try again.");
  const input = parsed.data;

  if (!input.name) throw new OrderError("Enter your name", "name");
  const phone = normalizeIndianMobile(input.phone);
  if (!phone) throw new OrderError("Enter a 10-digit mobile number", "phone");
  if (!input.tower) throw new OrderError("Enter your tower", "tower");
  if (!input.flat) throw new OrderError("Enter your flat number", "flat");

  const cat = await loadCatalog();
  if (!cat.societies.some((s) => s.name === input.society)) throw new OrderError("Pick your society from the list.", "society");

  const blendErr = validateBlend(input.lines, input.sizeGrams, new Set(cat.grains.map((g) => g.id)));
  if (blendErr) throw new OrderError(blendErr.message, undefined, blendErr.code);

  const q = quote(input.lines, cat.grains, cat.settings);
  const [date, slotIdStr] = input.slot.split("|") as [string, string];
  const slotId = Number(slotIdStr);

  return db.transaction(async (tx) => {
    // Lock the slot row so two orders can't take the last place at the same time.
    const slotRows = await tx.execute<{ id: number; label: string; start_time: string; end_time: string; capacity: number; active: boolean }>(
      sql`select id, label, start_time, end_time, capacity, active from slots where id = ${slotId} for update`,
    );
    const slot = (Array.isArray(slotRows) ? slotRows[0] : (slotRows as { rows: unknown[] }).rows[0]) as
      | { id: number; label: string; start_time: string; end_time: string; capacity: number; active: boolean }
      | undefined;
    const tooLate = !slot || istInstant(date, slot.start_time) - Date.now() < cat.settings.cutoffHours * 3600_000;
    if (!slot || !slot.active || tooLate) throw new OrderError("That delivery slot is no longer available. Please pick another.", undefined, "slot");
    const [{ n } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.orders)
      .where(and(eq(schema.orders.deliveryDate, date), eq(schema.orders.slotId, slotId), ne(schema.orders.status, "CANCELLED")));
    if (Number(n) >= slot.capacity) throw new OrderError("That delivery slot just filled up. Please pick another.", undefined, "slot");

    // Find or create the customer by phone. An existing customer's name is never overwritten from a form.
    let [customer] = await tx.select().from(schema.customers).where(eq(schema.customers.phone, phone)).limit(1);
    if (!customer) [customer] = await tx.insert(schema.customers).values({ name: input.name, phone }).returning();

    const [order] = await tx
      .insert(schema.orders)
      .values({
        publicToken: randomToken(18),
        sessionId,
        customerId: customer!.id,
        grind: input.grind,
        sizeGrams: q.totalGrams,
        bags: bagSplit(q.totalGrams),
        deliveryDate: date,
        slotId,
        slotLabel: slotText(slot.label, slot.start_time, slot.end_time),
        customerName: input.name,
        customerPhone: phone,
        societyName: input.society,
        tower: input.tower,
        flat: input.flat,
        note: input.note,
        paymentMethod: input.payment,
        grainSubtotalPaise: q.grainSubtotalPaise,
        grindChargePaise: q.grindChargePaise,
        deliveryChargePaise: q.deliveryChargePaise,
        totalPaise: q.totalPaise,
        estCostPaise: q.estCostPaise,
      })
      .returning();
    await tx.insert(schema.orderItems).values(
      q.lines.map((l) => ({
        orderId: order!.id,
        grainId: l.grainId,
        grainName: l.grainName,
        grams: l.grams,
        sellPaisePerKg: l.sellPaisePerKg,
        costPaisePerKg: l.costPaisePerKg,
        lineTotalPaise: l.lineTotalPaise,
      })),
    );
    await tx.insert(schema.orderEvents).values({ orderId: order!.id, toStatus: "PLACED", actor: "customer" });
    return order!;
  });
}

/** The only place order status changes. Validates the move and records an event. */
export async function transitionOrder(orderId: string, to: Status, actor: string, note = "") {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!o) throw new OrderError("Order not found.");
    const from = o.status as Status;
    if (!canTransition(from, to)) throw new OrderError(`Can't move from ${from} to ${to}.`);
    await tx.update(schema.orders).set({ status: to, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
    await tx.insert(schema.orderEvents).values({ orderId, fromStatus: from, toStatus: to, actor, note });
  });
}
