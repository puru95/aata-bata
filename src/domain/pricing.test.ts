import { describe, expect, it } from "vitest";
import { bagSplit, blendNutrition, linePaise, quote, scaleRatio, validateBlend } from "./pricing";
import { allowedNext, canTransition } from "./order-status";

const grains = [
  { id: "wheat", name: "Wheat", sellPaisePerKg: 4000, costPaisePerKg: 3300 },
  { id: "ragi", name: "Ragi", sellPaisePerKg: 7000, costPaisePerKg: 5800 },
  { id: "jowar", name: "Jowar", sellPaisePerKg: 6000, costPaisePerKg: 5000 },
];
const settings = { grindChargePaisePerKg: 500, grindCostPaisePerKg: 300, deliveryChargePaise: 0, deliveryCostPaise: 2500, bagCostPaise: 1500 };
const ids = new Set(grains.map((g) => g.id));

describe("linePaise", () => {
  it("rounds half up to the nearest paisa", () => {
    expect(linePaise(500, 4501)).toBe(2251); // 2250.5 → 2251
    expect(linePaise(500, 4499)).toBe(2250); // 2249.5 → 2250
    expect(linePaise(1000, 4000)).toBe(4000);
  });
});

describe("bagSplit", () => {
  it("prefers 10 kg bags, then 5 kg", () => {
    expect(bagSplit(25000)).toEqual([{ grams: 10000, qty: 2 }, { grams: 5000, qty: 1 }]);
    expect(bagSplit(5000)).toEqual([{ grams: 5000, qty: 1 }]);
    expect(bagSplit(10000)).toEqual([{ grams: 10000, qty: 1 }]);
  });
  it("puts any remainder in one bag", () => {
    expect(bagSplit(7500)).toEqual([{ grams: 5000, qty: 1 }, { grams: 2500, qty: 1 }]);
  });
});

describe("scaleRatio", () => {
  it("sums exactly to the total", () => {
    const g = scaleRatio({ wheat: 6000, barley: 1500, jowar: 1500, ragi: 1000 }, 5000);
    expect(Object.values(g).reduce((a, b) => a + b, 0)).toBe(5000);
    expect(Object.values(g).every((x) => x >= 500 && x % 500 === 0)).toBe(true);
  });
  it("gives a small grain at least one step", () => {
    expect(scaleRatio({ wheat: 9500, ragi: 500 }, 5000).ragi).toBe(500);
  });
  it("matches the multigrain preset at 10 kg", () => {
    expect(scaleRatio({ wheat: 7000, jowar: 1000, bajra: 1000, ragi: 1000 }, 10000)).toEqual({ wheat: 7000, jowar: 1000, bajra: 1000, ragi: 1000 });
  });
});

describe("validateBlend", () => {
  it("accepts a full bag", () => {
    expect(validateBlend([{ grainId: "wheat", grams: 8000 }, { grainId: "ragi", grams: 2000 }], 10000, ids)).toBeNull();
  });
  it("rejects a size outside 5–25 kg steps", () => {
    expect(validateBlend([{ grainId: "wheat", grams: 7500 }], 7500, ids)?.code).toBe("size");
  });
  it("rejects a bag that isn't full", () => {
    expect(validateBlend([{ grainId: "wheat", grams: 9500 }], 10000, ids)?.code).toBe("fill");
  });
  it("rejects grams off the 0.5 kg step", () => {
    expect(validateBlend([{ grainId: "wheat", grams: 9750 }, { grainId: "ragi", grams: 250 }], 10000, ids)?.code).toBe("step");
  });
  it("rejects unknown grains and duplicates", () => {
    expect(validateBlend([{ grainId: "rice", grams: 5000 }], 5000, ids)?.code).toBe("grain");
    expect(validateBlend([{ grainId: "wheat", grams: 2500 }, { grainId: "wheat", grams: 2500 }], 5000, ids)?.code).toBe("dup");
  });
  it("rejects an empty blend", () => {
    expect(validateBlend([], 5000, ids)?.code).toBe("empty");
  });
});

describe("quote", () => {
  it("prices a 10 kg blend", () => {
    const q = quote([{ grainId: "wheat", grams: 7000 }, { grainId: "ragi", grams: 2000 }, { grainId: "jowar", grams: 1000 }], grains, settings);
    expect(q.grainSubtotalPaise).toBe(28000 + 14000 + 6000);
    expect(q.grindChargePaise).toBe(5000);
    expect(q.totalPaise).toBe(53000);
    expect(q.perKgPaise).toBe(5300);
    // cost: grain 23100+11600+5000, grinding 3000, 1 bag 1500, delivery 2500
    expect(q.estCostPaise).toBe(39700 + 3000 + 1500 + 2500);
    expect(q.bags).toEqual([{ grams: 10000, qty: 1 }]);
  });
  it("charges nothing for an empty blend", () => {
    const q = quote([], grains, { ...settings, deliveryChargePaise: 2000 });
    expect(q.totalPaise).toBe(0);
    expect(q.estCostPaise).toBe(0);
  });
});

describe("blendNutrition", () => {
  it("weights by grams", () => {
    const n = blendNutrition([{ grainId: "a", grams: 5000 }, { grainId: "b", grams: 5000 }], {
      a: { kj: 1000, carb: 60, prot: 10, fib: 10, fat: 2, ca: 20, fe: 4 },
      b: { kj: 2000, carb: 70, prot: 6, fib: 12, fat: 4, ca: 360, fe: 6 },
    })!;
    expect(n.prot).toBeCloseTo(8);
    expect(n.ca).toBeCloseTo(190);
    expect(n.kcal).toBeCloseTo(1500 / 4.18);
  });
});

describe("order status", () => {
  it("moves forward one step, back one step, or cancels", () => {
    expect(allowedNext("CONFIRMED")).toEqual(["SENT_TO_PARTNER", "PLACED", "CANCELLED"]);
    expect(canTransition("PLACED", "DELIVERED")).toBe(false);
    expect(allowedNext("DELIVERED")).toEqual([]);
  });
});
