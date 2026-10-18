# Project Atta — web app

Customers build a custom flour blend, see price and nutrition, and place an order for a delivery slot. Founders manage orders and prices at `/ops`.

Built for speed on cheap phones: server-rendered HTML with the CSS and builder script inlined, so the home page is **one request, about 10 KB gzipped**. No frameworks or web fonts are sent to the browser.

## Run it on your Mac

```bash
npm install
cp .env.example .env        # then set SESSION_SECRET and ADMIN_PASSWORD
npm run db:setup            # creates a local database in .data/ and adds placeholder prices
npm run dev                 # http://localhost:3456
```

The local database is PGlite, a real Postgres that runs inside Node. No Docker needed. Delete `.data/` and run `npm run db:setup` again to start fresh.

| Page | What it is |
|---|---|
| `/` | Blend builder and checkout |
| `/o/<token>` | Order status page (the link customers keep) |
| `/my` | Orders placed from this phone |
| `/ops` | Founders' panel: orders, status changes, mark paid, WhatsApp confirmations, chakki ticket |
| `/ops/prices` | Grain prices, grinding and delivery charges, cutoff, UPI ID, your WhatsApp number |

**First thing after setup:** open `/ops/prices` and enter real prices, your UPI ID and your WhatsApp number. The seeded prices are placeholders.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server with reload |
| `npm test` | Pricing, blend and status tests |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Builds `dist/` |
| `npm start` | Runs the built server |
| `npm run db:generate` | New migration after editing `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` | Apply migrations / add seed data |

## Put it online

You need two things: a Postgres database and a place to run a Node server, both in or near Mumbai.

1. **Database:** create a Supabase project in the Mumbai region. Copy the connection pooler URL (transaction mode) into `DATABASE_URL`.
2. **Server:** any host that runs Node 24 (Railway, Render, Fly.io, or a small VPS). Pick a Mumbai or Singapore region and a plan that doesn't sleep; free plans that sleep make the first visit slow.
   - Build command: `npm install && npm run build`
   - Start command: `npm run db:migrate && npm run db:seed && npm start`
   - Env vars: `DATABASE_URL`, `SESSION_SECRET` (long random string), `ADMIN_PASSWORD`, `COOKIE_SECURE=1`, `NODE_ENV=production`
3. Open `https://<your-site>/ops/prices` and set prices, UPI ID and WhatsApp number.
4. Share `https://<your-site>/` in the society group.

`db:seed` only adds rows that don't exist yet, so running it on every start is safe.

## How it's organised

```text
src/
├── domain/        pricing, blend rules, nutrition, order status (pure, tested; also bundled into the browser)
├── db/            Drizzle schema, connection (Postgres or PGlite), migrate, seed
├── lib/           catalog + slots, order creation, sessions, formatting, inlined assets
├── views/         server-rendered pages (hono/jsx, no client React)
├── client/        builder.ts and styles.css → bundled into dist/client and inlined into pages
├── app.ts         routes
└── server.ts      Node entry
```

Rules that matter:
- Money is integer paise, weight is integer grams.
- The server recomputes every price; order lines keep the price at the time of order.
- Status changes go through `transitionOrder()` only.
- A phone only sees orders placed from it; typing a phone number never shows anyone's history.
- Keep the home page small: check `curl -s -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}\n' http://localhost:3456/` after changes.
