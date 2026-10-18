# Plan — Admin Panel (Ops)

The panel the two founders use to run the pilot: confirm orders, send them to the chakki, track delivery, edit prices weekly, and measure margin per order.

Stack and shared rules: [TECH-STACK.md](TECH-STACK.md).

---

## 1. Goals

1. Run every order from placed to delivered without spreadsheets.
2. Change prices, grains, slots and fees in minutes, with no code change.
3. Know the real contribution margin per order and per kg.

## 2. Access

- `/ops/*`, Supabase Auth email magic link.
- Only users in the `admins` table get in. Everyone else sees "No access".
- Every change to prices, settings or order status is logged with who did it.

## 3. Screens

| Route | Purpose | Key elements |
|---|---|---|
| `/ops` | Today | Counts by status, today's slots with orders per slot, orders needing action (new, unpaid UPI, shop problem) |
| `/ops/orders` | Orders list | Filters: status, delivery date, society, partner, payment. Columns: number, customer, society, kg, total, payment, status, slot |
| `/ops/orders/[id]` | Order detail | Everything about the order; buttons for valid next statuses only; assign partner; mark paid; internal notes; WhatsApp buttons (customer confirmation, partner ticket); "Record actuals" |
| `/ops/orders/[id]/ticket` | Production ticket | Print-friendly (A5 / thermal width) + plain text for WhatsApp; optional bag label |
| `/ops/orders/new` | Order on behalf | For customers who send their order as a WhatsApp message |
| `/ops/catalog` | Grains & presets | Grains (name, Hindi name, active, order), price history with effective dates, pack sizes, preset blends |
| `/ops/settings` | Settings | Pricing settings, order cutoff, societies, delivery slots + capacity, partners + grinding rates, UPI ID / QR, admins |
| `/ops/customers` | Customers | Search by name/phone, order history, merge duplicate customers / link a new device |
| `/ops/partners` | Shops | Partner details, shop devices (create login link, revoke, reset PIN), payouts owed / paid |
| `/ops/metrics` | Metrics | See §5 |

## 4. Order flow (admin's part)

```text
PLACED → CONFIRMED → SENT_TO_PARTNER → (shop: ACCEPTED → GRINDING) → READY → OUT_FOR_DELIVERY → DELIVERED
any non-terminal state → CANCELLED
```

- `CONFIRMED`: confirmed with the customer on WhatsApp (and payment received, if UPI prepaid).
- `SENT_TO_PARTNER` requires a partner.
- Admin can **revert one step** with a required reason (fixes mis-taps); it's logged as an event.
- Delivering a cash order asks "Cash collected?" and sets payment to paid.
- Cancelling a paid order asks whether to mark it refunded.
- Discounts: manual only, admin enters amount + reason on the order. No coupons.

## 5. Costs and metrics

**Estimated cost** (at order time, from settings): grain cost + grinding cost + packaging cost + delivery cost + payment fee.
- Payment fee depends on method: **0 for direct UPI and cash**; the fee setting applies only once a gateway (Razorpay) is added.
- Grinding cost estimate uses the pricing setting until a partner is assigned, then the partner's rate. Pick one and keep it.

**Actual cost** (after delivery, "Record actuals" form): grain, grinding, packaging, delivery, payment fee, other; output weight; prep and delivery minutes. Shop app fills output weight and prep time automatically once it exists.

**Metrics page** for a date range:
- Orders, kg, revenue
- Estimated vs actual contribution: total, per order, per kg (only orders with actuals count toward "actual"; show how many are missing)
- Average order size (kg), cancellation rate
- Customers, repeat customers (2+ delivered), reorder within 45 days
- Top blends, orders per society, orders per slot
- Grinding loss % (output vs input weight)
- CSV export of orders and actuals

## 6. Settings that change weekly

All editable here, never hard-coded:
grain sell price and estimated cost (with effective date and history) · grinding charge and cost per kg · pack sizes and packaging cost/charge · delivery charge and cost · min/max order, grain step · order cutoff hours · slot times and capacity · societies · partners and rates · UPI ID / QR · preset blends.

## 7. Milestones

| # | Milestone | Done when |
|---|---|---|
| A1 | Admin login | Magic link works; non-admins blocked |
| A2 | Orders list + detail + status | All transitions through `transitionOrder()`, WhatsApp links prefilled |
| A3 | Production ticket | Readable printout and WhatsApp text |
| A4 | Catalog & settings editors | Price change affects new orders only; history kept |
| A5 | Actuals + metrics | Contribution per order and per kg for any date range |
| A6 | Customers + order on behalf | Merge customers, create orders from WhatsApp messages |
| A7 | Partners + shop devices + payouts | Needed when the shop app ships |

## 8. Build order across all three apps

1. Scaffold, schema, seed, domain logic + tests (shared)
2. Customer C1–C3
3. Admin A1–A3 → **pilot can start here** (orders flow via WhatsApp tickets)
4. Admin A4–A5, Customer C4
5. Customer C5–C6, Admin A6
6. Shop S1–S5 + Admin A7
7. Customer C7 (Hindi), Shop S6 (offline)

## 9. Open decisions

- Brand name and domain
- Bag sizes vs 0.5 kg steps (see customer plan §4)
- Grain weight vs flour weight
- Who supplies grain: us or the chakki
- Real prices from market research
- UPI ID / QR; when to register the business and add Razorpay
- Which chakki(s) for the pilot
