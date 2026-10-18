# Master Plan — Project Atta

> Working name **Project Atta** (brand TBD). Tagline: **Your Grain. Your Mix. Your Atta.**
> Last updated: 18 Oct 2026 · Owners: the two founders
> Status: pre-pilot. Numbers marked **[assumption]** are placeholders until market research replaces them.

Related: [PRD.md](PRD.md) · [docs index](README.md) · [TECH-STACK.md](../TECH-STACK.md)

---

## 1. The business in one paragraph

Households in large gated societies want fresh, chakki-ground atta with their own mix of grains, but getting it means buying grain, carrying it to a chakki, waiting, and carrying flour home. We let them design a blend on their phone (for example 7 kg wheat + 1 kg each of ragi, jowar and bajra), a partner chakki grinds it fresh, and we deliver it to their flat in a fixed morning or evening slot. We start in one society, prove people reorder and that each order makes money, then expand society by society.

## 2. Problem

| Today's options | What's wrong with them |
|---|---|
| Branded packaged atta | Not fresh; fixed blends; can't choose grains or ratios |
| Local chakki, do-it-yourself | Buy grain, carry 10–20 kg, wait or go twice; inconvenient for working families and older residents |
| Quick-commerce multigrain atta | Expensive per kg; blend chosen by the brand; unclear grain ratios |
| Buying millet flours separately and mixing at home | Messy, uneven mixing, several packets to track |

## 3. Who we serve first

**Primary:** families in Purvanchal Royal City, Greater Noida, who already buy 10–20 kg of atta a month and care about what's in it.
- Health-conscious households adding millets to their diet
- Families with older members who prefer chakki atta
- Working couples who don't have time for the chakki trip

**Not first:** single-person households (low volume), restaurants and bulk buyers (different pricing and logistics).

## 4. What we sell

- **Custom blends** in 5, 10, 15, 20 or 25 kg, built in 0.5 kg steps per grain
- **Preset blends:** Pure Wheat, Multigrain, High Fibre, Ragi Mix
- **Grind choice:** fine, medium, coarse
- **Delivery** to the flat in a 7–9 AM or 6–8 PM slot
- **Nutrition shown for every blend** (IFCT 2017 data), as information, never as health claims

**Later:** subscriptions ("every 3 weeks"), more grains (chana for missi roti, oats), besan and other flours, multiple societies.

## 5. How it works (operations)

```text
Customer orders (web page → WhatsApp, later the app)
  → Founder confirms on WhatsApp (blend, slot, payment)
  → Grain procured (by us or the chakki — decision pending)
  → Partner chakki cleans, grinds, packs, labels
  → Founder / runner collects and delivers in slot
  → Payment by UPI or cash; actual costs recorded per order
```

### Key decisions still open
| Decision | Options | Recommendation |
|---|---|---|
| Who buys grain | We buy and store / chakki supplies | Chakki supplies in pilot (no inventory risk); we pay grain + grinding |
| Grain vs flour weight | Customer pays for grain in / flour out | Sell flour out; it's what people weigh at home. Price in 1–3% grinding loss |
| Delivery | Founders / part-time runner / chakki's helper | Founders in weeks 1–4 to learn; then a part-time runner per slot |
| Packaging | Plain sealed bags + sticker / printed bags | Food-grade sealed bags + printed label in pilot |

## 6. Unit economics (per order)

The pilot software exists to measure this. Example below uses **placeholder numbers only**.

**Example: 10 kg Multigrain, all figures [assumption]**

| Line | Revenue | Cost |
|---|---|---|
| Grain (7 kg wheat, 1 kg each ragi/jowar/bajra) | ₹460 | ₹380 |
| Cleaning & grinding | ₹50 | ₹30 |
| Packaging (1 × 10 kg bag + label) | ₹0 | ₹15 |
| Delivery | ₹0 | ₹25 |
| Payment fee (direct UPI / cash) | — | ₹0 |
| **Total** | **₹510** | **₹450** |
| **Contribution** | | **₹60 (≈12%)** |

What moves contribution most: grain margin per kg, order size (fixed delivery cost spread over more kg), and how many orders one delivery round carries.

**Targets to prove in the pilot** (adjust after the first month):
- Contribution ≥ 15% of order value after real costs
- Average order ≥ 10 kg
- ≥ 6 orders per delivery round

## 7. Pricing approach

- Price per grain per kg + cleaning/grinding charge per kg; free delivery in the pilot.
- Always show ₹/kg so people can compare with their local chakki and with packaged brands.
- Prices editable weekly from the admin panel while research continues.
- Check against: local chakki rate for wheat atta, branded multigrain atta per kg, quick-commerce prices. **[to research]**

## 8. Go-to-market

