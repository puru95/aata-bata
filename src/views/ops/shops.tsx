import { OpsShell } from "./pages";
import { WhatsAppIcon } from "../layout";
import { formatDateTimeIST, formatINR } from "../../lib/format";
import type { schema } from "../../db";

type Shop = typeof schema.shops.$inferSelect;
type ShopUser = typeof schema.shopUsers.$inferSelect;
export type ShopForm = { name: string; ownerName: string; phone: string; address: string; rate: string };

const rupees = (p: number) => (p / 100).toFixed(2).replace(/\.00$/, "");
const localPhone = (e164: string) => e164.replace(/^\+91/, "");

function ShopFields(props: { v: ShopForm }) {
  const { v } = props;
  return (
    <div class="fields">
      <label class="f full" for="s-name"><span>Shop name</span><input id="s-name" name="name" value={v.name} maxlength={80} required /></label>
      <label class="f" for="s-owner"><span>Owner</span><input id="s-owner" name="ownerName" value={v.ownerName} maxlength={80} /></label>
      <label class="f" for="s-phone"><span>Mobile (WhatsApp)</span><input id="s-phone" name="phone" type="tel" inputmode="tel" value={v.phone} placeholder="10 digits" required /></label>
      <label class="f full" for="s-addr"><span>Address</span><input id="s-addr" name="address" value={v.address} maxlength={200} /></label>
      <label class="f" for="s-rate"><span>We pay per kg (₹)</span><input id="s-rate" name="rate" inputmode="decimal" value={v.rate} placeholder="e.g. 3" required /></label>
    </div>
  );
}

export function ShopsPage(props: { shops: (Shop & { staff: number })[]; form?: ShopForm; error?: string; flash?: string }) {
  const form = props.form ?? { name: "", ownerName: "", phone: "", address: "", rate: "" };
  return (
    <OpsShell title="Shops" flash={props.flash}>
      <h1 style="font-size:24px">Shops</h1>
      {props.shops.length ? (
        <ul class="list">
          {props.shops.map((s) => (
            <li>
              <a href={`/ops/shops/${s.id}`}>
                <span><b>{s.name}</b><br /><span class="muted" style="font-size:14px">{s.ownerName || "—"} · {formatINR(s.grindRatePaisePerKg)}/kg · {s.staff} staff</span></span>
                <span class={`badge ${s.active ? "DELIVERED" : "CANCELLED"}`}>{s.active ? "Active" : "Off"}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">No shops yet. Add your partner chakki below, then add the people who'll use the shop panel.</p>
      )}
      <form method="post" action="/ops/shops" class="step">
        <h2 style="font-size:19px">Add a shop</h2>
        <ShopFields v={form} />
        {props.error ? <p class="err" role="alert">{props.error}</p> : null}
        <button class="btn" type="submit">Add shop</button>
      </form>
    </OpsShell>
  );
}

export type NewLink = { name: string; url: string; waHref: string };

export function ShopPage(props: { shop: Shop; staff: ShopUser[]; flash?: string; error?: string; form?: ShopForm; link?: NewLink }) {
  const s = props.shop;
  const form = props.form ?? { name: s.name, ownerName: s.ownerName, phone: localPhone(s.phone), address: s.address, rate: rupees(s.grindRatePaisePerKg) };
  const state = (u: ShopUser) =>
    !u.active ? "Off"
    : u.pinHash ? (u.failedPins >= 5 ? "Locked — send a new link" : "Signed up")
    : u.linkExpiresAt && u.linkExpiresAt.getTime() > Date.now() ? `Link sent · works till ${formatDateTimeIST(u.linkExpiresAt)}`
    : "Link expired";
  return (
    <OpsShell title={s.name} flash={props.flash}>
      <p><a href="/ops/shops">← Shops</a></p>
      <h1 style="font-size:24px">{s.name} <span class={`badge ${s.active ? "DELIVERED" : "CANCELLED"}`}>{s.active ? "Active" : "Off"}</span></h1>

      {props.link ? (
        <section class="card" role="status">
          <h2 style="font-size:17px">Login link for {props.link.name}</h2>
          <p>Send this to {props.link.name}. It works once, for 48 hours. They open it on their phone and pick a 4-digit PIN.</p>
          <input class="in" readonly value={props.link.url} aria-label="Login link" onclick="this.select()" style="width:100%;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid var(--glass-line);background:var(--field)" />
          <a class="btn wa" href={props.link.waHref} target="_blank" rel="noopener"><WhatsAppIcon /> Send on WhatsApp</a>
          <p class="note">This link is shown only now. If it's lost, make a new one.</p>
        </section>
      ) : null}

      <section class="card">
        <h2 style="font-size:17px">People who use the shop panel</h2>
        {props.staff.length ? (
          <ul class="list" style="gap:12px">
            {props.staff.map((u) => (
              <li style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid var(--line);padding-top:10px">
                <span><b>{u.name}</b><br /><span class="muted" style="font-size:13px">{state(u)}</span></span>
                <span class="acts">
                  {u.active ? (
                    <form method="post" action={`/ops/shops/${s.id}/staff/${u.id}/link`}><button type="submit" class="primary">{u.pinHash ? "New login link" : "Make login link"}</button></form>
                  ) : null}
                  <form method="post" action={`/ops/shops/${s.id}/staff/${u.id}/active`}>
                    <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                    <button type="submit" class={u.active ? "danger" : ""}>{u.active ? "Turn off" : "Turn on"}</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">No one yet. Add the owner or whoever runs the chakki.</p>
        )}
        <form method="post" action={`/ops/shops/${s.id}/staff`} class="filters">
          <label class="f" for="u-name"><span>Add a person</span><input id="u-name" name="name" maxlength={60} placeholder="Name" required /></label>
          <button class="chip" type="submit">Add and make link</button>
        </form>
        <p class="note">A new link replaces their PIN and signs them out on other phones. "Turn off" signs them out everywhere at once — use it for a lost phone or someone who left.</p>
      </section>

      <form method="post" action={`/ops/shops/${s.id}`} class="step">
        <h2 style="font-size:19px">Shop details</h2>
        <ShopFields v={form} />
        <label class="chk"><input type="checkbox" name="active" checked={s.active} /> Shop is active (can get orders and sign in)</label>
        {props.error ? <p class="err" role="alert">{props.error}</p> : null}
        <button class="btn" type="submit">Save details</button>
      </form>
    </OpsShell>
  );
}
