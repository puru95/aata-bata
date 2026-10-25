import { expect, test } from "@playwright/test";
import { fillDetails } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("home page is light, one request, and never scrolls sideways", async ({ page, request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html.length, "uncompressed HTML incl. inlined CSS+JS").toBeLessThan(45_000);
  expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis/);

  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `no sideways scroll at ${width}px`).toBe(false);
  }
});

test("starts on Custom with an empty 10 kg bag and checkout disabled", async ({ page }) => {
  await expect(page.locator('[data-preset="custom"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-size="10000"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#fillKg")).toContainText("0 of 10 kg");
  await expect(page.locator("#barBtn")).toBeDisabled();
});

test("presets fill the bag; changing size keeps the proportions", async ({ page }) => {
  await page.locator('[data-preset="multi"]').click();
  await expect(page.locator("#fstate")).toContainText("Bag full");
  await expect(page.locator("#barBtn")).toBeEnabled();

  await page.locator('[data-size="20000"]').click();
  await expect(page.locator("#fillKg")).toContainText("20 of 20 kg");
  const kgs = await page.locator(".grain output").allTextContents();
  expect(kgs.slice(0, 4)).toEqual(["14 kg", "2 kg", "2 kg", "2 kg"]); // wheat, ragi, jowar, bajra
});

test("+ and − steps, fill with wheat, clear and undo", async ({ page }) => {
  const plus = (g: string) => page.locator(`button.plus[data-g="${g}"]`);
  await plus("ragi").click();
  await plus("ragi").click();
  await expect(page.locator("#fstate")).toContainText("9 kg left");
  await expect(page.locator('[data-preset="custom"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator("#fillWheat").click();
  await expect(page.locator("#fstate")).toContainText("Bag full");
  await expect(plus("jowar"), "can't overfill").toBeDisabled();

  await page.locator("#clear").click();
  await expect(page.locator("#fillKg")).toContainText("0 of 10 kg");
  await page.locator("#undo").click();
  await expect(page.locator("#fillKg")).toContainText("10 of 10 kg");

  await page.locator('[data-g="ragi"][data-d="-1"]').click();
  await expect(page.locator("#fstate")).toContainText("0.5 kg left");
});

test("nutrition updates with the blend and switches to per roti", async ({ page }) => {
  await expect(page.locator("#nutSum")).toContainText("add grains");
  await page.locator('[data-preset="wheat"]').click();
  await expect(page.locator("#nutSum")).toContainText("322 kcal");
  await page.locator('[data-preset="ragi"]').click();
  await page.locator("details.nut summary").click();
  await expect(page.locator("#nut")).toContainText("Calcium");
  await page.locator("#perRoti").click();
  await expect(page.locator("#nut")).toContainText("Per roti (35 g)");
});

test("checkout shows an error under each missing field and blocks a part-filled bag", async ({ page }) => {
  await page.locator("button.plus[data-g='wheat']").click();
  await page.locator("#place").click();
  await expect(page.locator("#formErr")).toContainText("isn't full");

  await page.locator("#fillWheat").click();
  await page.locator("#place").click();
  await expect(page.locator("#e-name")).toHaveText("Enter your name");
  await expect(page.locator("#e-phone")).toContainText("10-digit");
  await expect(page.locator("#e-tower")).toHaveText("Enter your tower");
  await expect(page.locator("#e-flat")).toHaveText("Enter your flat number");
  await expect(page.locator("#f-name")).toBeFocused();

  await page.locator("#f-phone").fill("12345");
  await page.locator("#f-phone").blur();
  await expect(page.locator("#e-phone")).toContainText("10-digit");
  await page.locator("#f-phone").fill("9876543210");
  await expect(page.locator("#e-phone")).toHaveText("");
});

test("places an order end to end and finds it again under My orders", async ({ page }) => {
  await page.locator('[data-size="15000"]').click();
  await page.locator('[data-preset="fibre"]').click();
  await page.locator("[data-v='coarse']").click();
  await fillDetails(page);
  await page.locator("[data-v='upi']").click();
  const total = (await page.locator("#barP").textContent())!;
  await page.locator("#place").click();

  await expect(page).toHaveURL(/\/o\/[\w-]+\?new=1$/);
  await expect(page.getByText("Order placed").first()).toBeVisible();
  const num = (await page.locator("b", { hasText: /^PA-\d{5}$/ }).first().textContent())!;
  await expect(page.locator(".sum .t")).toContainText(total);
  await expect(page.locator(".kv")).toContainText("Coarse");
  await expect(page.locator(".kv")).toContainText("Tower B, Flat 1204");
  await expect(page.locator(".kv"), "phone is masked").toContainText("+91 98•••••210");

  await page.getByRole("link", { name: "My orders" }).click();
  await expect(page.locator(".list")).toContainText(num);

  // Details are remembered for next time on this phone.
  await page.goto("/");
  await expect(page.locator("#f-name")).toHaveValue("Priya Test");
});

test("a different phone can't see someone else's orders", async ({ browser }) => {
  const other = await browser.newContext();
  const page = await other.newPage();
  await page.goto("/my");
  await expect(page.getByText("No orders from this phone yet.")).toBeVisible();
  await other.close();
});
