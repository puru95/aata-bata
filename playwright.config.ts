import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a fresh local server with its own PGlite database (.data/e2e).
// Tests share that database, so they run one at a time in file order.
const PORT = 3457;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"], // phone size, touch, Chrome
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/build.mjs && rm -rf .data/e2e && npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npx tsx src/server.ts",
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      PGLITE_DIR: ".data/e2e",
      DATABASE_URL: "",
      SESSION_SECRET: "e2e-secret-0123456789abcdef",
      ADMIN_PASSWORD: "e2e-pass",
      COOKIE_SECURE: "0",
      ORDER_RATE_LIMIT: "1000", LOGIN_RATE_LIMIT: "1000",
      SEED_DEMO_SHOP: "1",
    },
  },
});
