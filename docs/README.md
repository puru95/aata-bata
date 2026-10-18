# Project Atta — Documents

| Document | Status | Purpose |
|---|---|---|
| [MASTER-PLAN.md](MASTER-PLAN.md) | ✅ Draft | The whole business: customers, operations, unit economics, go-to-market, compliance, pilot phases, risks |
| [PRD.md](PRD.md) | ✅ Draft | What we build and why: goals, personas, journeys, requirements with priorities, business rules |
| [../PLAN-customer-app.md](../PLAN-customer-app.md) | ✅ Draft | Customer app screens and milestones |
| [../PLAN-admin-panel.md](../PLAN-admin-panel.md) | ✅ Draft | Admin panel screens and milestones |
| [../PLAN-shop-app.md](../PLAN-shop-app.md) | ✅ Draft | Chakki app (phase 2) |
| [../TECH-STACK.md](../TECH-STACK.md) | ✅ Draft | Stack, folder layout, roles, environments |
| TRD.md | ⏳ Before M0 | Technical design |
| UI-UX.md | ⏳ Before M3 | Design system and screen specs |
| SCHEMA.md | ⏳ Before M1 | Database schema |

## To write before coding

### TRD.md — Technical Requirements Document (write before M0)
- Architecture diagram (Next.js on Vercel ↔ Supabase Postgres, auth, storage)
- Auth design for the three roles: admin magic link, shop link + PIN, customer device session
- Server Actions list with inputs, outputs and Zod schemas
- Pricing, preset scaling, bag split and status-transition algorithms with test cases
- Error handling, logging (Sentry), backups, environments, CI checks
- Security: RLS, rate limits on order creation, token generation
- Performance budgets and how they're measured

**Needs first:** PRD open questions 1–3 answered.

### SCHEMA.md — Backend schema (write before M1)
- Every table, column, type, constraint and index (Drizzle definitions)
- ER diagram
- Enums: order status (with shop sub-states), payment, grind
- Check constraints (grams in steps, size in 5 kg steps, bag total = order total)
- Seed data; migration plan; RLS policies
- Starts from §4 of the original spec plus changes in the PRD (session-scoped blends/orders, `delivery_slot_id`, partner users, payouts)

**Needs first:** grain-vs-flour and who-buys-grain decisions (they change cost columns).

### UI-UX.md — Design document (write before M3)
- Design tokens taken from the share page (colours, type, spacing) so the app matches
- Components: size picker, grain stepper, fill bar, nutrition card, slot picker, status timeline, ticket
- Screen-by-screen specs with states (empty, loading, error, full)
- Hindi typography and copy rules; no health claims
- Accessibility checklist; test on a real low-end Android
- Usability test plan with 5 households using the share page

**Needs first:** feedback from the first 20–30 orders on the share page.

Ask Claude to write each one when its "needs first" item is done.
