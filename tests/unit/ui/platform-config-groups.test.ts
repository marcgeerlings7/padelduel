import { describe, expect, it } from "vitest";
import { groupConfig, labelFor, unitFor } from "@/components/admin/platformConfigGroups";

describe("unitFor", () => {
  it("leidt de eenheid af uit de sleutel", () => {
    expect(unitFor("challenge_match_deadline_days", "14")).toBe("dagen");
    expect(unitFor("forfeit_cooldown_days", "1")).toBe("dag");
    expect(unitFor("match_auto_confirm_hours", "48")).toBe("uur");
    expect(unitFor("login_lockout_minutes", "15")).toBe("minuten");
    expect(unitFor("availability_api_rate_limit_per_minute", "60")).toBe("per minuut");
    expect(unitFor("rating_tier_size", "100")).toBe("punten");
    expect(unitFor("forfeit_rating_penalty", "10")).toBe("punten");
    expect(unitFor("max_active_duos_per_user", "5")).toBeNull();
  });
});

describe("groupConfig", () => {
  it("groepeert bekende sleutels en zet onbekende in Overig", () => {
    const groups = groupConfig([
      { key: "rating_tier_size", value: "100", description: null },
      { key: "login_max_attempts", value: "5", description: null },
      { key: "nieuwe_parameter", value: "1", description: "Nieuw" },
    ]);
    expect(groups.map((g) => g.id)).toEqual(["ladder", "security", "other"]);
    expect(groups.at(-1)!.entries[0]!.key).toBe("nieuwe_parameter");
  });

  it("laat lege groepen weg", () => {
    expect(groupConfig([])).toEqual([]);
  });
});

describe("labelFor", () => {
  it("geeft een leesbare naam, of de sleutel zelf als fallback", () => {
    expect(labelFor("rating_tier_size")).toBe("Tier-breedte");
    expect(labelFor("onbekend")).toBe("onbekend");
  });
});
