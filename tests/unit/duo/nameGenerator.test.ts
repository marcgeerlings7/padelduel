import { describe, it, expect } from "vitest";
import { generateDuoName } from "@/lib/duo/nameGenerator";

describe("generateDuoName", () => {
  it("genereert een niet-lege naam van 'Adjectief Zelfstandig naamwoord'", () => {
    const name = generateDuoName();
    expect(name.length).toBeGreaterThan(0);
    expect(name.split(" ")).toHaveLength(2);
  });

  it("blijft binnen de max-lengte van 100 tekens die de validatie ook hanteert", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateDuoName().length).toBeLessThanOrEqual(100);
    }
  });

  it("genereert voldoende variatie (niet steeds dezelfde naam)", () => {
    const names = new Set(Array.from({ length: 30 }, () => generateDuoName()));
    expect(names.size).toBeGreaterThan(1);
  });
});
