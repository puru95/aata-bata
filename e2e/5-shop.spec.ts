import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { homeData, opsLogin, orderBody } from "./helpers";

// One flow, in order: admin onboards a shop, the shop sets a PIN and grinds an order.
test.describe.configure({ mode: "serial" });

const SHOP = "Sharma Chakki";
let setupUrl = "";
let shopPage: Page;

async function shopPhone(browser: Browser) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], baseURL: test.info().project.use.baseURL, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  return ctx.newPage();
}

/** Admin: open the order placed by `name` and run `fn` on its page. */
async function adminOrder(page: Page, name: string) {
  await page.goto("/ops?status=all");
  await page.locator("tr", { hasText: name }).getByRole("link", { name: /PA-\d+/ }).click();
  await expect(page.locator(".kv").last()).toContainText(name);
}

test("admin adds a shop and a person, and gets a one-time login link", async ({ page }) => {
  await opsLogin(page);
  await page.getByRole("link", { name: "Shops" }).click();
  await expect(page.getByRole("heading", { name: "Shops" })).toBeVisible();

  await page.getByLabel("Shop name").fill(SHOP);
  await page.getByLabel("Owner").fill("Ramesh Sharma");
  await page.getByLabel("Mobile (WhatsApp)").fill("12345");
  await page.getByLabel("We pay per kg (₹)").fill("3");
  await page.getByRole("button", { name: "Add shop" }).click();
  await expect(page.getByRole("alert")).toContainText("10-digit mobile");
  await expect(page.getByLabel("Shop name"), "keeps what was typed").toHaveValue(SHOP);

  await page.getByLabel("Mobile (WhatsApp)").fill("98100 00001");
  await page.getByRole("button", { name: "Add shop" }).click();
  await expect(page.getByRole("heading", { name: SHOP })).toBeVisible();
  await expect(page.locator(".flash")).toContainText("Shop added");

  await page.getByLabel("Add a person").fill("Ramesh");
  await page.getByRole("button", { name: "Add and make link" }).click();
  await expect(page.getByRole("heading", { name: "Login link for Ramesh" })).toBeVisible();
  setupUrl = await page.getByLabel("Login link").inputValue();
  expect(setupUrl).toMatch(/\/shop\/setup\/[\w-]{20,}$/);
  const wa = await page.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href");
  expect(wa, "WhatsApp goes to the shop's number").toContain("wa.me/919810000001?text=");
  await expect(page.getByText("Link sent · works till")).toBeVisible();
});

test("the shop opens the link and picks a PIN; the link then stops working", async ({ browser }) => {
  shopPage = await shopPhone(browser);
  const p = shopPage;
  await p.goto("/shop");
  await expect(p.getByText("Open the login link")).toBeVisible();

  await p.goto(setupUrl);
  await expect(p.getByRole("heading", { name: "Namaste, Ramesh" })).toBeVisible();
  await p.getByLabel("New PIN").fill("4826");
  await p.getByLabel("Same PIN again").fill("4827");
  await p.getByRole("button", { name: /Save PIN/ }).click();
  await expect(p.getByRole("alert")).toContainText("don't match");

  await p.getByLabel("New PIN").fill("1234");
  await p.getByLabel("Same PIN again").fill("1234");
  await p.getByRole("button", { name: /Save PIN/ }).click();
  await expect(p.getByRole("alert")).toContainText("too easy");

  await p.getByLabel("New PIN").fill("4826");
  await p.getByLabel("Same PIN again").fill("4826");
  await p.getByRole("button", { name: /Save PIN/ }).click();
  await expect(p.getByRole("heading", { name: SHOP })).toBeVisible();
  await expect(p.getByText("Nothing to grind right now")).toBeVisible();

  const again = await p.request.get(setupUrl);
  expect(again.status(), "link is single-use").toBe(410);
});

