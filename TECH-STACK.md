# Tech Stack — Project Atta

> **Update 18 Oct 2026:** speed is the top priority, so the web app is built with **Hono + server-rendered HTML** (hono/jsx), Drizzle, Postgres (Supabase; PGlite locally) and a small inlined vanilla-JS builder, instead of Next.js + Tailwind + shadcn/ui. The home page is one request, about 10 KB gzipped. Sections below that mention Next.js, Tailwind, shadcn/ui, Supabase Auth, Vercel regions or pnpm describe the earlier plan; see `README.md` and `CLAUDE.md` for what is actually built.

One codebase serves three apps: the **Customer app**, the **Shop app** (partner chakki) and the **Admin panel**. All three share the same database, pricing logic and order-status rules.

See also: [PLAN-customer-app.md](PLAN-customer-app.md), [PLAN-shop-app.md](PLAN-shop-app.md), [PLAN-admin-panel.md](PLAN-admin-panel.md).

---

## Recommendation: one Next.js app, three areas

For a two-founder pilot, run all three apps from **one Next.js deployment**, split by route and role:

| App | Route | Who | Login |
|---|---|---|---|
| Customer | `/`, `/build`, `/checkout`, `/orders/[token]`, `/blends` | Households | None in pilot (device session + order link) |
| Shop | `/shop/*` | Chakki owner / staff | Personal login link + 4-digit PIN |
| Admin | `/ops/*` | Founders | Email magic link, allowlisted |

Why one app and not three:
- One deploy, one domain, one set of env vars, one bill.
- Pricing, validation and status rules are imported, not copied, so they can't drift apart.
- Splitting later is easy: the folder layout below already separates the three.

Split into a monorepo (Turborepo, `apps/customer`, `apps/shop`, `apps/admin`, `packages/domain`, `packages/db`) only when one of these happens: separate teams, very different release cycles, or the customer app needs to be a native app.

---

## The stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript strict** | Server Actions keep DB access on the server; one framework for all three apps. |
| Database | **Postgres on Supabase (Mumbai, ap-south-1)** | Managed Postgres, auth and file storage in one place; low latency from Noida. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Typed SQL, simple migrations, no heavy runtime. |
| Validation | **Zod** | One schema used by forms and server actions. |
| UI | **Tailwind CSS + shadcn/ui** | Fast to build, small bundle, easy to theme per app. |
| Admin auth | **Supabase Auth, email magic link** | Allowlisted admins only. |
| Shop auth | **Signed login link + PIN** (custom, stored in DB) | Chakki owners may not use email; SMS OTP needs DLT registration. |
| Customer identity | **Device session cookie + unguessable order link** | No OTP until DLT/WhatsApp OTP is set up. |
| Files | **Supabase Storage** | UPI QR image, pack photos from the shop. |
| PWA | **Serwist** | Installable on Android, offline fallback page. |
| Tests | **Vitest** (domain logic), **Playwright** (checkout + shop flow, later) | Pricing must be tested first. |
| Hosting | **Vercel, region bom1 (Mumbai)** | Close to the database. |
| Errors | **Sentry** (free tier) | See failures on cheap phones you can't reproduce. |
| Analytics | **Plausible or PostHog** (pick one, later) | Funnel: build → checkout → order. |
| Package manager | **pnpm** | |

### Later, when the pilot works
| Need | Add |
|---|---|
| Online payment | Razorpay (after business registration) |
| OTP login | WhatsApp Business API OTP (e.g. Gupshup / Interakt) or SMS after DLT |
| Order notifications | WhatsApp Business API templates |
| Shop app as a real phone app | Keep the PWA; wrap with Capacitor only if push notifications on Android are unreliable |

### Do not add in the pilot
Redux, GraphQL, microservices, queues, Kubernetes, a separate backend server, native apps.

---

## Folder layout

```text
src/
├── app/
│   ├── (customer)/        # /, /build, /checkout, /orders/[token], /blends
│   ├── shop/              # /shop, /shop/orders/[id], /shop/history, /shop/login
│   ├── ops/               # admin panel
│   └── api/               # only where Server Actions don't fit (e.g. webhooks later)
├── config/brand.ts
├── db/                    # schema.ts, index.ts, seed.ts, migrations/
├── domain/                # pure, tested: pricing, blend, order-status, packs, metrics, ticket
├── lib/                   # format, auth (admin / shop / customer session), utils
└── components/
    ├── customer/
    ├── shop/
    ├── ops/
    └── ui/                # shadcn
```

---

## Shared rules (all three apps)

- Money in integer **paise**, weight in integer **grams**. No floats.
- Prices are always recomputed on the server. Order lines snapshot price and cost.
- Order status changes go only through `transitionOrder()`, which checks the role (customer / shop / admin) and writes a status event.
- All DB access is server-side. RLS is enabled on every table with no anon policies, as a safety net.
- Supabase pooler in transaction mode: set `prepare: false` in the postgres-js client.
- Times stored in UTC, shown in `Asia/Kolkata`. Slot dates ("next 7 days", cutoffs) are calculated in IST explicitly, because Vercel runs in UTC.
- Order numbers (`PA-00042`) come from a Postgres sequence.

---

## Roles and what each can do

| Action | Customer | Shop | Admin |
|---|---|---|---|
| Place order | ✓ | | ✓ (on behalf) |
| See own order by link | ✓ | | ✓ |
| See assigned orders | | ✓ | ✓ |
| Accept / start / mark ready | | ✓ | ✓ |
| Record output weight, notes | | ✓ | ✓ |
| Assign partner, confirm, cancel | | | ✓ |
| Edit prices, grains, slots | | | ✓ |
| See costs, margins, metrics | | | ✓ |

The shop never sees customer phone numbers or selling prices; it sees the order number, the blend, the bags and the pickup time.

---

## Environments

| Env | Supabase project | Vercel |
|---|---|---|
| Local | Supabase CLI (Docker) or a dev project | `pnpm dev` |
| Preview | Dev project | Preview deploys per branch |
| Production | Separate prod project (Mumbai) | `main` branch |

`.env.example`: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `SHOP_LINK_SECRET`, `SENTRY_DSN`.

---

## Rough monthly cost during the pilot

| Item | Cost |
|---|---|
| Vercel Hobby → Pro when going commercial | ₹0 → about $20 |
| Supabase Free → Pro when you need backups | ₹0 → about $25 |
| Domain | about ₹1,000 / year |
| Sentry, analytics | free tiers |

Check current pricing before committing; these are approximate.
