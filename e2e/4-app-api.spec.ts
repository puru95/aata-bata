import { expect, test, type APIRequestContext } from "@playwright/test";

// JSON API used by the React Native app. In tests, every number gets the code 123456.
const API = "/api/v1";

async function signIn(request: APIRequestContext, phone: string) {
  expect((await request.post(`${API}/auth/otp`, { data: { phone } })).status()).toBe(200);
  const res = await request.post(`${API}/auth/verify`, { data: { phone, code: "123456" } });
  expect(res.status()).toBe(200);
  const { token } = await res.json();
  return { authorization: `Bearer ${token}` };
}

test("catalog and slots are public", async ({ request }) => {
  const cat = await (await request.get(`${API}/catalog`)).json();
  expect(cat.grains.map((g: { id: string }) => g.id)).toContain("wheat");
  expect(cat.sizesGrams).toEqual([5000, 10000, 15000, 20000, 25000]);
  expect(cat.grains[0].nutrition.kj).toBeGreaterThan(1000);
  const { slots } = await (await request.get(`${API}/slots`)).json();
  expect(slots.length).toBeGreaterThan(0);
});

test("sign-in rejects bad numbers and wrong codes, then returns a token", async ({ request }) => {
  const bad = await request.post(`${API}/auth/otp`, { data: { phone: "12345" } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).field).toBe("phone");

  await request.post(`${API}/auth/otp`, { data: { phone: "9811111111" } });
  const wrong = await request.post(`${API}/auth/verify`, { data: { phone: "9811111111", code: "000000" } });
  expect(wrong.status()).toBe(400);
  expect((await wrong.json()).code).toBe("wrong_code");

  const ok = await request.post(`${API}/auth/verify`, { data: { phone: "+91 98111 11111", code: "123456" } });
  expect(ok.status()).toBe(200);
  const j = await ok.json();
  expect(j.token.length).toBeGreaterThan(30);
  expect(j.isNew).toBe(true);
  expect(j.user.phone).toBe("+919811111111");

  const reuse = await request.post(`${API}/auth/verify`, { data: { phone: "9811111111", code: "123456" } });
  expect(reuse.status(), "a code works once").toBe(400);
});

test("signed-in routes need a valid token", async ({ request }) => {
  expect((await request.get(`${API}/me`)).status()).toBe(401);
  expect((await request.get(`${API}/me`, { headers: { authorization: "Bearer not-a-real-token-xxxxxxxx" } })).status()).toBe(401);
  const h = await signIn(request, "9822222222");
  expect((await request.post(`${API}/auth/logout`, { headers: h })).status()).toBe(200);
  expect((await request.get(`${API}/me`, { headers: h })).status(), "logged-out token stops working").toBe(401);
});

test("profile, address and saved blends", async ({ request }) => {
  const h = await signIn(request, "9833333333");
  const me = await (await request.patch(`${API}/me`, { headers: h, data: { name: "Kavita", language: "hi" } })).json();
  expect(me.user).toMatchObject({ name: "Kavita", language: "hi" });

  const badAddr = await request.post(`${API}/addresses`, { headers: h, data: { societyName: "Elsewhere", tower: "A", flat: "1" } });
  expect(badAddr.status()).toBe(400);
  const addr = await (await request.post(`${API}/addresses`, { headers: h, data: { societyName: "Purvanchal Royal City", tower: "C", flat: "903" } })).json();
  expect(addr.address.isDefault, "first address becomes default").toBe(true);

  const badBlend = await request.post(`${API}/blends`, { headers: h, data: { name: "Half", sizeGrams: 10000, grind: "fine", lines: [{ grainId: "wheat", grams: 5000 }] } });
  expect(badBlend.status()).toBe(400);
  const created = await (
    await request.post(`${API}/blends`, { headers: h, data: { name: "Family mix", sizeGrams: 10000, grind: "medium", lines: [{ grainId: "wheat", grams: 7000 }, { grainId: "ragi", grams: 3000 }] } })
  ).json();
  const id = created.blend.id;
  const renamed = await (
    await request.patch(`${API}/blends/${id}`, { headers: h, data: { name: "Kids mix", sizeGrams: 10000, grind: "fine", lines: [{ grainId: "wheat", grams: 7000 }, { grainId: "ragi", grams: 3000 }] } })
  ).json();
  expect(renamed.blend.name).toBe("Kids mix");
  expect((await (await request.get(`${API}/blends`, { headers: h })).json()).blends).toHaveLength(1);
  await request.delete(`${API}/blends/${id}`, { headers: h });
  expect((await (await request.get(`${API}/blends`, { headers: h })).json()).blends).toHaveLength(0);
});

test("place, track and cancel an order from the app; other users can't see it", async ({ request }) => {
  const h = await signIn(request, "9844444444");
  await request.patch(`${API}/me`, { headers: h, data: { name: "Rohit" } });
  const { address } = await (await request.post(`${API}/addresses`, { headers: h, data: { societyName: "Purvanchal Royal City", tower: "E", flat: "12", note: "ring twice" } })).json();
  const { slots } = await (await request.get(`${API}/slots`)).json();

  const res = await request.post(`${API}/orders`, {
    headers: h,
    data: { sizeGrams: 10000, grind: "coarse", lines: [{ grainId: "wheat", grams: 8000 }, { grainId: "bajra", grams: 2000 }], slot: slots[0].key, payment: "upi", addressId: address.id },
  });
  expect(res.status()).toBe(201);
  const { order } = await res.json();
  expect(order.number).toMatch(/^PA-\d{5}$/);
  const cat = await (await request.get(`${API}/catalog`)).json();
  const sell = (id: string) => cat.grains.find((g: { id: string }) => g.id === id).sellPaisePerKg;
  expect(order.totalPaise, "server price matches catalog").toBe(8 * sell("wheat") + 2 * sell("bajra") + 10 * cat.price.grindChargePaisePerKg);
  expect(order.timeline[0]).toMatchObject({ label: "Order placed", state: "current" });
  expect(order.address).toMatchObject({ tower: "E", flat: "12" });
  expect(order.canCancel).toBe(true);

  const list = await (await request.get(`${API}/orders`, { headers: h })).json();
  expect(list.orders.map((o: { id: string }) => o.id)).toContain(order.id);

  const other = await signIn(request, "9855555555");
  expect((await request.get(`${API}/orders/${order.id}`, { headers: other })).status()).toBe(404);
  expect((await request.post(`${API}/orders/${order.id}/cancel`, { headers: other })).status()).toBe(404);

  const cancelled = await (await request.post(`${API}/orders/${order.id}/cancel`, { headers: h })).json();
  expect(cancelled.order.status).toBe("CANCELLED");
  expect((await request.post(`${API}/orders/${order.id}/cancel`, { headers: h })).status(), "can't cancel twice").toBe(400);
});

test("an app order needs one of the user's own addresses", async ({ request }) => {
  const a = await signIn(request, "9866666666");
  const b = await signIn(request, "9877777777");
  await request.patch(`${API}/me`, { headers: b, data: { name: "B" } });
  const { address } = await (await request.post(`${API}/addresses`, { headers: a, data: { societyName: "Purvanchal Royal City", tower: "A", flat: "1" } })).json();
  const { slots } = await (await request.get(`${API}/slots`)).json();
  const res = await request.post(`${API}/orders`, {
    headers: b,
    data: { sizeGrams: 5000, grind: "fine", lines: [{ grainId: "wheat", grams: 5000 }], slot: slots[0].key, payment: "cod", addressId: address.id },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).field).toBe("addressId");
});
