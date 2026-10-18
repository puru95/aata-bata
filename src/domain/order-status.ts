export const STATUSES = ["PLACED", "CONFIRMED", "SENT_TO_PARTNER", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  SENT_TO_PARTNER: "At the chakki",
  READY: "Ground and packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const FLOW: Status[] = ["PLACED", "CONFIRMED", "SENT_TO_PARTNER", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];

export const isTerminal = (s: Status) => s === "DELIVERED" || s === "CANCELLED";

/** Statuses an admin may move to from `from`: the next step, one step back (to fix a mis-tap), or cancel. */
export function allowedNext(from: Status): Status[] {
  if (isTerminal(from)) return [];
  const i = FLOW.indexOf(from);
  const out: Status[] = [];
  const next = FLOW[i + 1];
  if (next) out.push(next);
  const prev = FLOW[i - 1];
  if (prev) out.push(prev);
  out.push("CANCELLED");
  return out;
}

export const canTransition = (from: Status, to: Status) => allowedNext(from).includes(to);

/** Steps shown on the customer's timeline. */
export const TIMELINE: Status[] = FLOW;
