import { Brand, Layout } from "./layout";
import { STATUS_LABEL, STATUS_LABEL_HI, type Status } from "../domain/order-status";
import { formatDate, formatKg, orderNumber } from "../lib/format";
import type { schema } from "../db";

type Order = typeof schema.orders.$inferSelect;
type Item = typeof schema.orderItems.$inferSelect;
export type QueueOrder = Order & { items: Item[] };

const GRIND: Record<string, string> = { fine: "Fine · बारीक", medium: "Medium · मध्यम", coarse: "Coarse · मोटा" };

function ShopShell(props: { title: string; children: unknown; who?: string }) {
  return (
    <Layout title={props.title} bodyClass="shop" noindex>
      <div class="wrap">
        <header class="top">
          <Brand href="/shop" />
          {props.who ? (
            <form method="post" action="/shop/logout" style="margin:0"><button class="chip" type="submit">Log out</button></form>
          ) : null}
        </header>
        {props.children as never}
      </div>
    </Layout>
  );
}

const PinInput = (props: { id: string; name: string; label: string; autocomplete: string; autofocus?: boolean }) => (
  <label class="f" for={props.id}>
    <span>{props.label}</span>
    <input class="pin" id={props.id} name={props.name} type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength={4} autocomplete={props.autocomplete} required autofocus={props.autofocus} />
  </label>
);

/** First visit from the admin's link: pick a PIN. */
export function ShopSetupPage(props: { name: string; shopName: string; error?: string }) {
  return (
    <ShopShell title="Set your PIN">
      <form method="post" class="step">
        <h1 style="font-size:24px">Namaste, {props.name}</h1>
        <p class="muted">{props.shopName} · Pick a 4-digit PIN. You'll use it to open this page. · 4 अंकों का PIN चुनें।</p>
        <PinInput id="pin" name="pin" label="New PIN · नया PIN" autocomplete="new-password" autofocus />
        <PinInput id="pin2" name="pin2" label="Same PIN again · दोबारा" autocomplete="new-password" />
        {props.error ? <p class="err" role="alert">{props.error}</p> : null}
        <button class="btn" type="submit">Save PIN · सेव करें</button>
      </form>
    </ShopShell>
  );
}

export function ShopLinkInvalidPage() {
  return (
    <ShopShell title="Link expired">
      <section class="step">
        <h1 style="font-size:24px">This link doesn't work</h1>
        <p>It has expired or was already used. Ask us for a new login link on WhatsApp.</p>
        <p class="muted">यह लिंक पुराना है। नया लिंक माँगें।</p>
      </section>
    </ShopShell>
  );
}

/** Returning phone: PIN only. */
export function ShopPinPage(props: { name: string; shopName: string; error?: string }) {
  return (
    <ShopShell title="Enter PIN">
      <form method="post" action="/shop/login" class="step">
        <h1 style="font-size:24px">{props.name}</h1>
        <p class="muted">{props.shopName}</p>
        <PinInput id="pin" name="pin" label="PIN" autocomplete="current-password" autofocus />
        {props.error ? <p class="err" role="alert">{props.error}</p> : null}
        <button class="btn" type="submit">Open · खोलें</button>
      </form>
      <form method="post" action="/shop/forget" style="text-align:center">
        <button class="undo" type="submit">Not {props.name}? · कोई और?</button>
      </form>
    </ShopShell>
  );
}

export function ShopNotSetUpPage() {
  return (
    <ShopShell title="Chakki login">
      <section class="step">
        <h1 style="font-size:24px">Chakki login</h1>
        <p>Open the login link we sent you on WhatsApp. If you don't have one, ask us for it.</p>
        <p class="muted">WhatsApp पर भेजा गया लिंक खोलें।</p>
      </section>
    </ShopShell>
  );
}

const NEXT: Partial<Record<Status, { to: string; label: string }>> = {
  SENT_TO_SHOP: { to: "accept", label: "Accept · मंज़ूर करें" },
  ACCEPTED: { to: "grind", label: "Start grinding · पिसाई शुरू" },
};

