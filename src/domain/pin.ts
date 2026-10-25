/** Error message for a shop PIN that's not 4 digits or too easy to guess, else null. */
export function weakPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) return "PIN must be 4 digits.";
  if (/^(\d)\1{3}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) return "That PIN is too easy to guess. Pick another.";
  return null;
}
