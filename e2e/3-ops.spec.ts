import { expect, test, type Page } from "@playwright/test";
import { homeData, opsLogin, orderBody } from "./helpers";

/** Open the ops detail page for the order placed by `name`. */
async function openOrder(page: Page, name: string) {
  await page.locator("tr", { hasText: name }).getByRole("link", { name: /PA-\d+/ }).click();
  await expect(page.locator(".kv").last()).toContainText(name);
}

test("ops pages need the password", async ({ page }) => {
  await page.goto("/ops");
  await expect(page).toHaveURL(/\/ops\/login$/);
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong password.")).toBeVisible();
  await opsLogin(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/ops");
  await expect(page).toHaveURL(/\/ops\/login$/);
});

test("an order moves through every status, one step at a time", async ({ page, request }) => {
  const { slots } = await homeData(request);
  const res = await request.post("/api/orders", { data: orderBody(slots[0]!.key, { name: "Status Flow" }) });
  const publicUrl = (await res.json()).url.replace("?new=1", "");

  await opsLogin(page);
  await openOrder(page, "Status Flow");

  // No skipping ahead: only next step, back one step, or cancel.
  await expect(page.getByRole("button", { name: /Delivered/ })).toHaveCount(0);

  await page.getByRole("button", { name: "→ Confirmed" }).click();
  await page.getByRole("button", { name: "→ Sent to chakki" }).click();
  await expect(page.locator(".flash"), "needs a shop first").toContainText("Assign a shop");
  await page.locator("#shop").selectOption({ label: "Demo Chakki" });
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.locator(".flash")).toContainText("Shop saved");

  for (const next of ["Sent to chakki", "Accepted by chakki", "Grinding", "Ground and packed", "Out for delivery", "Delivered"]) {
    await page.getByRole("button", { name: `→ ${next}` }).click();
    await expect(page.locator(".flash")).toContainText("Status updated");
    await expect(page.locator("h1 .badge")).toHaveText(next);
  }
  await expect(page.getByRole("button", { name: /Cancel order/ }), "delivered is final").toHaveCount(0);

  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.locator(".flash")).toContainText("Marked paid");
  await expect(page.locator(".kv").last()).toContainText("COD · paid");

  await page.goto(publicUrl);
  await expect(page.locator(".tl li.done")).toHaveCount(6);
  await expect(page.locator(".kv")).toContainText("Paid");
});

test("going back one step and cancelling are recorded", async ({ page, request }) => {
  const { slots } = await homeData(request);
  await request.post("/api/orders", { data: orderBody(slots[0]!.key, { name: "Cancel Flow" }) });
  await opsLogin(page);
  await openOrder(page, "Cancel Flow");
  await page.getByRole("button", { name: "→ Confirmed" }).click();
  await page.getByRole("button", { name: "← Back to Order placed" }).click();
  await expect(page.locator("h1 .badge")).toHaveText("Order placed");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.locator("h1 .badge")).toHaveText("Cancelled");
  await expect(page.locator(".list")).toContainText("Confirmed → Order placed");
});

test("WhatsApp buttons carry the order details", async ({ page, request }) => {
  const { slots } = await homeData(request);
  await request.post("/api/orders", { data: orderBody(slots[0]!.key, { name: "Wa Check" }) });
  await opsLogin(page);
  await openOrder(page, "Wa Check");
  const confirm = await page.getByRole("link", { name: "Confirm with customer" }).getAttribute("href");
  expect(confirm).toMatch(/^https:\/\/wa\.me\/919000000002\?text=/);
  expect(decodeURIComponent(confirm!)).toContain("Wheat: 4 kg");
  const ticket = await page.getByRole("link", { name: "Send ticket to chakki" }).getAttribute("href");
  expect(decodeURIComponent(ticket!)).toMatch(/ORDER PA-\d+[\s\S]*MEDIUM GRIND/);
  expect(decodeURIComponent(ticket!), "chakki ticket has no customer phone").not.toContain("9000000002");
});

test("price changes apply to new orders only; settings show on the customer page", async ({ page, request }) => {
  const { slots } = await homeData(request);
  const before = await request.post("/api/orders", { data: orderBody(slots[0]!.key) });
  const beforeUrl = (await before.json()).url;
  expect(await (await request.get(beforeUrl)).text()).toContain("₹255");

  await opsLogin(page);
  await page.getByRole("link", { name: "Prices" }).click();
  await page.getByLabel("Wheat sell price").fill("50");
  await page.locator("#upi").fill("atta@okaxis");
  await page.locator("#wa").fill("919812345678");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".flash")).toContainText("Saved");

  // Bad input is refused without saving.
  await page.getByLabel("Wheat sell price").fill("fifty");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".err")).toContainText("Check the prices for Wheat");

  const after = await request.post("/api/orders", { data: orderBody(slots[0]!.key, { payment: "upi" }) });
  const afterHtml = await (await request.get((await after.json()).url)).text();
  expect(afterHtml).toContain("₹295"); // 4 kg wheat @ ₹50 + 1 kg ragi @ ₹70 + ₹25 grinding
  expect(afterHtml).toContain("atta@okaxis");
  expect(afterHtml).toContain("wa.me/919812345678");
  expect(await (await request.get(beforeUrl)).text(), "old order keeps its price").toContain("₹255");
});