| Stage | Action |
|---|---|
| Before launch | Talk to 20–30 households in the society; ask what they buy, how much, how often, what they pay. Visit 3–5 chakkis. |
| Launch | Share the order page in society WhatsApp groups (with RWA permission); a founder's personal intro message |
| Trust | Show the chakki, the cleaning process and the grain; photos of packed bags on WhatsApp |
| Sampling | 1 kg trial packs of a preset at cost for the first 20 households **[decide]** |
| Word of mouth | "Refer a neighbour" once repeat orders are happening (no coupons system; handle manually) |
| Retention | WhatsApp reminder about 3–4 weeks after delivery: "Reorder your blend?" |

## 9. Compliance (confirm with a CA / food-licensing consultant)

| Item | Notes |
|---|---|
| FSSAI | Basic registration is generally for small food businesses below a turnover threshold (₹12 lakh/year at the time of writing). The partner chakki needs its own FSSAI licence or registration. |
| Labelling | Packaged food labels usually need product name, ingredients, net quantity, packing date, best-before, FSSAI number, and the packer's name and address. Check the FSSAI Labelling & Display Regulations and Legal Metrology (Packaged Commodities) Rules. |
| GST | Pre-packed, labelled atta in packs up to 25 kg has attracted 5% GST since July 2022, while loose, unlabelled atta has been exempt. Registration is mandatory above the turnover threshold. Get this confirmed. It affects pricing. |
| Business entity | Start as a partnership/LLP or sole proprietorship; a bank account and UPI ID in the business name before collecting regular payments. |
| Health claims | Don't make any ("diabetic-friendly", "gluten-free", "cures…"). Show ingredients and IFCT nutrition values only. |
| Society rules | Permission from RWA for WhatsApp promotion and gate entry for deliveries. |

## 10. Pilot plan

| Phase | When | Goal | Exit criteria |
|---|---|---|---|
| 0. Research | Weeks 0–2 | Real prices, chakki partner, 20–30 interviews | Prices set; 1 chakki agreed; 15+ households say they'd order |
| 1. Manual pilot | Weeks 3–6 | Orders via the share page + WhatsApp; costs in a sheet | 30 orders delivered; < 5% wrong blends; costs tracked per order |
| 2. Software pilot | Weeks 6–12 | Customer app + admin panel (C1–C3, A1–A5) | 50–100 households; real contribution per order known |
| 3. Decide | Week 12 | Continue, change, or stop | See §11 |

## 11. Success and stop criteria (at week 12)

**Continue and expand if:**
- ≥ 40% of first-time customers reorder within 45 days
- Contribution after actual costs ≥ 15% of order value
- ≥ 60 orders/month from one society

**Change the model if:** reorders are good but margin is thin (fix price, order size or delivery cost), or margin is good but reorders are weak (fix product/taste/convenience).

**Stop if:** reorders < 20% and contribution negative after two price adjustments.

## 12. Expansion roadmap (after a successful pilot)

1. Second and third society nearby (same chakki, same delivery rounds)
2. Shop app for the chakki; second chakki partner as backup
3. Subscriptions and reminders; online payments (Razorpay)
4. WhatsApp OTP login, WhatsApp Business notifications
5. New areas in Greater Noida / Noida, one cluster at a time

## 13. Team and roles (pilot)

| Area | Founder A | Founder B |
|---|---|---|
| Customers, WhatsApp, marketing | ✓ | |
| Chakki partner, grain, quality | | ✓ |
| Deliveries | shared | shared |
| Software (with Claude Code) | ✓ | |
| Money: prices, costs, metrics | | ✓ |

**[assign real names]**

## 14. Budget for the pilot (rough, [assumption])

| Item | Estimate |
|---|---|
| Packaging and labels (first 200 bags) | ₹5,000–8,000 |
| Weighing scale, sealer | ₹3,000–5,000 |
| Trial packs / sampling | ₹3,000 |
| Domain, hosting | ₹1,000 (hosting free tiers) |
| FSSAI registration, CA consultation | ₹2,000–5,000 |
| Contingency | ₹5,000 |
| **Total** | **≈ ₹20,000–27,000** |

## 15. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong blend ground | Lost trust | Printed ticket per order; chakki checks off each grain; photo before sealing |
| Chakki unreliable | Missed slots | Second chakki identified by week 6 |
| Grain quality varies | Complaints | Fix one grain supplier per grain; taste-test each new lot |
| Thin margins | Business doesn't work | Measure from order 1; raise min order size or add a small delivery fee |
| Flour freshness / storage | Complaints, spoilage | Grind only to order; best-before on label; advise airtight storage |
| Founders' time on delivery | Burnout, can't scale | Batch deliveries by slot; hire a runner once ≥ 6 orders per round |
| Regulatory surprise (GST, labels) | Fines, repricing | CA consultation in phase 0 |

## 16. Next steps

1. Fill in the open decisions in §5 and §9.
2. Run phase 0 research; replace every **[assumption]**.
3. Share the order page and start the manual pilot.
4. Write TRD, UI/UX doc and backend schema (see [docs index](README.md)), then start coding M0.
