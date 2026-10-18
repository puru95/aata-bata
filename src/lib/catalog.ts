import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { addDays, formatDate, istInstant, istToday, slotText } from "./format";

export async function loadCatalog() {
  const [grains, presets, settingsRows, societies] = await Promise.all([
    db.select().from(schema.grains).where(eq(schema.grains.active, true)).orderBy(asc(schema.grains.sort)),
    db.select().from(schema.presets).where(eq(schema.presets.active, true)).orderBy(asc(schema.presets.sort)),
    db.select().from(schema.settings).where(eq(schema.settings.id, 1)),
    db.select().from(schema.societies).where(eq(schema.societies.active, true)).orderBy(asc(schema.societies.sort)),
  ]);
  const settings = settingsRows[0];
  if (!settings) throw new Error("Settings row missing. Run `npm run db:seed`.");
  return { grains, presets, settings, societies };
}

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

export type SlotOption = { key: string; date: string; dateLabel: string; slotId: number; label: string; left: number };

/** Bookable slots over the next N days in IST: past the cutoff and with capacity left. */
export async function availableSlots(cutoffHours: number, daysAhead: number, now = Date.now()): Promise<SlotOption[]> {
  const slotRows = await db.select().from(schema.slots).where(eq(schema.slots.active, true)).orderBy(asc(schema.slots.startTime));
  if (!slotRows.length) return [];
  const first = istToday(now);
  const last = addDays(first, daysAhead);
  const booked = await db
    .select({ date: schema.orders.deliveryDate, slotId: schema.orders.slotId, n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.deliveryDate, first),
        lte(schema.orders.deliveryDate, last),
        ne(schema.orders.status, "CANCELLED"),
        inArray(schema.orders.slotId, slotRows.map((s) => s.id)),
      ),
    )
    .groupBy(schema.orders.deliveryDate, schema.orders.slotId);
  const used = new Map(booked.map((b) => [`${b.date}|${b.slotId}`, Number(b.n)]));

  const out: SlotOption[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const date = addDays(first, i);
    for (const s of slotRows) {
      if (istInstant(date, s.startTime) - now < cutoffHours * 3600_000) continue;
      const left = s.capacity - (used.get(`${date}|${s.id}`) ?? 0);
      if (left <= 0) continue;
      out.push({ key: `${date}|${s.id}`, date, dateLabel: formatDate(date), slotId: s.id, label: slotText(s.label, s.startTime, s.endTime), left });
    }
  }
  return out;
}
