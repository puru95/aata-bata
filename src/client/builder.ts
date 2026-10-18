// Blend builder + checkout. Bundled by esbuild and inlined into the home page.
import { ROTI_GRAMS, SIZES_GRAMS, STEP_GRAMS, bagSplit, blendNutrition, quote, scaleRatio, type BlendLine, type Nutrition } from "../domain/pricing";

type Data = {
  grains: { id: string; name: string; nameHi: string; tip: string; color: string; sell: number; n: Nutrition }[];
  presets: { id: string; name: string; description: string; ratio: Record<string, number> }[];
  price: { grindChargePaisePerKg: number; deliveryChargePaise: number };
  societies: string[];
  slots: { key: string; dateLabel: string; label: string; left: number }[];
};

const data: Data = JSON.parse(document.getElementById("data")!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const inr = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: p % 100 ? 2 : 0, minimumFractionDigits: p % 100 ? 2 : 0 });
const kgN = (g: number) => (g / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 });
const kg = (g: number) => kgN(g) + " kg";
const fix = (v: number, d: number) => v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const go = (id: string) => $(id).scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
const CHECK = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const grainPrices = data.grains.map((g) => ({ id: g.id, name: g.name, sellPaisePerKg: g.sell, costPaisePerKg: 0 }));
const priceSettings = { ...data.price, grindCostPaisePerKg: 0, deliveryCostPaise: 0, bagCostPaise: 0 };
const nutritionById = Object.fromEntries(data.grains.map((g) => [g.id, g.n]));
const NUTR = [
  { k: "carb", label: "Carbohydrates", unit: "g", d: 1 },
  { k: "prot", label: "Protein", unit: "g", d: 1 },
  { k: "fib", label: "Fibre", unit: "g", d: 1 },
  { k: "fat", label: "Fat", unit: "g", d: 1 },
  { k: "ca", label: "Calcium", unit: "mg", d: 0 },
  { k: "fe", label: "Iron", unit: "mg", d: 1 },
] as const;
const GRINDS = [["fine", "Fine", "बारीक"], ["medium", "Medium", "मध्यम"], ["coarse", "Coarse", "मोटा"]] as const;
const PAYS = [["upi", "UPI", "After we confirm"], ["cod", "Cash", "On delivery"]] as const;

// State ----------------------------------------------------------------------

