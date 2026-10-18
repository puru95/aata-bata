# PRD — Project Atta (Pilot v1)

> Product Requirements Document · Last updated: 18 Oct 2026 · Status: draft
> Covers the customer app, admin panel and (phase 2) shop app.

Related: [MASTER-PLAN.md](MASTER-PLAN.md) · [PLAN-customer-app.md](../PLAN-customer-app.md) · [PLAN-admin-panel.md](../PLAN-admin-panel.md) · [PLAN-shop-app.md](../PLAN-shop-app.md)

---

## 1. Summary

A mobile web app where households build a custom flour blend, see its price and nutrition, and order it for delivery in a slot. Founders run every order from an admin panel and record real costs per order. Later, the partner chakki gets its own app to receive and complete orders.

## 2. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Ordering a blend is quick on a cheap phone | Median time from opening the link to placing an order < 2 min |
| G2 | People come back | ≥ 40% reorder within 45 days |
| G3 | Every order's real margin is known | 100% of delivered orders have actual costs recorded |
| G4 | No wrong blends | < 2% of orders with a blend complaint |
| G5 | Founders can change prices without a developer | Price change live in < 5 min from admin panel |

## 3. Non-goals (pilot)

Online payments, OTP login, subscriptions, coupons, reviews, live tracking, native apps, rider app, automatic partner assignment, multiple cities.

## 4. Personas

| Persona | Description | Needs |
|---|---|---|
| **Neha, homemaker, 38** | Buys 20 kg atta a month for a family of five; adds ragi for her children | Choose her exact mix; trust the chakki; pay cash or UPI |
| **Rahul, IT professional, 32** | Orders everything online; wants multigrain but no time for chakki | Fast reorder; slot that fits work hours |
| **Kamla ji, 65** | Has used chakki atta all her life; family orders for her | Large text, Hindi names, simple choices |
| **Founder (ops)** | Runs orders, deliveries and money | See today's orders, confirm, send to chakki, track costs |
| **Chakki owner** | Grinds 5–30 orders a day | Clear grain-by-grain ticket; know pickup time; get paid weekly |

Personas are illustrative, not real customers.

## 5. User journeys

**J1 — First order (customer)**
Open link from WhatsApp → pick size (10 kg) → pick preset or build own → see nutrition and price → choose grind and slot → enter name, tower, flat, payment → place order → see status page / WhatsApp confirmation.

**J2 — Reorder (customer)**
Open link → "Reorder Multigrain 10 kg" → check slot → place order. Under 30 seconds.

**J3 — Run an order (founder)**
New order appears → confirm with customer on WhatsApp → assign chakki → send ticket → mark ready → out for delivery → delivered (cash collected) → record actual costs.

**J4 — Change prices (founder)**
Settings → grain prices → new price with effective date → new orders use it; old orders keep their price.

**J5 — Grind an order (chakki, phase 2)**
Open shop app → today's orders → accept → grind → enter output weight → mark ready.

## 6. Functional requirements

Priority: **P0** = pilot launch, **P1** = during pilot, **P2** = after pilot.

### 6.1 Customer app

| ID | Requirement | Priority |
|---|---|---|
| C-01 | Choose order size: 5, 10, 15, 20, 25 kg | P0 |
| C-02 | Start from Custom (default), Pure Wheat, Multigrain, High Fibre, Ragi Mix | P0 |
| C-03 | Add/remove each grain in 0.5 kg steps; cannot exceed chosen size | P0 |
| C-04 | Show fill progress ("2.5 kg left"), composition bar, share % per grain | P0 |
| C-05 | "Fill the rest with wheat" and "Clear" shortcuts | P0 |
| C-06 | Changing size keeps the blend's proportions | P0 |
| C-07 | Live price: grains, grinding, delivery, total, ₹/kg | P0 |
| C-08 | Live nutrition per 100 g and per roti: kcal, carbs, protein, fibre, fat, calcium, iron; compared with plain wheat; source IFCT 2017 | P0 |
| C-09 | Choose grind (fine / medium / coarse) | P0 |
| C-10 | Choose delivery date + slot (next 7 days, active slots with capacity, after cutoff) | P0 |
| C-11 | Enter name, phone, society, tower, flat, landmark; choose UPI or cash | P0 |
| C-12 | Place order; server recomputes price; order number and status link created | P0 |
| C-13 | Order status page with timeline, UPI ID/QR if unpaid, masked personal details | P0 |
| C-14 | Saved blends on this device; one-tap reorder with last address | P1 |
| C-15 | Rate an order (1–5) and comment after delivery | P1 |
| C-16 | Installable PWA with offline page | P1 |
| C-17 | Hindi interface toggle | P1 |
| C-18 | OTP login and order history across devices | P2 |
| C-19 | Subscriptions / reminders | P2 |

### 6.2 Admin panel

