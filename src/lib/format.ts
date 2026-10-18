export const formatINR = (paise: number) => {
  const r = paise / 100;
  const frac = paise % 100 !== 0;
  return "₹" + r.toLocaleString("en-IN", { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: frac ? 2 : 0 });
};

export const formatKg = (grams: number) => (grams / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 }) + " kg";

export const orderNumber = (seq: number) => "PA-" + String(seq).padStart(5, "0");

/** "+919876543210" → "+91 98•••••210" */
export const maskPhone = (e164: string) => {
  const d = e164.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}•••••${d.slice(7)}` : "•••";
};

/** Indian mobile: 10 digits starting 6–9, optionally with +91/91/0 prefix. Returns E.164 or null. */
export const normalizeIndianMobile = (input: string) => {
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? "+91" + d : null;
};

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Today's date in IST as YYYY-MM-DD. */
export const istToday = (now = Date.now()) => new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);

/** UTC instant for a YYYY-MM-DD date and HH:MM time in IST. */
export const istInstant = (date: string, hhmm: string) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  return Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS;
};

export const addDays = (date: string, n: number) => {
  const t = new Date(date + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** "Sat 19 Oct" */
export const formatDate = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "07:00" → "7 AM", "18:30" → "6:30 PM" */
export const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const h12 = h % 12 || 12;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
};

/** "Morning 7–9 AM", "Lunch 11 AM–1 PM" */
export const slotText = (label: string, start: string, end: string) => {
  const a = formatTime(start);
  const b = formatTime(end);
  return `${label} ${a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a}–${b}`;
};

export const formatDateTimeIST = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
