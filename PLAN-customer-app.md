# Plan — Customer App

The app households use to design a flour blend, order it, track it and reorder it. Shared as a link in society WhatsApp groups. Mobile-first PWA.

Stack and shared rules: [TECH-STACK.md](TECH-STACK.md). Shareable preview page: https://claude.ai/artifact/AjaELVtkXg4QfhoEVvrFmq

---

## 1. Goals

1. Order a custom blend in under 2 minutes on a cheap Android phone.
2. Reorder a saved blend in one tap.
3. Never show one household's data to another.

## 2. Users

Households in Purvanchal Royal City (pilot), 50–100 homes. Mostly on WhatsApp, often on patchy 4G. Many prefer Hindi labels next to English.

## 3. Screens

| Route | Purpose | Key elements |
|---|---|---|
| `/` | Landing | Tagline, preset blends, "Build your own", "Reorder" (if this device has saved blends), how it works, delivery areas |
| `/build` | Blend builder | Grain list with +/− in 0.5 kg steps, Hindi names, running total with 5–25 kg limit, composition bar, grind (fine / medium / coarse), bag split, sticky bar with ₹ total and ₹/kg |
| `/checkout` | Place order | Name, phone, society, tower, flat, landmark, delivery slot (next 7 days, only slots with capacity and past the cutoff), UPI or cash, notes, "Save this blend as…" |
| `/orders/[token]` | Order status | Status timeline, blend, bags, slot, total, UPI ID / QR if unpaid, "Reorder this blend", rate the order after delivery |
| `/blends` | Saved blends on this device | Reorder, rename, edit, delete |

## 4. Rules

- **Pricing** comes from `domain/pricing.ts` and is recomputed on the server at checkout. The builder shows a live estimate.
- **Bags must add up to the total.** Decide one before M2:
  - (a) totals only in multiples of 5 kg, or
  - (b) add 1 kg / 2.5 kg bags, or
  - (c) allow one smaller remainder bag (the preview page uses this).
- **Grain vs flour weight.** Decide whether "10 kg" means grain in or flour out, and say it on the builder.
- **Preset scaling** gives every grain at least one step (500 g), then corrects the largest grain so the total is exact.
- **Order cutoff:** a slot can't be booked less than N hours before it starts (setting, default 12 h).

## 5. Identity and privacy (no OTP in pilot)

- At checkout we find or create a customer by phone, but **we do not overwrite** an existing customer's name or addresses from a new device.
- The device gets a random session cookie (httpOnly, secure, SameSite=Lax); we store only its hash.
- **A device sees only the orders and blends created from that device session.** Typing someone's phone number never reveals their history.
- `/orders/[token]` uses an unguessable token. It masks the phone number and flat (links get forwarded on WhatsApp).
- Ops can merge history across devices by hand.

## 6. Data it uses

`grains`, `grain_prices`, `pack_sizes`, `pricing_settings`, `blends` (+ `session_id`), `blend_items`, `customers`, `addresses`, `societies`, `delivery_slots`, `customer_sessions`, `orders` (+ `delivery_slot_id`, `session_id`), `order_items`, `order_packs`, `order_status_events`, `order_feedback`.

## 7. Milestones

| # | Milestone | Done when |
|---|---|---|
| C1 | Landing + builder | Presets and custom blends price correctly; limits and bag split work; tested at 375 px |
| C2 | Checkout + order creation | Server recomputes price, snapshots lines, creates order number and device session, redirects to status page |
| C3 | Order status page | Timeline, UPI instructions, masked details |
| C4 | Saved blends + reorder | Save at checkout, rename / edit / delete, one-tap reorder prefilled with last address and slot |
| C5 | Feedback | 1–5 rating + comment after delivery |
| C6 | PWA | Manifest, icons, offline page, "Add to home screen" prompt |
| C7 | Hindi toggle | Labels and buttons in Hindi; grain names already have `name_hi` |

## 8. Copy rules

- Describe ingredients, never health benefits. No "gluten-free", "diabetic-friendly", "cures…".
- Prices on the page say "estimate" until the order is confirmed.

## 9. Later (not in pilot)

WhatsApp OTP login, online payment (Razorpay), subscriptions ("every 3 weeks"), coupons, referral links, more cities.

## 10. Success measures

- Builder → order conversion
- Median time to place an order
- Repeat rate: customers with 2+ delivered orders
- Reorder within 45 days
