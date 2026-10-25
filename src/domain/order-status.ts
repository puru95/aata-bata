export const STATUSES = [
  "PLACED",
  "CONFIRMED",
  "SENT_TO_SHOP",
  "ACCEPTED",
  "GRINDING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;
export type Status = (typeof STATUSES)[number];
export type Role = "admin" | "shop" | "customer";

export const STATUS_LABEL: Record<Status, string> = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  SENT_TO_SHOP: "Sent to chakki",
  ACCEPTED: "Accepted by chakki",
  GRINDING: "Grinding",
  READY: "Ground and packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Hindi labels for the shop panel. */
export const STATUS_LABEL_HI: Partial<Record<Status, string>> = {
  SENT_TO_SHOP: "नया",
  ACCEPTED: "मंज़ूर",
  GRINDING: "पिसाई",
  READY: "तैयार",
};

const FLOW: Status[] = ["PLACED", "CONFIRMED", "SENT_TO_SHOP", "ACCEPTED", "GRINDING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];

export const isTerminal = (s: Status) => s === "DELIVERED" || s === "CANCELLED";

/** The steps each role may take. Admin can move any order one step either way or cancel it. */
export function allowedNext(from: Status, role: Role = "admin"): Status[] {
  if (isTerminal(from)) return [];
  if (role === "customer") return from === "PLACED" ? ["CANCELLED"] : [];
  if (role === "shop") {
    const shopMoves: Partial<Record<Status, Status>> = { SENT_TO_SHOP: "ACCEPTED", ACCEPTED: "GRINDING", GRINDING: "READY" };
    const to = shopMoves[from];
    return to ? [to] : [];
  }
  const i = FLOW.indexOf(from);
  const out: Status[] = [];
  const next = FLOW[i + 1];
  if (next) out.push(next);
  const prev = FLOW[i - 1];
  if (prev) out.push(prev);
  out.push("CANCELLED");
  return out;
}

export const canTransition = (from: Status, to: Status, role: Role = "admin") => allowedNext(from, role).includes(to);

/** Customer-facing timeline: the shop's three steps show as one. */
export const TIMELINE = [
  { label: "Order placed", statuses: ["PLACED"] },
  { label: "Confirmed", statuses: ["CONFIRMED"] },
  { label: "At the chakki", statuses: ["SENT_TO_SHOP", "ACCEPTED", "GRINDING"] },
  { label: "Ground and packed", statuses: ["READY"] },
  { label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"] },
  { label: "Delivered", statuses: ["DELIVERED"] },
] as const satisfies readonly { label: string; statuses: readonly Status[] }[];

/** Index of the timeline step an order is on (-1 if cancelled). */
export const timelineIndex = (s: Status) => TIMELINE.findIndex((t) => (t.statuses as readonly Status[]).includes(s));

/** Statuses that count as "in the shop's queue". */
export const SHOP_ACTIVE: Status[] = ["SENT_TO_SHOP", "ACCEPTED", "GRINDING", "READY"];
