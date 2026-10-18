import { Brand, Layout, WhatsAppIcon } from "../layout";
import { STATUSES, STATUS_LABEL, allowedNext, type Status } from "../../domain/order-status";
import { formatDate, formatDateTimeIST, formatINR, formatKg, orderNumber } from "../../lib/format";
import type { schema } from "../../db";
import { BRAND } from "../../config";

type Order = typeof schema.orders.$inferSelect;
type Item = typeof schema.orderItems.$inferSelect;
type Event = typeof schema.orderEvents.$inferSelect;
type Grain = typeof schema.grains.$inferSelect;
type Settings = typeof schema.settings.$inferSelect;

const GRIND: Record<string, string> = { fine: "Fine", medium: "Medium", coarse: "Coarse" };
const rupees = (p: number) => (p / 100).toFixed(2).replace(/\.00$/, "");

function OpsShell(props: { title: string; children: unknown; flash?: string }) {
  return (
    <Layout title={props.title} bodyClass="ops" noindex>
      <div class="wrap">
        <header class="top">
          <Brand href="/ops" />
          <nav class="chips">
            <a class="toplink" href="/ops">Orders</a>
            <a class="toplink" href="/ops/prices">Prices</a>
            <form method="post" action="/ops/logout" style="margin:0"><button class="chip" type="submit">Log out</button></form>
          </nav>
        </header>
        {props.flash ? <p class="flash" role="status">{props.flash}</p> : null}
        {props.children as never}
      </div>
    </Layout>
  );
}

export function LoginPage(props: { error?: string }) {
  return (
    <Layout title="Ops login" noindex>
      <div class="wrap">
        <header class="top"><Brand /></header>
        <h1 style="font-size:26px">Ops login</h1>
        <form method="post" action="/ops/login" class="step">
          <label class="f" for="pw"><span>Password</span><input id="pw" name="password" type="password" autocomplete="current-password" required /></label>
          {props.error ? <p class="err">{props.error}</p> : null}
          <button class="btn" type="submit">Log in</button>
        </form>
      </div>
    </Layout>
  );
}

