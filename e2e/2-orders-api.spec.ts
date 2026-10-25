import { expect, test } from "@playwright/test";
import { homeData, orderBody } from "./helpers";

test("server re-prices orders and ignores anything the browser claims", async ({ request }) => {
  const { slots } = await homeData(request);
  const res = await request.post("/api/orders", { data: { ...orderBody(slots[0]!.key), totalPaise: 1, price: 1 } });
  expect(res.status()).toBe(200);
  const page = await (await request.get((await res.json()).url)).text();
  // 4 kg wheat @ ₹40 + 1 kg ragi @ ₹70 + grinding 5 kg @ ₹5 = ₹255 with seeded prices
  expect(page).toContain("₹255");
});

test("rejects bad orders with clear messages", async ({ request }) => {
  const { slots } = await homeData(request);
  const slot = slots[0]!.key;
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ lines: [{ grainId: "wheat", grams: 4500 }] }, /needs exactly 5 kg/],
    [{ sizeGrams: 7000, lines: [{ grainId: "wheat", grams: 7000 }] }, /5, 10, 15, 20 or 25 kg/],
    [{ lines: [{ grainId: "wheat", grams: 4750 }, { grainId: "ragi", grams: 250 }] }, /0\.5 kg steps/],
    [{ lines: [{ grainId: "rice", grams: 5000 }] }, /no longer available/],
    [{ phone: "12345" }, /10-digit mobile/],
    [{ society: "Somewhere Else" }, /Pick your society/],
    [{ slot: "2020-01-01|1" }, /no longer available/],
    [{ name: "" }, /Enter your name/],
    [{ grind: "powder" }, /check the form/],
  ];
  for (const [over, msg] of cases) {
    const res = await request.post("/api/orders", { data: orderBody(slot, over) });
    expect(res.status(), JSON.stringify(over)).toBe(400);
    expect((await res.json()).error, JSON.stringify(over)).toMatch(msg);
  }
});

test("blocks form posts from other websites", async ({ request }) => {
  const res = await request.post("/ops/login", { headers: { Origin: "https://evil.example" }, form: { password: "x" } });
  expect(res.status()).toBe(403);
});

test("a slot closes when it's full and the next order is refused", async ({ request }) => {
  const { slots } = await homeData(request);
  const last = slots[slots.length - 1]!; // use the furthest slot so other tests aren't affected
  for (let i = 0; i < last.left; i++) {
    const res = await request.post("/api/orders", { data: orderBody(last.key, { phone: `90000001${String(i).padStart(2, "0")}` }) });
    expect(res.status(), `order ${i + 1}`).toBe(200);
  }
  const res = await request.post("/api/orders", { data: orderBody(last.key) });
  expect(res.status()).toBe(400);
  expect((await res.json()).code).toBe("slot");
  const after = await homeData(request);
  expect(after.slots.map((s) => s.key)).not.toContain(last.key);
});

test("two orders racing for the last place: only one wins", async ({ request }) => {
  const { slots } = await homeData(request);
  const slot = slots[slots.length - 1]!; // now the second-furthest slot
  for (let i = 0; i < slot.left - 1; i++) await request.post("/api/orders", { data: orderBody(slot.key) });
  const results = await Promise.all([0, 1].map(() => request.post("/api/orders", { data: orderBody(slot.key) })));
  expect(results.map((r) => r.status()).sort()).toEqual([200, 400]);
});

test("unknown order links show a friendly 404", async ({ request }) => {
  const res = await request.get("/o/not-a-real-token");
  expect(res.status()).toBe(404);
  expect(await res.text()).toContain("Order not found");
});
