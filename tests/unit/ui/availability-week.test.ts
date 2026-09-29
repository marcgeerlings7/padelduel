import { describe, expect, it } from "vitest";
import {
  barPosition,
  formatHours,
  groupByDay,
  mondayBasedDay,
  toMinutes,
  trackRange,
  weekSummary,
} from "@/components/availability/week";

describe("toMinutes", () => {
  it("rekent UU:MM om naar minuten", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("19:30")).toBe(1170);
    expect(toMinutes("23:59")).toBe(1439);
  });
  it("geeft 0 voor ongeldige invoer", () => {
    expect(toMinutes("abc")).toBe(0);
  });
});

describe("trackRange", () => {
  it("is standaard 06:00–24:00", () => {
    expect(trackRange([])).toEqual({ startMinutes: 360, endMinutes: 1440 });
    expect(trackRange([{ dayOfWeek: 0, startTime: "08:00", endTime: "12:00" }])).toEqual({
      startMinutes: 360,
      endMinutes: 1440,
    });
  });
  it("verbreedt naar het hele uur van een vroeger blok", () => {
    expect(trackRange([{ dayOfWeek: 0, startTime: "05:30", endTime: "07:00" }]).startMinutes).toBe(300);
  });
});

describe("barPosition", () => {
  const range = { startMinutes: 360, endMinutes: 1440 };
  it("positioneert een blok als percentage", () => {
    const pos = barPosition({ dayOfWeek: 0, startTime: "18:00", endTime: "22:00" }, range);
    expect(pos.left).toBeCloseTo((720 / 1080) * 100);
    expect(pos.width).toBeCloseTo((240 / 1080) * 100);
  });
  it("klemt blokken buiten het bereik", () => {
    const pos = barPosition({ dayOfWeek: 0, startTime: "04:00", endTime: "07:00" }, range);
    expect(pos.left).toBe(0);
    expect(pos.width).toBeCloseTo((60 / 1080) * 100);
  });
});

describe("groupByDay", () => {
  it("groepeert per dag en sorteert op begintijd", () => {
    const days = groupByDay([
      { dayOfWeek: 2, startTime: "20:00", endTime: "22:00" },
      { dayOfWeek: 2, startTime: "08:00", endTime: "12:00" },
      { dayOfWeek: 6, startTime: "10:00", endTime: "11:00" },
    ]);
    expect(days).toHaveLength(7);
    expect(days[2]!.map((b) => b.startTime)).toEqual(["08:00", "20:00"]);
    expect(days[6]).toHaveLength(1);
    expect(days[0]).toHaveLength(0);
  });
});

describe("weekSummary", () => {
  it("telt uren en dagen, zonder overlap dubbel te tellen", () => {
    expect(
      weekSummary([
        { dayOfWeek: 1, startTime: "18:00", endTime: "22:00" },
        { dayOfWeek: 1, startTime: "20:00", endTime: "23:00" },
        { dayOfWeek: 3, startTime: "08:00", endTime: "12:00" },
      ]),
    ).toEqual({ totalMinutes: 5 * 60 + 4 * 60, days: 2 });
  });
  it("is leeg zonder blokken", () => {
    expect(weekSummary([])).toEqual({ totalMinutes: 0, days: 0 });
  });
});

describe("formatHours", () => {
  it("formatteert als uren en minuten", () => {
    expect(formatHours(570)).toBe("9 uur 30 min");
    expect(formatHours(60)).toBe("1 uur");
    expect(formatHours(45)).toBe("45 min");
    expect(formatHours(0)).toBe("0 uur");
  });
});

describe("mondayBasedDay", () => {
  it("zet zondag op 6 en maandag op 0", () => {
    expect(mondayBasedDay(new Date(2026, 8, 27))).toBe(6); // zondag
    expect(mondayBasedDay(new Date(2026, 8, 28))).toBe(0); // maandag
  });
});