type State = { size: number; preset: string; grams: Record<string, number>; grind: string; slot: string; pay: string; per: "100" | "roti" };
type Details = { name: string; phone: string; society: string; tower: string; flat: string; note: string };
const load = <T,>(k: string, d: T): T => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || "{}") }; } catch { return d; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const s = load<State>("atta-state", { size: 10000, preset: "custom", grams: {}, grind: "medium", slot: "", pay: "upi", per: "100" });
const det = load<Details>("atta-details", { name: "", phone: "", society: data.societies[0] ?? "", tower: "", flat: "", note: "" });
if (!(SIZES_GRAMS as readonly number[]).includes(s.size)) s.size = 10000;
// Drop grains that are no longer sold.
for (const id of Object.keys(s.grams)) if (!nutritionById[id]) delete s.grams[id];
if (!data.slots.some((x) => x.key === s.slot)) s.slot = data.slots[0]?.key ?? "";
if (!data.societies.includes(det.society)) det.society = data.societies[0] ?? "";

const lines = (): BlendLine[] => data.grains.filter((g) => s.grams[g.id]).map((g) => ({ grainId: g.id, grams: s.grams[g.id]! }));
const total = () => lines().reduce((a, l) => a + l.grams, 0);
const full = () => total() === s.size;
const save = () => store("atta-state", s);
let lastCleared: Record<string, number> | null = null;
let undoTimer = 0;

function ratioNow() {
  const t = total();
  const r: Record<string, number> = {};
  if (t) for (const l of lines()) r[l.grainId] = l.grams;
  return r;
}

// Render ---------------------------------------------------------------------

function opts(el: HTMLElement, items: readonly (readonly [string, string, string])[], key: "grind" | "pay") {
  el.innerHTML = items.map(([id, name, sub]) => `<button type="button" class="opt" data-v="${id}" aria-pressed="${s[key] === id}">${name}<small>${sub}</small></button>`).join("");
}

function render() {
  const t = total();
  const q = quote(lines(), grainPrices, priceSettings);
  const left = s.size - t;

  $("sizes").innerHTML = SIZES_GRAMS.map((g) => `<button type="button" class="opt" data-size="${g}" aria-pressed="${s.size === g}">${kgN(g)}<small>kg</small></button>`).join("");
  $("rotis").textContent = "≈ " + Math.round(s.size / ROTI_GRAMS / 10) * 10 + " rotis";

  $("presets").innerHTML = [{ id: "custom", name: "Custom", description: "Pick your own grains" }, ...data.presets]
    .map((p) => `<button type="button" class="opt preset${p.id === "custom" ? " wide" : ""}" data-preset="${esc(p.id)}" aria-pressed="${s.preset === p.id}">${esc(p.name)}<small>${esc(p.description)}</small></button>`)
    .join("");

  $("fillKg").innerHTML = `${kgN(t)} <span>of ${kg(s.size)}</span>`;
  const fs = $("fstate");
  fs.className = "fstate" + (left === 0 ? " done" : "");
  fs.innerHTML = left === 0 ? "Bag full " + CHECK : t ? kg(left) + " left" : "Tap + to add";
  $("comp").innerHTML = lines().map((l) => `<i style="width:${(l.grams / s.size) * 100}%;background:${esc(data.grains.find((g) => g.id === l.grainId)!.color)}"></i>`).join("");
  $<HTMLButtonElement>("fillWheat").disabled = left <= 0 || !nutritionById.wheat;
  $<HTMLButtonElement>("clear").disabled = t === 0;

  $("grains").innerHTML = data.grains
    .map((g) => {
      const gr = s.grams[g.id] ?? 0;
      return `<li class="grain${gr ? "" : " off"}"><div class="gn"><span class="dot" style="background:${esc(g.color)}"></span><span><b>${esc(g.name)}</b> <span class="hi">${esc(g.nameHi)}</span></span><small>${esc(g.tip)} · ${inr(g.sell)}/kg</small>${gr ? `<span class="pc num">${Math.round((gr / s.size) * 100)}%</span>` : ""}</div><div class="stp"><button type="button" data-g="${esc(g.id)}" data-d="-1" aria-label="Less ${esc(g.name)}"${gr ? "" : " disabled"}>−</button><output class="num">${kg(gr)}</output><button type="button" class="plus" data-g="${esc(g.id)}" data-d="1" aria-label="More ${esc(g.name)}"${left > 0 ? "" : " disabled"}>+</button></div></li>`;
    })
    .join("");

  renderNutrition();
  opts($("grind"), GRINDS, "grind");
  opts($("pay"), PAYS, "pay");

  $("sum").innerHTML =
    `<div><span>Grains</span><span>${inr(q.grainSubtotalPaise)}</span></div>` +
    `<div><span>Grinding</span><span>${inr(q.grindChargePaise)}</span></div>` +
    `<div><span>Delivery</span><span>${q.deliveryChargePaise ? inr(q.deliveryChargePaise) : "Free"}</span></div>` +
    `<div><span>Bags</span><span>${t ? bagSplit(t).map((b) => `${b.qty} × ${kg(b.grams)}`).join(" + ") : "—"}</span></div>` +
    `<div class="t"><span>Total</span><span>${inr(q.totalPaise)}</span></div>`;

  $("barP").textContent = inr(q.totalPaise);
  $("barS").textContent = left === 0 ? `${kg(t)} · ${inr(q.perKgPaise)}/kg` : t ? `${kgN(t)} of ${kg(s.size)}` : "Fill your bag";
  $("barPg").style.width = Math.min(100, (t / s.size) * 100) + "%";
  const barBtn = $<HTMLButtonElement>("barBtn");
  barBtn.disabled = left !== 0;
  barBtn.textContent = left === 0 ? "Checkout" : "Fill your bag";
  $<HTMLButtonElement>("place").textContent = left === 0 ? `Place order · ${inr(q.totalPaise)}` : "Fill your bag first";
  tracker();
}

function renderNutrition() {
  const n = blendNutrition(lines(), nutritionById);
  const f = s.per === "roti" ? ROTI_GRAMS / 100 : 1;
  $("per100").setAttribute("aria-pressed", String(s.per === "100"));
  $("perRoti").setAttribute("aria-pressed", String(s.per === "roti"));
  if (!n) {
    $("nutSum").textContent = "Nutrition: add grains to see it";
    $("nut").innerHTML = "";
    return;
  }
  $("nutSum").innerHTML = `Per 100 g · <b class="num">${Math.round(n.kcal)}</b> kcal · ${fix(n.prot, 1)} g protein · ${fix(n.fib, 1)} g fibre`;
  const w = nutritionById.wheat;
  $("nut").innerHTML =
    `<div class="nr h"><span>${s.per === "roti" ? `Per roti (${ROTI_GRAMS} g) · ${Math.round(n.kcal * f)} kcal` : `Per 100 g · ${Math.round(n.kcal)} kcal`}</span><span></span><span class="d">${w ? "vs wheat" : ""}</span></div>` +
    NUTR.map((m) => {
      const v = n[m.k] * f;
      let d = "";
      let up = false;
      if (w) {
        const diff = v - w[m.k] * f;
        const min = m.d ? 0.05 : 0.5;
        d = Math.abs(diff) >= min ? (diff > 0 ? "+" : "−") + fix(Math.abs(diff), m.d) : "–";
        up = diff >= min && m.k !== "carb" && m.k !== "fat";
      }
      return `<div class="nr num"><span>${m.label}</span><span class="v">${fix(v, m.d)} ${m.unit}</span><span class="d${up ? " up" : ""}">${d}</span></div>`;
    }).join("");
}

const REQUIRED: [keyof Details, string][] = [["name", "Enter your name"], ["phone", "Enter a 10-digit mobile number"], ["tower", "Enter your tower"], ["flat", "Enter your flat number"]];
const phoneOk = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""));
const fieldOk = (k: keyof Details) => (k === "phone" ? phoneOk(det.phone) : !!det[k].trim());
const missing = () => REQUIRED.filter(([k]) => !fieldOk(k));