| ID | Requirement | Priority |
|---|---|---|
| A-01 | Magic-link login for allowlisted admins only | P0 |
| A-02 | Today view: orders by status, slots, items needing action | P0 |
| A-03 | Orders list with filters (status, date, society, payment) | P0 |
| A-04 | Order detail with only valid next-status buttons; revert one step with reason | P0 |
| A-05 | Assign chakki; mark paid; cash-collected prompt on delivery | P0 |
| A-06 | WhatsApp buttons with prefilled customer confirmation and chakki ticket | P0 |
| A-07 | Printable production ticket and bag label | P0 |
| A-08 | Edit grains, prices (with history and effective date), pack sizes, presets | P0 |
| A-09 | Edit pricing settings, societies, slots and capacity, cutoff, UPI details | P0 |
| A-10 | Record actual costs, output weight and times per order | P0 |
| A-11 | Metrics: orders, kg, revenue, est. vs actual contribution, repeat rate, reorder in 45 days, top blends, grinding loss | P1 |
| A-12 | Create order on behalf of a customer | P1 |
| A-13 | Customers list; merge duplicates | P1 |
| A-14 | CSV export | P1 |
| A-15 | Partner devices and payouts | P2 (with shop app) |

### 6.3 Shop app (phase 2)

| ID | Requirement | Priority |
|---|---|---|
| S-01 | Login by personal link + 4-digit PIN | P2 |
| S-02 | Today's assigned orders grouped New / Grinding / Ready | P2 |
| S-03 | Large grain-by-grain order card, Hindi + English | P2 |
| S-04 | Accept → Start grinding → Mark ready, with output weight | P2 |
| S-05 | Flag a problem to admin | P2 |
| S-06 | History and amount owed | P2 |
| S-07 | No customer phone, address or selling price visible | P2 |

## 7. Business rules

| ID | Rule |
|---|---|
| R-01 | Order size is a multiple of 5 kg, from 5 to 25 kg. Each grain is a multiple of 0.5 kg. |
| R-02 | Bags: as many 10 kg bags as fit, then one 5 kg bag. |
| R-03 | Price = Σ grain price × kg + grinding charge × kg + packaging charge + delivery charge − manual discount. |
| R-04 | Price is recomputed on the server; order lines store the price and estimated cost at that moment. |
| R-05 | Presets store ratios; scaling gives each grain at least 0.5 kg and the largest grain absorbs rounding. |
| R-06 | Status: PLACED → CONFIRMED → SENT_TO_PARTNER → (ACCEPTED → GRINDING) → READY → OUT_FOR_DELIVERY → DELIVERED; CANCELLED from any non-final state. |
| R-07 | Slots can't be booked less than the cutoff (default 12 h) before start, or beyond capacity. |
| R-08 | A device sees only orders and blends made on that device. A phone number alone never reveals history. |
| R-09 | Payment fee is 0 for direct UPI and cash. |
| R-10 | Nutrition is the weight-averaged IFCT 2017 values; no health claims anywhere. |
| R-11 | Weight sold is **[decide: grain in / flour out]**. |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Builder interactive in < 3 s on a mid-range Android on 4G; JS for customer pages < 150 KB gzipped |
| Mobile | Designed at 375 px; no horizontal scroll; tap targets ≥ 44 px |
| Accessibility | WCAG 2.1 AA contrast; works with large system font; labels on all inputs |
| Language | English with Hindi grain names (P0); full Hindi (P1) |
| Privacy | Personal data only on server; masked on public pages; no third-party trackers with personal data |
| Reliability | 99% uptime during slot hours; daily DB backups once on paid plan |
| Security | Admin routes behind auth + allowlist; RLS on all tables; secrets only on server |
| Data | Money in paise, weight in grams; timestamps UTC, displayed IST |

## 9. Analytics events

`page_view`, `size_selected`, `preset_selected`, `grain_changed`, `bag_full`, `nutrition_toggle`, `checkout_started`, `order_placed`, `reorder_clicked`, `whatsapp_clicked`. No personal data in events.

## 10. Release plan

| Release | Contents | Gate |
|---|---|---|
| R0 (live now) | Share page: builder, nutrition, WhatsApp order message | Founders' WhatsApp number added |
| R1 | C-01…C-13, A-01…A-10 | 10 test orders end to end with no manual fixes |
| R2 | C-14…C-17, A-11…A-14 | 30 real orders in R1 |
| R3 | Shop app S-01…S-07, A-15 | Chakki has used WhatsApp tickets for 4+ weeks |

## 11. Open questions

1. Grain weight or flour weight (R-11)?
2. Who buys the grain: us or the chakki?
3. Delivery free or charged; minimum order 5 kg or 10 kg?
4. Brand name and domain.
5. Is a 1 kg trial pack offered (breaks R-01)?
6. GST treatment of labelled packs — confirm with a CA.
