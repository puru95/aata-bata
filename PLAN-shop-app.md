# Plan — Shop App (Partner Chakki)

The app the partner atta chakki uses to see the orders assigned to them, grind them correctly, and mark them ready for pickup.

Stack and shared rules: [TECH-STACK.md](TECH-STACK.md).

---

## 0. Phasing

The original pilot spec keeps the shop app **out of scope**: ops sends a printable / WhatsApp production ticket instead. Recommended order:

| Phase | How the shop gets orders |
|---|---|
| Pilot weeks 1–4 | WhatsApp ticket from the admin panel (already planned). Learn what the chakki actually needs. |
| Pilot weeks 5+ | This shop app, once the ticket flow is stable and there is more than one order a day. |

Build the shop app only after watching the chakki work with the WhatsApp tickets for a few weeks.

## 1. Goals

1. The chakki never grinds the wrong blend.
2. Ops knows each order's state without phoning the shop.
3. We capture real output weight and prep time for cost tracking.

## 2. Users

Chakki owner and 1–2 staff. Busy, flour on their hands, a shared Android phone, may prefer Hindi. Design for big buttons, few words, and no typing where possible.

## 3. Login

- Admin creates a partner and sends a **personal login link** on WhatsApp.
- First open asks the shop to set a **4-digit PIN**. After that the device stays logged in (long-lived session cookie) and asks for the PIN only to unlock after idle.
- Admin can revoke a device or reset the PIN.
- No email or SMS OTP needed.

## 4. Screens

| Route | Purpose | Key elements |
|---|---|---|
| `/shop` | Today | Orders grouped by pickup time: **New**, **Grinding**, **Ready**. Each card: order number, total kg, grind, bags, pickup time. |
| `/shop/orders/[id]` | Order card | Large, clear list: each grain + kg, grind, bag split, notes for the shop. Buttons: **Accept**, **Start grinding**, **Mark ready** |
| Mark ready form | Record output | Output weight in grams (number pad), optional photo of the sealed bags, problem flag (grain short, machine down) |
| `/shop/history` | Past orders | Last 30 days: orders, kg ground, amount owed to the shop |
| `/shop/login` | Login + PIN | |

Hindi and English labels side by side. Big text. No customer phone numbers, addresses or selling prices on any screen.

## 5. Status flow (shop's part)

```text
SENT_TO_PARTNER → ACCEPTED → GRINDING → READY
                       ↘ PROBLEM (needs admin)
```

- `ACCEPTED` and `GRINDING` are new sub-states between `SENT_TO_PARTNER` and `READY`. Add them to `domain/order-status.ts`; the shop can only move its own assigned orders forward.
- `PROBLEM` notifies admin (WhatsApp link to ops plus a badge on the admin orders list).
- All changes go through `transitionOrder()` with actor = `partner:<id>`.

## 6. Data it uses

Reads: `orders` (assigned to this partner only), `order_items`, `order_packs`.
Writes: `order_status_events`, `order_actuals.output_grams`, `prep_minutes` (start → ready time), shop notes, photos in Supabase Storage.
New tables: `partner_users` (partner_id, name, pin_hash), `partner_sessions` (token_hash, device label, last_seen_at).

## 7. Payouts to the shop

- Amount owed = Σ (grams ground × partner's `grinding_rate_paise_per_kg`) for orders marked READY in the period.
- History screen shows the running total; admin marks a payout as paid (weekly).
- Grain supply: decide whether the chakki supplies grain (we pay grain + grinding) or we buy grain and the chakki only grinds. The payout formula depends on this.

## 8. Milestones

| # | Milestone | Done when |
|---|---|---|
| S1 | Partner login link + PIN | Admin can create and revoke a shop device |
| S2 | Today list + order card | Shows only that partner's orders, readable at arm's length |
| S3 | Status buttons | Accept / Start / Ready update the admin panel live |
| S4 | Output weight + problem flag | Feeds `order_actuals` and admin metrics |
| S5 | History + payouts | Weekly amount owed matches admin's numbers |
| S6 | Offline tolerance | Button taps queue and retry when the network returns |

## 9. Food safety and labels (check with an expert)

- Show the partner's FSSAI number on bag labels.
- Consider a **bag label** printout per order: product name, ingredients (the blend), net weight, packing date, best-before date, FSSAI number, order number. Confirm exact requirements under FSSAI labelling and Legal Metrology rules before launch.

## 10. Later

Multiple chakkis with automatic assignment, stock tracking for grain, push notifications for new orders.