function fieldError(k: keyof Details, msg: string) {
  const input = $<HTMLInputElement>("f-" + k);
  $("e-" + k).textContent = msg;
  if (msg) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function tracker() {
  const steps = [
    ["Size", "s1", true],
    ["Grains", "s2", full()],
    ["Delivery", "s3", full() && !!s.slot],
    ["Details", "s4", full() && !!s.slot && missing().length === 0],
  ] as const;
  const now = steps.findIndex((x) => !x[2]);
  $("tracker").innerHTML = steps
    .map(([label, to, done], i) => `<li><button type="button" data-to="${to}" class="${done ? "done" : i === now ? "now" : ""}"${i === now ? ' aria-current="step"' : ""}><span class="c">${done ? CHECK : i + 1}</span>${label}</button></li>`)
    .join("");
}

// Events ---------------------------------------------------------------------

function change(id: string, d: number) {
  const next = Math.max(0, (s.grams[id] ?? 0) + d * STEP_GRAMS);
  if (next) s.grams[id] = next;
  else delete s.grams[id];
  s.preset = "custom";
  save();
  render();
}

document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  const ds = b.dataset;
  if (ds.size) {
    const size = Number(ds.size);
    const preset = data.presets.find((p) => p.id === s.preset);
    const ratio = preset ? preset.ratio : ratioNow();
    s.size = size;
    s.grams = Object.keys(ratio).length ? scaleRatio(ratio, size) : {};
  } else if (ds.preset) {
    s.preset = ds.preset;
    const p = data.presets.find((x) => x.id === ds.preset);
    if (p) s.grams = scaleRatio(p.ratio, s.size);
  } else if (ds.g) return change(ds.g, Number(ds.d));
  else if (ds.v && b.parentElement!.id === "grind") s.grind = ds.v;
  else if (ds.v && b.parentElement!.id === "pay") s.pay = ds.v;
  else if (ds.to) return go(ds.to);
  else if (b.id === "fillWheat") {
    const left = s.size - total();
    if (left > 0) s.grams.wheat = (s.grams.wheat ?? 0) + left;
    s.preset = "custom";
  } else if (b.id === "clear") {
    lastCleared = { ...s.grams };
    s.grams = {};
    s.preset = "custom";
    $("undo").hidden = false;
    clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => ($("undo").hidden = true), 8000);
  } else if (b.id === "undo") {
    if (lastCleared) s.grams = lastCleared;
    $("undo").hidden = true;
  } else if (b.id === "per100" || b.id === "perRoti") {
    s.per = b.id === "perRoti" ? "roti" : "100";
    save();
    return renderNutrition();
  } else if (b.id === "barBtn") {
    go("s3");
    return;
  } else return;
  save();
  render();
});

