import { describe, it, expect } from "vitest";
import { getTier } from "@/lib/elo";

describe("getTier", () => {
  it("deelt correct in op basis van tier_size", () => {
    expect(getTier(1050, 100)).toBe(10);
    expect(getTier(950, 100)).toBe(9);
  });

  it("behandelt exacte tiergrenzen correct (rating precies op een veelvoud van tier_size)", () => {
    expect(getTier(1300, 100)).toBe(13);
    expect(getTier(1299, 100)).toBe(12);
    expect(getTier(1301, 100)).toBe(13);
  });

  it("werkt met een andere tier_size", () => {
    expect(getTier(1250, 250)).toBe(5);
    expect(getTier(1249, 250)).toBe(4);
  });
});
