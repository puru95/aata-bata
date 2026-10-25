import { describe, expect, it } from "vitest";
import { weakPin } from "./pin";

describe("weakPin", () => {
  it("accepts ordinary 4-digit PINs", () => {
    for (const p of ["4826", "1357", "0420", "9021"]) expect(weakPin(p)).toBeNull();
  });
  it("rejects wrong length or non-digits", () => {
    for (const p of ["", "123", "12345", "12a4", " 482"]) expect(weakPin(p)).toMatch(/4 digits/);
  });
  it("rejects repeated and sequential PINs", () => {
    for (const p of ["0000", "7777", "1234", "6789", "4321", "0123"]) expect(weakPin(p)).toMatch(/too easy/);
  });
});
