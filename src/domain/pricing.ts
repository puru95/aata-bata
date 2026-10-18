// Pure pricing, blend and nutrition rules. Shared by the server and the browser bundle,
// so the price a customer sees is computed by the same code the server trusts.
// Money is integer paise, weight is integer grams.

export const STEP_GRAMS = 500;
export const SIZES_GRAMS = [5000, 10000, 15000, 20000, 25000] as const;
export const BAG_SIZES_GRAMS = [10000, 5000] as const;
export const ROTI_GRAMS = 35;

export type Nutrition = {
  kj: number;   // energy, kilojoules per 100 g
  carb: number; // available carbohydrate, g
  prot: number; // protein, g
  fib: number;  // total dietary fibre, g
  fat: number;  // g
  ca: number;   // calcium, mg
  fe: number;   // iron, mg
};

export type GrainPrice = {
  id: string;
  name: string;
  sellPaisePerKg: number;
  costPaisePerKg: number;
};

export type PriceSettings = {
  grindChargePaisePerKg: number;
  grindCostPaisePerKg: number;
  deliveryChargePaise: number;
  deliveryCostPaise: number;
  bagCostPaise: number;
};

export type BlendLine = { grainId: string; grams: number };

export type PricedLine = BlendLine & {
  grainName: string;
  sellPaisePerKg: number;
  costPaisePerKg: number;
  lineTotalPaise: number;
};

export type Quote = {
  lines: PricedLine[];
  totalGrams: number;
  grainSubtotalPaise: number;
  grindChargePaise: number;
  deliveryChargePaise: number;
  totalPaise: number;
  estCostPaise: number;
  perKgPaise: number;
  bags: Bag[];
};

export type Bag = { grams: number; qty: number };

/** Round half up to whole paise. grams × paise/kg ÷ 1000. */
export const linePaise = (grams: number, paisePerKg: number) => Math.round((grams * paisePerKg) / 1000);

/** As many 10 kg bags as fit, then 5 kg, then any remainder in one bag. */
export function bagSplit(totalGrams: number): Bag[] {
  const bags: Bag[] = [];
  let left = totalGrams;
  for (const size of BAG_SIZES_GRAMS) {
    const qty = Math.floor(left / size);
    if (qty) {
      bags.push({ grams: size, qty });
      left -= qty * size;
    }
  }
  if (left > 0) bags.push({ grams: left, qty: 1 });
  return bags;
}

/**
 * Turn ratios (any positive weights, e.g. basis points) into grams that add up to `total`.
 * Every grain gets at least one step; the largest grain absorbs rounding.
 */
export function scaleRatio(ratio: Record<string, number>, total: number, step = STEP_GRAMS): Record<string, number> {
  const ids = Object.keys(ratio).filter((id) => (ratio[id] ?? 0) > 0);
  const weight = ids.reduce((a, id) => a + (ratio[id] ?? 0), 0);
  const out: Record<string, number> = {};
  if (!ids.length || !weight) return out;
  let sum = 0;
  let big = ids[0]!;
  for (const id of ids) {
    const r = ratio[id]!;
    const g = Math.max(step, Math.round((total * r) / weight / step) * step);
    out[id] = g;
    sum += g;
    if (r > ratio[big]!) big = id;
  }
  out[big]! += total - sum;
  // If tiny grains pushed the largest below one step, the blend has too many grains for this size.
  if (out[big]! < step) return {};
  return out;
}

export type BlendError = { code: string; message: string };

/** Check a blend against the order rules. Returns null when valid. */
export function validateBlend(lines: BlendLine[], sizeGrams: number, knownGrainIds: Set<string>): BlendError | null {
  if (!(SIZES_GRAMS as readonly number[]).includes(sizeGrams)) return { code: "size", message: "Pick a size of 5, 10, 15, 20 or 25 kg." };
  if (!lines.length) return { code: "empty", message: "Add at least one grain." };
  const seen = new Set<string>();
  let total = 0;
  for (const l of lines) {
    if (!knownGrainIds.has(l.grainId)) return { code: "grain", message: "One of the grains is no longer available. Please rebuild your blend." };
    if (seen.has(l.grainId)) return { code: "dup", message: "A grain appears twice." };
    seen.add(l.grainId);
    if (!Number.isInteger(l.grams) || l.grams <= 0 || l.grams % STEP_GRAMS !== 0)
      return { code: "step", message: "Each grain must be in 0.5 kg steps." };
    total += l.grams;
  }
  if (total !== sizeGrams) return { code: "fill", message: `Your bag has ${total / 1000} kg; it needs exactly ${sizeGrams / 1000} kg.` };
  return null;
}

/** Full price and estimated cost for a blend. Assumes the blend is valid. */
export function quote(lines: BlendLine[], grains: GrainPrice[], s: PriceSettings): Quote {
  const byId = new Map(grains.map((g) => [g.id, g]));
  const priced: PricedLine[] = [];
  let totalGrams = 0;
  let grainSubtotalPaise = 0;
  let grainCost = 0;
  for (const l of lines) {
    const g = byId.get(l.grainId);
    if (!g || l.grams <= 0) continue;
    const lineTotalPaise = linePaise(l.grams, g.sellPaisePerKg);
    priced.push({ ...l, grainName: g.name, sellPaisePerKg: g.sellPaisePerKg, costPaisePerKg: g.costPaisePerKg, lineTotalPaise });
    totalGrams += l.grams;
    grainSubtotalPaise += lineTotalPaise;
    grainCost += linePaise(l.grams, g.costPaisePerKg);
  }
  const bags = bagSplit(totalGrams);
  const bagCount = bags.reduce((a, b) => a + b.qty, 0);
  const grindChargePaise = linePaise(totalGrams, s.grindChargePaisePerKg);
  const deliveryChargePaise = totalGrams ? s.deliveryChargePaise : 0;
  const totalPaise = grainSubtotalPaise + grindChargePaise + deliveryChargePaise;
  // Payment fee is 0 for direct UPI and cash, so it is not part of the estimate.
  const estCostPaise = totalGrams
    ? grainCost + linePaise(totalGrams, s.grindCostPaisePerKg) + bagCount * s.bagCostPaise + s.deliveryCostPaise
    : 0;
  return {
    lines: priced,
    totalGrams,
    grainSubtotalPaise,
    grindChargePaise,
    deliveryChargePaise,
    totalPaise,
    estCostPaise,
    perKgPaise: totalGrams ? Math.round((totalPaise * 1000) / totalGrams) : 0,
    bags,
  };
}

/** Weighted nutrition per 100 g of the blend. kcal uses IFCT's 1 kcal = 4.18 kJ. */
export function blendNutrition(lines: BlendLine[], nutritionById: Record<string, Nutrition>) {
  const total = lines.reduce((a, l) => a + l.grams, 0);
  if (!total) return null;
  const out = { kcal: 0, carb: 0, prot: 0, fib: 0, fat: 0, ca: 0, fe: 0 };
  for (const l of lines) {
    const n = nutritionById[l.grainId];
    if (!n) continue;
    const w = l.grams / total;
    out.kcal += (w * n.kj) / 4.18;
    out.carb += w * n.carb;
    out.prot += w * n.prot;
    out.fib += w * n.fib;
    out.fat += w * n.fat;
    out.ca += w * n.ca;
    out.fe += w * n.fe;
  }
  return out;
}
