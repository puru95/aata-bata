import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN_PASSWORD = "e2e-pass";

type HomeData = { slots: { key: string; dateLabel: string; label: string; left: number }[]; grains: { id: string; sell: number }[] };

/** The catalog JSON the home page embeds for the builder. */
export async function homeData(request: APIRequestContext): Promise<HomeData> {
  const html = await (await request.get("/")).text();
  const m = html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/);
  expect(m, "home page embeds catalog data").toBeTruthy();
  return JSON.parse(m![1]!);
}

export function orderBody(slot: string, over: Record<string, unknown> = {}) {
  return {
    sizeGrams: 5000,
    grind: "medium",
    lines: [
      { grainId: "wheat", grams: 4000 },
      { grainId: "ragi", grams: 1000 },
    ],
    slot,
    payment: "cod",
    name: "API Tester",
    phone: "9000000002",
    society: "Purvanchal Royal City",
    tower: "A",
    flat: "101",
    note: "",
    ...over,
  };
}

export async function opsLogin(page: Page) {
  await page.goto("/ops/login");
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
}

/** Fill the checkout form with valid details. */
export async function fillDetails(page: Page, name = "Priya Test", phone = "98765 43210") {
  await page.locator("#f-name").fill(name);
  await page.locator("#f-phone").fill(phone);
  await page.locator("#f-tower").fill("B");
  await page.locator("#f-flat").fill("1204");
}
