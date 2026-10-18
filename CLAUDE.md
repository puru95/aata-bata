# CLAUDE.md — Project Atta web app

Custom chakki-atta blends, pilot in Purvanchal Royal City, Greater Noida. Read `README.md` for setup and layout; product docs are in `docs/` and `PLAN-*.md`.

## Top priority: fast and light
Customers open this from WhatsApp on cheap Android phones over patchy 4G.
- Home page is one request (~10 KB gzipped). Keep it under ~20 KB.
- No client frameworks, web fonts, images or third-party scripts. Inline SVG for icons.
- CSS (`src/client/styles.css`) and builder JS (`src/client/builder.ts`) are bundled by `scripts/build.mjs` and inlined into pages.

## Stack
Hono + server-rendered `hono/jsx` · Drizzle ORM · Postgres (Supabase) in production, PGlite locally · Zod · Vitest · TypeScript strict · npm.

## Conventions
- Money in integer paise (`_paise`), weight in integer grams (`_grams`). Format only at the edge (`src/lib/format.ts`).
- Business rules live in `src/domain/` as pure tested functions, shared with the browser bundle.
- Server always recomputes price; order rows snapshot prices and costs.
- Order status changes only via `transitionOrder()` in `src/lib/orders.ts`.
- Times stored UTC; slot dates and cutoffs computed in IST explicitly.
- Device session sees only its own orders. Never look up history by phone number for a customer.
- No health claims in copy. Nutrition is IFCT 2017 data, shown as information.
- Order sizes 5–25 kg in 5 kg steps; grains in 0.5 kg steps.

## Before saying something is done
`npm run typecheck && npm test && npm run build`, then load `/` and check the gzipped size.

## Out of scope for now
Native app, chakki shop app, online payments, OTP login, subscriptions, coupons.
