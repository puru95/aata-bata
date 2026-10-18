// Seed data. PRICES ARE PLACEHOLDERS: replace them from /ops/prices once market research is done.
// Nutrition: IFCT 2017 (ICMR–NIN), per 100 g raw whole grain.
import { conn, db, schema } from "./index";

const GRAINS: (typeof schema.grains.$inferInsert)[] = [
  { id: "wheat", name: "Wheat", nameHi: "गेहूं", tip: "Soft rotis", color: "#d9a43a", sellPaisePerKg: 4000, costPaisePerKg: 3300, sort: 1,
    nutrition: { kj: 1347, carb: 64.72, prot: 10.59, fib: 11.23, fat: 1.47, ca: 39.4, fe: 3.97 } },
  { id: "ragi", name: "Ragi", nameHi: "रागी", tip: "Most calcium", color: "#8a4b33", sellPaisePerKg: 7000, costPaisePerKg: 5800, sort: 2,
    nutrition: { kj: 1342, carb: 66.82, prot: 7.16, fib: 11.18, fat: 1.92, ca: 364, fe: 4.62 } },
  { id: "jowar", name: "Jowar", nameHi: "ज्वार", tip: "Light, mild", color: "#cdb888", sellPaisePerKg: 6000, costPaisePerKg: 5000, sort: 3,
    nutrition: { kj: 1398, carb: 67.68, prot: 9.97, fib: 10.22, fat: 1.73, ca: 27.6, fe: 3.95 } },
  { id: "bajra", name: "Bajra", nameHi: "बाजरा", tip: "Most iron", color: "#7f8f6a", sellPaisePerKg: 5000, costPaisePerKg: 4100, sort: 4,
    nutrition: { kj: 1456, carb: 61.78, prot: 10.96, fib: 11.49, fat: 5.43, ca: 27.4, fe: 6.42 } },
  { id: "barley", name: "Barley", nameHi: "जौ", tip: "Most fibre", color: "#b07a43", sellPaisePerKg: 6500, costPaisePerKg: 5400, sort: 5,
    nutrition: { kj: 1321, carb: 61.29, prot: 10.94, fib: 15.64, fat: 1.3, ca: 28.6, fe: 1.56 } },
  { id: "maize", name: "Maize", nameHi: "मक्का", tip: "Makki taste", color: "#f0c419", sellPaisePerKg: 4500, costPaisePerKg: 3700, sort: 6,
    nutrition: { kj: 1398, carb: 64.77, prot: 8.8, fib: 12.24, fat: 3.77, ca: 8.9, fe: 2.49 } },
];

const PRESETS: (typeof schema.presets.$inferInsert)[] = [
  { id: "wheat", name: "Pure Wheat", description: "Chakki-fresh wheat", ratio: { wheat: 10000 }, sort: 1 },
  { id: "multi", name: "Multigrain", description: "Wheat, jowar, bajra, ragi", ratio: { wheat: 7000, jowar: 1000, bajra: 1000, ragi: 1000 }, sort: 2 },
  { id: "fibre", name: "High Fibre", description: "Wheat, barley, jowar, ragi", ratio: { wheat: 6000, barley: 1500, jowar: 1500, ragi: 1000 }, sort: 3 },
  { id: "ragi", name: "Ragi Mix", description: "Wheat, ragi, jowar", ratio: { wheat: 7000, ragi: 2000, jowar: 1000 }, sort: 4 },
];

await db.transaction(async (tx) => {
  for (const g of GRAINS) await tx.insert(schema.grains).values(g).onConflictDoNothing();
  for (const p of PRESETS) await tx.insert(schema.presets).values(p).onConflictDoNothing();
  await tx
    .insert(schema.settings)
    .values({ id: 1, grindChargePaisePerKg: 500, grindCostPaisePerKg: 300, deliveryChargePaise: 0, deliveryCostPaise: 2500, bagCostPaise: 1500, cutoffHours: 12, daysAhead: 7 })
    .onConflictDoNothing();
  const soc = await tx.select().from(schema.societies).limit(1);
  if (!soc.length) await tx.insert(schema.societies).values({ name: "Purvanchal Royal City", sort: 1 });
  const sl = await tx.select().from(schema.slots).limit(1);
  if (!sl.length)
    await tx.insert(schema.slots).values([
      { label: "Morning", startTime: "07:00", endTime: "09:00", capacity: 15 },
      { label: "Evening", startTime: "18:00", endTime: "20:00", capacity: 15 },
    ]);
});

console.log(`Seeded (${conn.kind}). Prices are placeholders — update them at /ops/prices.`);
await conn.close();
