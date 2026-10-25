import { Brand, Check, Layout, WhatsAppIcon } from "./layout";
import { STATUS_LABEL, TIMELINE, timelineIndex, type Status } from "../domain/order-status";
import { formatDate, formatINR, formatKg, maskPhone, orderNumber } from "../lib/format";
import type { schema } from "../db";

type Order = typeof schema.orders.$inferSelect;
type Item = typeof schema.orderItems.$inferSelect;

const GRIND: Record<string, string> = { fine: "Fine", medium: "Medium", coarse: "Coarse" };

export function OrderPage(props: { order: Order; items: Item[]; upiId: string; whatsappNumber: string; justPlaced: boolean; url: string }) {
  const { order: o, items } = props;
  const status = o.status as Status;
  const idx = timelineIndex(status);
  const num = orderNumber(o.seq);
  const blend = items.map((i) => `${i.grainName} ${formatKg(i.grams)}`).join(", ");
  const waText = `Hi! I placed order ${num}: ${formatKg(o.sizeGrams)} (${blend}), ${GRIND[o.grind]} grind, ${formatDate(o.deliveryDate)} ${o.slotLabel}. Tower ${o.tower}, Flat ${o.flat}. ${props.url}`;
  const waHref = props.whatsappNumber ? `https://wa.me/${props.whatsappNumber}?text=${encodeURIComponent(waText)}` : "";
  const unpaidUpi = o.paymentMethod === "upi" && o.paymentStatus === "pending" && status !== "CANCELLED";

  return (
    <Layout title={`Order ${num}`} noindex>
      <div class="wrap">
        <header class="top">
          <Brand />
          <a class="toplink" href="/my">My orders</a>
        </header>

        {props.justPlaced ? (
          <section class="card">
            <p class="ok"><Check size={26} /> Order placed</p>
            <p>
              Your order number is <b>{num}</b>. We'll confirm it on WhatsApp before grinding.
            </p>
            {waHref ? (
              <a class="btn wa" href={waHref} target="_blank" rel="noopener">
                <WhatsAppIcon /> Send us your order on WhatsApp
              </a>
            ) : null}
            <p class="note">Save this page to check your order status anytime.</p>
          </section>
        ) : (
          <section class="hero">
            <h1 style="font-size:28px">Order {num}</h1>
            <p class="muted">Placed for {formatDate(o.deliveryDate)}, {o.slotLabel}</p>
          </section>
        )}

        <section class="card">
          <h2 style="font-size:17px">Status</h2>
          {status === "CANCELLED" ? (
            <p><span class="badge CANCELLED">Cancelled</span></p>
          ) : (
            <ol class="tl">
              {TIMELINE.map((step, i) => (
                <li class={i < idx || (i === idx && status === "DELIVERED") ? "done" : i === idx ? "cur" : ""}>{step.label}</li>
              ))}
            </ol>
          )}
        </section>

        <section class="card">
          <h2 style="font-size:17px">Your blend · {formatKg(o.sizeGrams)}</h2>
          <div class="items num">
            {items.map((i) => (
              <div><span>{i.grainName} · {formatKg(i.grams)}</span><span>{formatINR(i.lineTotalPaise)}</span></div>
            ))}
            <div><span>Grinding</span><span>{formatINR(o.grindChargePaise)}</span></div>
            <div><span>Delivery</span><span>{o.deliveryChargePaise ? formatINR(o.deliveryChargePaise) : "Free"}</span></div>
          </div>
          <div class="sum num"><div class="t"><span>Total</span><span>{formatINR(o.totalPaise)}</span></div></div>
          <dl class="kv">
            <dt>Grind</dt><dd>{GRIND[o.grind]}</dd>
            <dt>Bags</dt><dd>{o.bags.map((b) => `${b.qty} × ${formatKg(b.grams)}`).join(" + ")}</dd>
            <dt>Delivery</dt><dd>{formatDate(o.deliveryDate)}, {o.slotLabel}</dd>
            <dt>Address</dt><dd>Tower {o.tower}, Flat {o.flat}, {o.societyName}</dd>
            <dt>Name</dt><dd>{o.customerName}</dd>
            <dt>Mobile</dt><dd>{maskPhone(o.customerPhone)}</dd>
            <dt>Payment</dt><dd>{o.paymentMethod === "upi" ? "UPI" : "Cash on delivery"} · {o.paymentStatus === "paid" ? "Paid" : o.paymentStatus === "refunded" ? "Refunded" : "Not paid yet"}</dd>
          </dl>
        </section>

        {unpaidUpi ? (
          <section class="card">
            <h2 style="font-size:17px">Paying by UPI</h2>
            {props.upiId ? (
              <>
                <p>After we confirm on WhatsApp, pay {formatINR(o.totalPaise)} to:</p>
                <p class="upi">{props.upiId}</p>
                <p class="note">Add {num} in the payment note.</p>
              </>
            ) : (
              <p>We'll send you UPI details on WhatsApp when we confirm.</p>
            )}
          </section>
        ) : null}

        <a class="btn ghost" href="/">Order again</a>
      </div>
    </Layout>
  );
}

export function MyOrdersPage(props: { orders: Order[] }) {
  return (
    <Layout title="My orders" noindex>
      <div class="wrap">
        <header class="top"><Brand /></header>
        <h1 style="font-size:26px">My orders</h1>
        {props.orders.length ? (
          <ul class="list">
            {props.orders.map((o) => (
              <li>
                <a href={`/o/${o.publicToken}`}>
                  <span>
                    <b>{orderNumber(o.seq)}</b> · {formatKg(o.sizeGrams)}
                    <br />
                    <span class="muted" style="font-size:14px">{formatDate(o.deliveryDate)}, {o.slotLabel}</span>
                  </span>
                  <span style="text-align:right">
                    <span class={`badge ${o.status}`}>{STATUS_LABEL[o.status as Status]}</span>
                    <br />
                    <span class="num">{formatINR(o.totalPaise)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">No orders from this phone yet.</p>
        )}
        <p class="note">Orders placed from this phone show here.</p>
        <a class="btn" href="/">Build a blend</a>
      </div>
    </Layout>
  );
}

export function MessagePage(props: { title: string; text: string; status?: number }) {
  return (
    <Layout title={props.title} noindex>
      <div class="wrap">
        <header class="top"><Brand /></header>
        <h1 style="font-size:26px">{props.title}</h1>
        <p>{props.text}</p>
        <a class="btn ghost" href="/">Go to the order page</a>
      </div>
    </Layout>
  );
}