export function OrdersPage(props: { orders: Order[]; status: string; date: string; stats: { orders: number; kg: number; revenue: number; est: number } }) {
  const { stats } = props;
  return (
    <OpsShell title="Orders">
      <h1 style="font-size:24px">Orders</h1>
      <form method="get" class="filters">
        <label class="f" for="st"><span>Status</span>
          <select id="st" name="status" class="in">
            <option value="">Open (not delivered or cancelled)</option>
            <option value="all" selected={props.status === "all"}>All</option>
            {STATUSES.map((s) => <option value={s} selected={props.status === s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label class="f" for="dt"><span>Delivery date</span><input id="dt" name="date" type="date" value={props.date} /></label>
        <button class="chip" type="submit">Filter</button>
      </form>
      <div class="stats num">
        <div><b>{stats.orders}</b><span>orders</span></div>
        <div><b>{formatKg(stats.kg)}</b><span>atta</span></div>
        <div><b>{formatINR(stats.revenue)}</b><span>revenue</span></div>
        <div><b>{formatINR(stats.revenue - stats.est)}</b><span>est. contribution</span></div>
      </div>
      <div class="tw">
        <table class="num">
          <thead><tr><th>Order</th><th>Delivery</th><th>Customer</th><th>Address</th><th class="r">Kg</th><th class="r">Total</th><th>Pay</th><th>Status</th></tr></thead>
          <tbody>
            {props.orders.length ? props.orders.map((o) => (
              <tr>
                <td><a href={`/ops/o/${o.id}`}><b>{orderNumber(o.seq)}</b></a></td>
                <td>{formatDate(o.deliveryDate)} · {o.slotLabel}</td>
                <td>{o.customerName}</td>
                <td>{o.tower}-{o.flat}</td>
                <td class="r">{o.sizeGrams / 1000}</td>
                <td class="r">{formatINR(o.totalPaise)}</td>
                <td>{o.paymentMethod.toUpperCase()} · {o.paymentStatus}</td>
                <td><span class={`badge ${o.status}`}>{STATUS_LABEL[o.status as Status]}</span></td>
              </tr>
            )) : <tr><td colspan={8} class="muted">No orders match.</td></tr>}
          </tbody>
        </table>
      </div>
    </OpsShell>
  );
}

export function OrderDetailPage(props: { order: Order; items: Item[]; events: Event[]; flash?: string; publicUrl: string }) {
  const { order: o, items } = props;
  const num = orderNumber(o.seq);
  const status = o.status as Status;
  const phoneDigits = o.customerPhone.replace(/\D/g, "");
  const blendLines = items.map((i) => `• ${i.grainName}: ${formatKg(i.grams)}`).join("\n");
  const confirmText = `Hi ${o.customerName}, this is ${BRAND.name}. Confirming order ${num}:\n${blendLines}\nTotal ${formatKg(o.sizeGrams)}, ${GRIND[o.grind]} grind\nDelivery: ${formatDate(o.deliveryDate)}, ${o.slotLabel}\nAmount: ${formatINR(o.totalPaise)} (${o.paymentMethod === "upi" ? "UPI" : "cash on delivery"})\nTrack: ${props.publicUrl}`;
  const ticket = `ORDER ${num}\n${blendLines}\nTOTAL ${formatKg(o.sizeGrams)} · ${GRIND[o.grind]?.toUpperCase()} GRIND\nBags: ${o.bags.map((b) => `${b.qty} × ${formatKg(b.grams)}`).join(" + ")}\nPickup for: ${formatDate(o.deliveryDate)}, ${o.slotLabel}${o.note ? `\nNote: ${o.note}` : ""}`;

  return (
    <OpsShell title={num} flash={props.flash}>
      <p><a href="/ops">← Orders</a></p>
      <h1 style="font-size:24px">{num} <span class={`badge ${o.status}`}>{STATUS_LABEL[status]}</span></h1>

      <section class="card">
        <h2 style="font-size:17px">Change status</h2>
        <div class="acts">
          {allowedNext(status).map((to, i) => (
            <form method="post" action={`/ops/o/${o.id}/status`}>
              <input type="hidden" name="to" value={to} />
              <button type="submit" class={to === "CANCELLED" ? "danger" : i === 0 ? "primary" : ""}>
                {to === "CANCELLED" ? "Cancel order" : i === 0 ? `→ ${STATUS_LABEL[to]}` : `← Back to ${STATUS_LABEL[to]}`}
              </button>
            </form>
          ))}
          {o.paymentStatus !== "paid" && status !== "CANCELLED" ? (
            <form method="post" action={`/ops/o/${o.id}/paid`}><button type="submit">Mark paid</button></form>
          ) : null}
        </div>
      </section>

      <section class="card">
        <div class="acts">
          <a class="btn wa" style="width:auto" href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(confirmText)}`} target="_blank" rel="noopener"><WhatsAppIcon /> Confirm with customer</a>
          <a class="btn ghost" style="width:auto" href={`https://wa.me/?text=${encodeURIComponent(ticket)}`} target="_blank" rel="noopener">Send ticket to chakki</a>
        </div>
      </section>

      <section class="card">
        <h2 style="font-size:17px">Blend · {formatKg(o.sizeGrams)} · {GRIND[o.grind]} grind</h2>
        <div class="tw">
          <table class="num">
            <thead><tr><th>Grain</th><th class="r">Kg</th><th class="r">Sell/kg</th><th class="r">Cost/kg (est.)</th><th class="r">Line</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr><td>{i.grainName}</td><td class="r">{i.grams / 1000}</td><td class="r">{formatINR(i.sellPaisePerKg)}</td><td class="r">{formatINR(i.costPaisePerKg)}</td><td class="r">{formatINR(i.lineTotalPaise)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl class="kv num">
          <dt>Grinding</dt><dd>{formatINR(o.grindChargePaise)}</dd>
          <dt>Delivery</dt><dd>{formatINR(o.deliveryChargePaise)}</dd>
          <dt>Total</dt><dd>{formatINR(o.totalPaise)}</dd>
          <dt>Est. cost</dt><dd>{formatINR(o.estCostPaise)}</dd>
          <dt>Est. contribution</dt><dd>{formatINR(o.totalPaise - o.estCostPaise)}</dd>
          <dt>Bags</dt><dd>{o.bags.map((b) => `${b.qty} × ${formatKg(b.grams)}`).join(" + ")}</dd>
        </dl>
      </section>

      <section class="card">
        <dl class="kv">
          <dt>Customer</dt><dd>{o.customerName}</dd>
          <dt>Mobile</dt><dd>{o.customerPhone}</dd>
          <dt>Address</dt><dd>Tower {o.tower}, Flat {o.flat}, {o.societyName}</dd>
          <dt>Delivery</dt><dd>{formatDate(o.deliveryDate)}, {o.slotLabel}</dd>
          <dt>Payment</dt><dd>{o.paymentMethod.toUpperCase()} · {o.paymentStatus}</dd>
          <dt>Note</dt><dd>{o.note || "—"}</dd>
          <dt>Placed</dt><dd>{formatDateTimeIST(o.createdAt)}</dd>
          <dt>Customer link</dt><dd><a href={props.publicUrl}>Open</a></dd>
        </dl>
        <form method="post" action={`/ops/o/${o.id}/note`} class="step">
          <label class="f" for="inote"><span>Internal note</span><input id="inote" name="note" value={o.internalNote} maxlength={500} /></label>
          <button class="chip" type="submit" style="align-self:flex-start">Save note</button>
        </form>
      </section>

      <section class="card">
        <h2 style="font-size:17px">History</h2>
        <ul class="list" style="gap:4px">
          {props.events.map((e) => (
            <li class="muted" style="font-size:14px">{formatDateTimeIST(e.createdAt)} · {e.fromStatus ? `${STATUS_LABEL[e.fromStatus as Status]} → ` : ""}{STATUS_LABEL[e.toStatus as Status] ?? e.toStatus} · {e.actor}{e.note ? ` · ${e.note}` : ""}</li>
          ))}
        </ul>
      </section>
    </OpsShell>
  );
}

export function PricesPage(props: { grains: Grain[]; settings: Settings; flash?: string; error?: string }) {
  const s = props.settings;
  const money = (name: string, label: string, paise: number) => (
    <label class="f" for={name}><span>{label} (₹)</span><input id={name} name={name} inputmode="decimal" value={rupees(paise)} required /></label>
  );
  return (
    <OpsShell title="Prices" flash={props.flash}>
      <h1 style="font-size:24px">Prices and settings</h1>
      <p class="muted">Changes apply to new orders only. Existing orders keep the price they were placed at.</p>
      {props.error ? <p class="err">{props.error}</p> : null}
      <form method="post" action="/ops/prices" class="step">
        <div class="tw">
          <table class="num">
            <thead><tr><th>Grain</th><th class="r">Sell ₹/kg</th><th class="r">Cost ₹/kg (est.)</th><th>On sale</th></tr></thead>
            <tbody>
              {props.grains.map((g) => (
                <tr>
                  <td>{g.name}</td>
                  <td class="r"><input class="sm" name={`sell_${g.id}`} inputmode="decimal" value={rupees(g.sellPaisePerKg)} aria-label={`${g.name} sell price`} /></td>
                  <td class="r"><input class="sm" name={`cost_${g.id}`} inputmode="decimal" value={rupees(g.costPaisePerKg)} aria-label={`${g.name} cost`} /></td>
                  <td><input type="checkbox" name={`active_${g.id}`} checked={g.active} aria-label={`${g.name} on sale`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class="fields">
          {money("grindCharge", "Grinding charge per kg", s.grindChargePaisePerKg)}
          {money("grindCost", "Grinding cost per kg (est.)", s.grindCostPaisePerKg)}
          {money("deliveryCharge", "Delivery charge per order", s.deliveryChargePaise)}
          {money("deliveryCost", "Delivery cost per order (est.)", s.deliveryCostPaise)}
          {money("bagCost", "Bag + label cost (est.)", s.bagCostPaise)}
          <label class="f" for="cutoff"><span>Order cutoff (hours before slot)</span><input id="cutoff" name="cutoff" inputmode="numeric" value={String(s.cutoffHours)} required /></label>
          <label class="f full" for="upi"><span>UPI ID shown to customers</span><input id="upi" name="upi" value={s.upiId} placeholder="e.g. name@okaxis" /></label>
          <label class="f full" for="wa"><span>Your WhatsApp number (with 91)</span><input id="wa" name="wa" inputmode="numeric" value={s.whatsappNumber} placeholder="e.g. 919876543210" /></label>
        </div>
        <button class="btn" type="submit">Save</button>
      </form>
    </OpsShell>
  );
}