function OrderCard(props: { o: QueueOrder; error?: { id: string; text: string } }) {
  const { o } = props;
  const status = o.status as Status;
  const next = NEXT[status];
  const err = props.error?.id === o.id ? props.error.text : "";
  return (
    <article class="card" id={`o-${o.id}`}>
      <div class="fill">
        <h3 style="font-size:20px">{orderNumber(o.seq)}</h3>
        <span class={`badge ${status}`}>{STATUS_LABEL_HI[status] ?? ""} · {STATUS_LABEL[status]}</span>
      </div>
      <p class="muted" style="font-size:14px">Pickup · {formatDate(o.deliveryDate)}, {o.slotLabel}</p>
      <p style="font-size:22px;font-weight:850">{formatKg(o.sizeGrams)} · {GRIND[o.grind]}</p>
      <div class="items num">
        {o.items.map((i) => <div><span>{i.grainName}</span><b>{formatKg(i.grams)}</b></div>)}
      </div>
      <p style="font-size:14px">Bags · बोरी: <b>{o.bags.map((b) => `${b.qty} × ${formatKg(b.grams)}`).join(" + ")}</b></p>
      {o.note ? <p style="font-size:14px">Note: {o.note}</p> : null}
      {o.problem ? <p class="err" role="status">Problem sent: {o.problem}</p> : null}
      {err ? <p class="err" role="alert">{err}</p> : null}

      {next ? (
        <form method="post" action={`/shop/o/${o.id}/${next.to}`}><button class="btn" type="submit">{next.label}</button></form>
      ) : status === "GRINDING" ? (
        <form method="post" action={`/shop/o/${o.id}/ready`} class="filters">
          <label class="f" for={`w-${o.id}`}><span>Packed weight, kg · वज़न</span>
            <input id={`w-${o.id}`} name="kg" inputmode="decimal" placeholder={String(o.sizeGrams / 1000)} required />
          </label>
          <button class="btn" type="submit" style="width:auto">Ready · तैयार</button>
        </form>
      ) : status === "READY" ? (
        <p class="fstate done">Packed {o.outputGrams ? formatKg(o.outputGrams) : ""} · waiting for pickup</p>
      ) : null}

      <details>
        <summary class="undo" style="list-style:none;cursor:pointer">Report a problem · समस्या बताएँ</summary>
        <form method="post" action={`/shop/o/${o.id}/problem`} class="filters" style="margin-top:8px">
          <label class="f" for={`p-${o.id}`}><span>What's wrong?</span>
            <input id={`p-${o.id}`} name="problem" maxlength={300} placeholder="e.g. barley short by 1 kg" required />
          </label>
          <button class="chip" type="submit">Send</button>
        </form>
      </details>
    </article>
  );
}

export function ShopQueuePage(props: { name: string; shopName: string; orders: QueueOrder[]; done: QueueOrder[]; flash?: string; error?: { id: string; text: string } }) {
  const open = props.orders.filter((o) => o.status !== "READY");
  const ready = props.orders.filter((o) => o.status === "READY");
  const kg = open.reduce((a, o) => a + o.sizeGrams, 0);
  return (
    <ShopShell title="Orders" who={props.name}>
      <section class="hero">
        <h1 style="font-size:28px">{props.shopName}</h1>
        <p class="muted">{props.name} · {open.length ? `${open.length} to grind · ${formatKg(kg)}` : "Nothing to grind right now · अभी कोई ऑर्डर नहीं"}</p>
      </section>
      {props.flash ? <p class="flash" role="status">{props.flash}</p> : null}
      {props.error && !props.orders.some((o) => o.id === props.error!.id) ? <p class="err" role="alert">{props.error.text}</p> : null}
      {open.map((o) => <OrderCard o={o} error={props.error} />)}
      {ready.length ? <h2 style="font-size:19px">Ready for pickup · तैयार</h2> : null}
      {ready.map((o) => <OrderCard o={o} error={props.error} />)}
      {props.done.length ? (
        <section class="card">
          <h2 style="font-size:17px">Picked up recently</h2>
          <div class="items num">
            {props.done.map((o) => <div><span>{orderNumber(o.seq)} · {formatDate(o.deliveryDate)}</span><b>{formatKg(o.outputGrams ?? o.sizeGrams)}</b></div>)}
          </div>
        </section>
      ) : null}
      <p class="note" style="text-align:center">This page doesn't refresh by itself. Pull down to check for new orders.</p>
    </ShopShell>
  );
}