// Form -------------------------------------------------------------------------

const slotSel = $<HTMLSelectElement>("f-slot");
slotSel.innerHTML = data.slots.length
  ? data.slots.map((x) => `<option value="${esc(x.key)}"${x.key === s.slot ? " selected" : ""}>${esc(x.dateLabel)} · ${esc(x.label)}${x.left <= 3 ? ` (${x.left} left)` : ""}</option>`).join("")
  : `<option value="">No slots open right now</option>`;
slotSel.addEventListener("change", () => { s.slot = slotSel.value; save(); tracker(); });

const socSel = $<HTMLSelectElement>("f-society");
socSel.innerHTML = data.societies.map((x) => `<option${x === det.society ? " selected" : ""}>${esc(x)}</option>`).join("");

for (const k of ["name", "phone", "society", "tower", "flat", "note"] as (keyof Details)[]) {
  const el = $<HTMLInputElement>("f-" + k);
  el.value = det[k];
  el.addEventListener("input", () => {
    det[k] = el.value;
    store("atta-details", det);
    if (fieldOk(k)) fieldError(k, "");
    tracker();
  });
  const req = REQUIRED.find(([rk]) => rk === k);
  if (req) el.addEventListener("blur", () => { if (el.value) fieldError(k, fieldOk(k) ? "" : req[1]); });
}

$("checkout").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("formErr");
  err.textContent = "";
  if (!full()) {
    err.textContent = `Your bag isn't full yet. Add ${kg(s.size - total())} more in step 2.`;
    return go("s2");
  }
  if (!s.slot) {
    err.textContent = "No delivery slot is open right now. Please message us on WhatsApp.";
    return;
  }
  const m = missing();
  if (m.length) {
    m.forEach(([k, msg]) => fieldError(k, msg));
    $("f-" + m[0]![0]).focus();
    return;
  }
  const btn = $<HTMLButtonElement>("place");
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  btn.textContent = "Placing order…";
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sizeGrams: s.size, grind: s.grind, lines: lines(), slot: s.slot, payment: s.pay, ...det }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.url) {
      location.href = out.url;
      return;
    }
    if (out.field && REQUIRED.some(([k]) => k === out.field)) {
      fieldError(out.field, out.error);
      $("f-" + out.field).focus();
    } else err.textContent = out.error || "Something went wrong. Please try again.";
    if (out.code === "slot") setTimeout(() => location.reload(), 2500);
  } catch {
    err.textContent = "No internet connection. Check your network and try again.";
  }
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  render();
});

render();
