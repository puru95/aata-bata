# Build Plan — App, Shop Panel, Admin Console

> Last updated: 25 Oct 2026 · Status: in progress
> Screens and flow: https://claude.ai/artifact/CDodqoxkbGmcjHJVP9a77G
> Related: [MASTER-PLAN.md](MASTER-PLAN.md) · [PRD.md](PRD.md) · [../README.md](../README.md)

## 1. What we're building

| Surface | Who | Tech | Where |
|---|---|---|---|
| **Customer app** | Households | React Native (Expo), Android + iOS | Play Store, App Store |
| **Order web page** | Anyone with the link | Existing Hono page (10 KB) | aata-bata.vercel.app |
| **Shop panel** | Partner chakki staff | Server-rendered web, phone-first, Hindi + English | /shop |
| **Admin console** | Founders | Server-rendered web | /ops |
| **Backend + API** | All of the above | Hono on Vercel (Mumbai), Postgres on Supabase (Mumbai) | /api/v1 |

One backend and one database serve everything. Pricing, blend rules and order status logic stay in `src/domain/` and are shared with the app.

## 2. Repository layout

```text
customAtta/
├── src/                 backend: web pages, shop panel, admin console, JSON API
│   └── domain/          shared rules (pricing, blends, nutrition, status) — imported by the app too
├── apps/mobile/         Expo React Native app (Android + iOS)
├── e2e/                 Playwright tests for web, shop and admin
└── docs/
```

The app imports `src/domain/*` directly, so a price shown in the app is computed by the same code the server trusts.

## 3. Order status (all surfaces)

```text
PLACED → CONFIRMED → SENT_TO_SHOP → ACCEPTED → GRINDING → READY → OUT_FOR_DELIVERY → DELIVERED
any non-final → CANCELLED        shop can raise PROBLEM (admin resolves)
```

| Who moves it | Moves |
|---|---|
| Customer | place; cancel while PLACED |
| Admin | confirm, assign shop, out for delivery, delivered, cancel, one step back |
| Shop | accept, start grinding, ready (with output weight), report problem |

## 4. Accounts and login

| Surface | Login | Notes |
|---|---|---|
| App | Mobile number + 6-digit OTP | Provider is an open decision (see §8). Until chosen, dev builds accept a fixed test code. Session token stored in the phone's secure storage. |
| Web order page | None (device cookie) | Unchanged. If the same number later signs into the app, the admin can merge history. |
| Shop panel | Personal login link from admin + 4-digit PIN | No email/SMS needed for chakki staff. |
| Admin console | Password today → email magic link later | Allowlisted founders only. |

## 5. Data model changes

New tables: `app_users` (customer login by phone), `auth_codes` (hashed OTPs, expiry, attempts), `app_sessions`, `addresses`, `saved_blends`, `push_tokens`, `shops`, `shop_users` (PIN hash), `shop_sessions`, `order_actuals`, `payouts`.
Changed: `orders` gets `shop_id`, `output_grams`, `source` (`web` | `app`), `app_user_id`; status values above.

## 6. JSON API for the app (`/api/v1`)

| Method | Path | Does |
|---|---|---|
| POST | `/auth/otp` | Send code to a mobile number (rate-limited) |
| POST | `/auth/verify` | Check code → session token |
| GET | `/catalog` | Grains, presets, prices, nutrition, societies |
| GET | `/slots` | Bookable delivery slots |
| POST | `/quote` | Server price for a blend (optional; app also prices locally) |
| GET/POST/PATCH/DELETE | `/addresses` | Saved addresses |
| GET/POST/PATCH/DELETE | `/blends` | Saved blends |
| POST | `/orders` | Place an order |
| GET | `/orders`, `/orders/:id` | History and tracking |
| POST | `/orders/:id/cancel` | Cancel while PLACED |
| POST | `/push-token` | Register for order notifications |

Bearer-token auth, JSON in/out, Zod-validated, same error shape as today (`{error, field?, code?}`).

## 7. Phases

| Phase | Scope | Done when |
|---|---|---|
| **1. Backend foundations** | Schema changes, new statuses, shops, JSON API with test-OTP login | API tests pass; web page still works |
| **2. Shop panel** ✅ (payouts still to do) | PIN login, today's queue, order card, start grinding, mark ready with weight, report problem, payouts; admin adds shops, people and login links | Chakki can run a day of orders on a phone |
| **3. Admin console v2** | Today dashboard, assign shop, actual costs, shop devices, payouts, customers | Founders run the pilot without spreadsheets |
| **4. App: core** | Expo app: sign in, home, builder, checkout, tracking, orders, saved blends, profile, Hindi | Full order on Android and iPhone test builds |
| **5. App: polish** | Push notifications, UPI app hand-off, offline handling, app icon/splash | Ready for store review |
| **6. Store release** | Play Store internal testing → production; TestFlight → App Store | Live in both stores |

Each phase ships with tests (unit + Playwright for web; Jest + React Native Testing Library for the app).

## 8. Decisions and accounts needed from you

| Item | Needed by | Notes |
|---|---|---|
| **OTP provider** | Phase 4 | Options: Firebase Phone Auth (Google sends SMS), MSG91/2Factor (needs DLT registration), WhatsApp OTP via a WhatsApp Business provider. Pick one. |
| **Google Play developer account** | Phase 6 | One-time fee; verify current price at play.google.com/console |
| **Apple Developer Program** | Phase 6 | Yearly fee; needs a Mac/Apple ID; verify at developer.apple.com |
| **Expo account** | Phase 4 | Free; used for builds (EAS) |
| **Brand name, app icon** | Phase 5 | Stores need a final name, icon, screenshots, privacy policy URL |
| **Real prices, UPI ID, WhatsApp number** | Before launch | Set in /ops/prices |
| **Partner chakki details** | Phase 2 | Name, owner phone, grinding rate |

## 9. Speed rules

- Web surfaces keep the current rule: no client frameworks, inline CSS/JS, small pages.
- App: Expo with Hermes; no heavy UI kits; catalog cached on the phone; works on 4G with retries; screens render from cache first.
