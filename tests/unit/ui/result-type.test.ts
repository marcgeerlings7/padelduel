import { describe, expect, it } from "vitest";
import {
  closedPostponements,
  dayOptions,
  formatDays,
  postponementErrorMessage,
  type PostponementOverview,
} from "@/components/matches/postponement";
import { previewRetirement, resultTypeNote, scoreErrorMessage, sideOf } from "@/components/matches/result-type";

describe("sideOf", () => {
  it("vertaalt eigen/tegenstander naar de API-kant", () => {
    expect(sideOf("own", "challenger")).toBe("challenger");
    expect(sideOf("opponent", "challenger")).toBe("challenged");
    expect(sideOf("own", "challenged")).toBe("challenged");
    expect(sideOf("opponent", "challenged")).toBe("challenger");
  });
});

describe("previewRetirement", () => {
  it("wacht zonder fout tot alles is ingevuld", () => {
    expect(previewRetirement([{ own: "6", opponent: "" }], "opponent", "challenger")).toEqual({ ok: false, error: null });
    expect(previewRetirement([{ own: "3", opponent: "2" }], null, "challenger")).toEqual({ ok: false, error: null });
  });

  it("vult een opgave van de tegenstander aan zoals de server (eigen perspectief)", () => {
    const preview = previewRetirement(
      [
        { own: "6", opponent: "4" },
        { own: "3", opponent: "2" },
      ],
      "opponent",
      "challenged",
    );
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    // API-vorm: uitdager eerst (wij zijn de uitgedaagde)
    expect(preview.apiSets).toEqual([
      { challengerGames: 4, challengedGames: 6 },
      { challengerGames: 2, challengedGames: 3 },
    ]);
    expect(preview.retiredSide).toBe("challenger");
    expect(preview.completed.map((s) => `${s.own}-${s.opponent}`)).toEqual(["6-4", "6-2"]);
  });

  it("eigen opgave: de tegenstander krijgt de rest", () => {
    const preview = previewRetirement([{ own: "5", opponent: "5" }], "own", "challenger");
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.completed.map((s) => `${s.own}-${s.opponent}`)).toEqual(["5-7", "0-6"]);
  });

  it("geeft de serverfout bij een al beslist resultaat of ongeldige lopende set", () => {
    const decided = previewRetirement(
      [
        { own: "6", opponent: "4" },
        { own: "6", opponent: "3" },
      ],
      "opponent",
      "challenger",
    );
    expect(decided).toMatchObject({ ok: false, error: expect.stringMatching(/gewone uitslag/) });
    const invalid = previewRetirement([{ own: "8", opponent: "2" }], "opponent", "challenger");
    expect(invalid).toMatchObject({ ok: false, error: expect.stringMatching(/lopende set/) });
    const lostBy = previewRetirement(
      [
        { own: "6", opponent: "4" },
        { own: "6", opponent: "3" },
      ],
      "own",
      "challenger",
    );
    expect(lostBy.ok).toBe(false);
  });
});

describe("resultTypeNote", () => {
  it("gewone uitslag → null", () => {
    expect(resultTypeNote({ resultType: "PLAYED", concedingSide: null }, "challenger", "Bravo")).toBeNull();
    expect(resultTypeNote({}, "challenger", "Bravo")).toBeNull();
  });

  it("walkover vanuit beide kanten", () => {
    const match = { resultType: "WALKOVER", concedingSide: "CHALLENGED" };
    expect(resultTypeNote(match, "challenger", "Bravo")?.description).toBe(
      "Walkover: Bravo kwam niet opdagen. Telt als 6-0 6-0.",
    );
    expect(resultTypeNote(match, "challenged", "Alfa")?.description).toMatch(/jullie waren er niet/);
  });

  it("opgave toont de gespeelde stand vanuit het eigen duo", () => {
    const match = { resultType: "RETIRED", concedingSide: "CHALLENGER", playedScoreRaw: "4-6,2-3" };
    const own = resultTypeNote(match, "challenger", "Bravo");
    expect(own).toMatchObject({ label: "Opgave" });
    expect(own?.description).toBe("Opgave door jullie bij 4-6 2-3. De rest van de wedstrijd telt als verloren.");
    const other = resultTypeNote(match, "challenged", "Alfa");
    expect(other?.description).toBe("Opgave door Alfa bij 6-4 3-2. De rest van de wedstrijd telt als gewonnen.");
    expect(other?.playedSets?.map((s) => `${s.own}-${s.opponent}`)).toEqual(["6-4", "3-2"]);
  });
});

describe("foutmeldingen", () => {
  it("vertaalt bekende codes en valt anders terug op de servermelding", () => {
    expect(scoreErrorMessage("ambiguous_duo", "x")).toMatch(/beide duo's/);
    expect(scoreErrorMessage("iets_anders", "Servermelding")).toBe("Servermelding");
    expect(postponementErrorMessage("postponement_already_pending", "x")).toMatch(/al een uitstelverzoek open/);
    expect(postponementErrorMessage("invalid_days", "x", 7)).toBe("Kies 1 tot en met 7 dagen uitstel.");
    expect(postponementErrorMessage(undefined, "Servermelding")).toBe("Servermelding");
  });
});

describe("uitstel-helpers", () => {
  it("dagen en afgeronde verzoeken", () => {
    expect(formatDays(1)).toBe("1 dag");
    expect(formatDays(3)).toBe("3 dagen");
    expect(dayOptions(3)).toEqual([1, 2, 3]);
    expect(dayOptions(0)).toEqual([]);
    const overview = {
      history: [
        { id: "p2", status: "pending" },
        { id: "p1", status: "declined" },
      ],
    } as unknown as PostponementOverview;
    expect(closedPostponements(overview).map((p) => p.id)).toEqual(["p1"]);
  });
});
