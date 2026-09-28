import { describe, expect, it } from "vitest";
import { tierBoundaries, toRatingSeries } from "@/components/app/rating-series";
import { duoInitials, formatRating, formatSignedDelta } from "@/components/app/format";

describe("toRatingSeries", () => {
  it("geeft een lege reeks voor lege historie", () => {
    expect(toRatingSeries([])).toEqual([]);
  });

  it("sorteert oplopend en begint met de rating vóór de oudste mutatie", () => {
    const series = toRatingSeries([
      { createdAt: "2026-08-03T10:00:00Z", ratingBefore: 1016, ratingAfter: 1030 },
      { createdAt: "2026-08-01T10:00:00Z", ratingBefore: 1000, ratingAfter: 1016 },
    ]);
    expect(series.map((p) => p.rating)).toEqual([1000, 1016, 1030]);
    expect(series[0].date.getTime()).toBeLessThan(series[1].date.getTime());
  });

  it("houdt bij gelijke tijdstippen de API-volgorde (nieuwste eerst) aan", () => {
    const series = toRatingSeries([
      { createdAt: "2026-08-01T10:00:00Z", ratingBefore: 1010, ratingAfter: 990 }, // later (forfeit-correctie)
      { createdAt: "2026-08-01T10:00:00Z", ratingBefore: 1000, ratingAfter: 1010 },
    ]);
    expect(series.map((p) => p.rating)).toEqual([1000, 1010, 990]);
  });

  it("negeert ongeldige datums", () => {
    const series = toRatingSeries([{ createdAt: "geen-datum", ratingBefore: 1, ratingAfter: 2 }]);
    expect(series).toEqual([]);
  });
});

describe("tierBoundaries", () => {
  it("geeft veelvouden van tierSize binnen het bereik", () => {
    expect(tierBoundaries(980, 1230, 100)).toEqual([1000, 1100, 1200]);
  });

  it("is leeg bij ongeldige invoer", () => {
    expect(tierBoundaries(1000, 900, 100)).toEqual([]);
    expect(tierBoundaries(0, 100, 0)).toEqual([]);
  });
});

describe("duoInitials", () => {
  it("pakt de eerste letters van de eerste twee woorden", () => {
    expect(duoInitials("Smash Sisters")).toBe("SS");
    expect(duoInitials("  drop shot dynamo ")).toBe("DS");
  });

  it("valt terug op twee letters of een vraagteken", () => {
    expect(duoInitials("Bandeja")).toBe("BA");
    expect(duoInitials("   ")).toBe("?");
  });
});

describe("formatRating / formatSignedDelta", () => {
  it("schrijft ratings zonder duizendtalscheiding", () => {
    expect(formatRating(1395.4)).toBe("1395");
  });

  it("gebruikt een echt minteken en ±0", () => {
    expect(formatSignedDelta(12)).toBe("+12");
    expect(formatSignedDelta(-8)).toBe("−8");
    expect(formatSignedDelta(0.2)).toBe("±0");
  });
});