test("an order sent to the shop goes accept → grind → ready, without customer details", async ({ page, request }) => {
  const { slots } = await homeData(request);
  await request.post("/api/orders", { data: orderBody(slots[0]!.key, { name: "Shop Flow", phone: "9000000077", tower: "Q", flat: "909" }) });
  await opsLogin(page);
  await adminOrder(page, "Shop Flow");
  await page.locator("#shop").selectOption({ label: SHOP });
  await page.getByRole("button", { name: "Assign" }).click();
  await page.getByRole("button", { name: "→ Confirmed" }).click();
  await page.getByRole("button", { name: "→ Sent to chakki" }).click();
  await expect(page.locator("h1 .badge")).toHaveText("Sent to chakki");
  const ticket = await page.getByRole("link", { name: `Send ticket to ${SHOP}` }).getAttribute("href");
  expect(ticket).toContain("wa.me/919810000001?text=");

  const p = shopPage;
  await p.goto("/shop");
  const card = p.locator("article.card").first();
  await expect(card).toContainText("5 kg");
  await expect(card).toContainText("Wheat");
  for (const secret of ["Shop Flow", "9000000077", "909"]) await expect(p.locator("body")).not.toContainText(secret);

  await card.getByRole("button", { name: /Accept/ }).click();
  await expect(p.locator(".flash")).toContainText("Accepted");
  await p.locator("article.card").first().getByRole("button", { name: /Start grinding/ }).click();
  await expect(p.locator(".flash")).toContainText("Grinding started");

  await p.locator("article.card").first().getByLabel(/Packed weight/).fill("2");
  await p.locator("article.card").first().getByRole("button", { name: /Ready/ }).click();
  await expect(p.getByRole("alert")).toContainText("between 4 and 5.25");
  await p.locator("article.card").first().getByLabel(/Packed weight/).fill("4.9");
  await p.locator("article.card").first().getByRole("button", { name: /Ready/ }).click();
  await expect(p.locator(".flash")).toContainText("Marked ready");
  await expect(p.getByText("Packed 4.9 kg · waiting for pickup")).toBeVisible();

  await adminOrder(page, "Shop Flow");
  await expect(page.locator("h1 .badge")).toHaveText("Ground and packed");
  await expect(page.getByText("Packed weight from shop: 4.9 kg")).toBeVisible();
  await expect(page.locator("ul.list")).toContainText("shop:");
});

test("the shop reports a problem and admin marks it solved", async ({ page }) => {
  const p = shopPage;
  await p.goto("/shop");
  const card = p.locator("article.card").first();
  await card.getByText(/Report a problem/).click();
  await card.getByLabel("What's wrong?").fill("Bag torn, repacking");
  await card.getByRole("button", { name: "Send" }).click();
  await expect(p.locator(".flash")).toContainText("Problem sent");
  await expect(p.locator("article.card").first()).toContainText("Problem sent: Bag torn, repacking");

  await opsLogin(page);
  await page.goto("/ops?status=all");
  await expect(page.locator("tr", { hasText: "Shop Flow" })).toContainText("Problem");
  await adminOrder(page, "Shop Flow");
  await expect(page.getByText("Shop reported a problem: Bag torn, repacking")).toBeVisible();
  await page.getByRole("button", { name: "Mark solved" }).click();
  await expect(page.locator(".flash")).toContainText("Problem marked solved");
  await expect(page.getByText("Shop reported a problem")).toHaveCount(0);
});

test("a shop can't act on another shop's order", async ({ request, baseURL }) => {
  const { slots } = await homeData(request);
  await request.post("/api/orders", { data: orderBody(slots[0]!.key, { name: "Not Theirs" }) });
  const p = shopPage;
  // An order id the shop isn't assigned to: take one from admin's list via a fresh admin page.
  const admin = await p.context().browser()!.newPage({ baseURL });
  await opsLogin(admin);
  await adminOrder(admin, "Not Theirs");
  const id = admin.url().match(/\/ops\/o\/([0-9a-f-]{36})/)![1]!;
  await admin.close();

  const res = await p.request.post(`/shop/o/${id}/accept`, { form: {}, headers: { origin: baseURL! } });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain("Order not found.");
});

test("PIN sign-in: wrong PIN counts down, right PIN opens the queue", async () => {
  const p = shopPage;
  await p.goto("/shop");
  await p.getByRole("button", { name: "Log out" }).click();
  await expect(p.getByRole("heading", { name: "Ramesh" })).toBeVisible();
  await p.getByLabel("PIN").fill("0000");
  await p.getByRole("button", { name: /Open/ }).click();
  await expect(p.getByRole("alert")).toContainText("Wrong PIN. 4 tries left.");
  await p.getByLabel("PIN").fill("4826");
  await p.getByRole("button", { name: /Open/ }).click();
  await expect(p.getByRole("heading", { name: SHOP })).toBeVisible();
});

test("turning a person off signs them out at once; a new link sets a new PIN", async ({ page }) => {
  await opsLogin(page);
  await page.goto("/ops/shops");
  await page.getByRole("link", { name: new RegExp(SHOP) }).click();
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.locator(".flash")).toContainText("Ramesh turned off and signed out");

  const p = shopPage;
  await p.goto("/shop");
  await expect(p).toHaveURL(/\/shop\/login$/);
  await expect(p.getByText("Open the login link")).toBeVisible();

  await page.getByRole("button", { name: "Turn on" }).click();
  await page.getByRole("button", { name: "New login link" }).click();
  await expect(page.locator(".flash")).toContainText("Their old PIN no longer works");
  const url = await page.getByLabel("Login link").inputValue();

  await p.goto(url);
  await p.getByLabel("New PIN").fill("5937");
  await p.getByLabel("Same PIN again").fill("5937");
  await p.getByRole("button", { name: /Save PIN/ }).click();
  await expect(p.getByRole("heading", { name: SHOP })).toBeVisible();
  await p.context().close();
});
