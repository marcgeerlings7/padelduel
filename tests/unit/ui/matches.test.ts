import { describe, expect, it } from "vitest";
import { type Challenge, groupChallenges, groupOf, statusLabel } from "@/components/matches/challenges";
import {
  activeDrafts,
  needsDecider,
  perspectiveSets,
  previewScore,
  setProblem,
  stepGames,
  toApiSets,
} from "@/components/matches/score-entry";
import { deadlineUrgency, formatRelative } from "@/components/matches/time";

const NOW = new Date("2026-09-28T12:00:00Z");
const HOUR = 3_600_000;

describe("deadlineUrgency", () => {
  it("deelt deadlines in op resterende tijd", () => {
    expect(deadlineUrgency(new Date(NOW.getTime() - HOUR), NOW)).toBe("overdue");
    expect(deadlineUrgency(new Date(NOW.getTime() + 5 * HOUR), NOW)).toBe("urgent");
    expect(deadlineUrgency(new Date(NOW.getTime() + 48 * HOUR), NOW)).toBe("soon");
    expect(deadlineUrgency(new Date(NOW.getTime() + 5 * 24 * HOUR), NOW)).toBe("normal");
  });
});

describe("formatRelative", () => {
  it("formatteert in het Nederlands, uren onder 36 uur en anders dagen", () => {
    expect(formatRelative(new Date(NOW.getTime() + 5 * HOUR), NOW)).toBe("over 5 uur");
    expect(formatRelative(new Date(NOW.getTime() + 3 * 24 * HOUR), NOW)).toBe("over 3 dagen");
    expect(formatRelative(new Date(NOW.getTime() - 2 * 24 * HOUR), NOW)).toBe("eergisteren");
    expect(formatRelative(new Date(NOW.getTime() + 20 * 60_000), NOW)).toBe("over 20 minuten");
  });
});

describe("score-invoer", () => {
  it("accepteert geldige sets en geeft de serverfout voor ongeldige", () => {
    expect(setProblem({ own: "6", opponent: "4" })).toBeNull();
    expect(setProblem({ own: "7", opponent: "6" })).toBeNull();
    expect(setProblem({ own: "6", opponent: "5" })).toMatch(/Ongeldige setscore 6-5/);
    expect(setProblem({ own: "6", opponent: "6" })).toMatch(/gelijkspel/);
    expect(setProblem({ own: "6", opponent: "" })).toBeNull(); // nog niet volledig
  });

  it("controleert een super-tiebreak alleen als beslissende set", () => {
    expect(setProblem({ own: "10", opponent: "8" }, "tiebreak")).toBeNull();
    expect(setProblem({ own: "12", opponent: "10" }, "tiebreak")).toBeNull();
    expect(setProblem({ own: "10", opponent: "9" }, "tiebreak")).toMatch(/2 punten verschil/);
    expect(setProblem({ own: "7", opponent: "5" }, "tiebreak")).toMatch(/minstens 10 punten/);
    expect(setProblem({ own: "10", opponent: "8" }, "set")).toMatch(/super-tiebreak/);
  });

  it("vraagt alleen om een beslissende set bij 1-1 in sets", () => {
    expect(needsDecider({ own: "6", opponent: "4" }, { own: "6", opponent: "3" })).toBe(false);
    expect(needsDecider({ own: "6", opponent: "4" }, { own: "3", opponent: "6" })).toBe(true);
    const drafts = [
      { own: "6", opponent: "4" },
      { own: "6", opponent: "3" },
      { own: "1", opponent: "6" },
    ];
    expect(activeDrafts(drafts)).toHaveLength(2);
  });

  it("zet eigen perspectief om naar uitdager/uitgedaagde-volgorde", () => {
    const drafts = [
      { own: "6", opponent: "4" },
      { own: "3", opponent: "6" },
      { own: "10", opponent: "7" },
    ];
    expect(toApiSets(drafts, "challenger")).toEqual([
      { challengerGames: 6, challengedGames: 4 },
      { challengerGames: 3, challengedGames: 6 },
      { challengerGames: 10, challengedGames: 7 },
    ]);
    expect(toApiSets(drafts, "challenged")).toEqual([
      { challengerGames: 4, challengedGames: 6 },
      { challengerGames: 6, challengedGames: 3 },
      { challengerGames: 7, challengedGames: 10 },
    ]);
    expect(previewScore(drafts, "tiebreak")).toEqual({ ownSets: 2, opponentSets: 1, winner: "own" });
    expect(previewScore(drafts, "set")).toBeNull();
    expect(toApiSets([{ own: "6", opponent: "" }, { own: "6", opponent: "2" }], "challenger")).toBeNull();
  });

  it("stapt binnen de grenzen", () => {
    expect(stepGames("", 1)).toBe("1");
    expect(stepGames("0", -1)).toBe("0");
    expect(stepGames("6", 1)).toBe("7");
  });

  it("toont een opgeslagen score vanuit beide duo's", () => {
    expect(perspectiveSets("6-4,3-6,10-8", "challenged")).toEqual([
      { own: 4, opponent: 6, isMatchTiebreak: false },
      { own: 6, opponent: 3, isMatchTiebreak: false },
      { own: 8, opponent: 10, isMatchTiebreak: true },
    ]);
    expect(perspectiveSets("onzin", "challenger")).toEqual([]);
  });
});

function challenge(partial: Partial<Challenge>): Challenge {
  return {
    id: "c1",
    status: "PENDING",
    challengerDuoId: "a",
    challengedDuoId: "b",
    challengerDuo: { id: "a", name: "A" },
    challengedDuo: { id: "b", name: "B" },
    createdAt: "2026-09-20T10:00:00Z",
    respondedAt: null,
    responseDeadline: "2026-09-30T10:00:00Z",
    matchDeadline: null,
    match: null,
    voidedMatches: [],
    dispute: null,
    ...partial,
  };
}

const MATCH = {
  id: "m1",
  scoreRaw: "6-4,6-3",
  submittedBy: "u1",
  submittedAt: "2026-09-25T10:00:00Z",
  confirmedAt: null,
  autoConfirmDeadline: "2026-09-27T10:00:00Z",
  dispute: null,
};

describe("challenge-indeling", () => {
  it("deelt in vanuit het perspectief van het duo", () => {
    expect(groupOf(challenge({}), "b")).toBe("incoming");
    expect(groupOf(challenge({}), "a")).toBe("outgoing");
    expect(groupOf(challenge({ status: "ACCEPTED" }), "a")).toBe("toPlay");
    expect(groupOf(challenge({ status: "ACCEPTED", match: { ...MATCH, status: "AWAITING_CONFIRMATION" } }), "a")).toBe(
      "result",
    );
    expect(groupOf(challenge({ status: "ACCEPTED", match: { ...MATCH, status: "DISPUTED" } }), "b")).toBe("result");
    expect(groupOf(challenge({ status: "COMPLETED" }), "a")).toBe("done");
    expect(groupOf(challenge({ status: "UNPLAYED_TIMEOUT" }), "a")).toBe("done");
  });

  it("zet na een ongeldig verklaarde match de challenge terug bij te spelen", () => {
    const replay = challenge({ status: "ACCEPTED", voidedMatches: [{ ...MATCH, status: "VOIDED" }] });
    expect(groupOf(replay, "a")).toBe("toPlay");
  });

  it("sorteert afgerond op laatste activiteit, nieuwste eerst", () => {
    const old = challenge({ id: "old", status: "DECLINED", respondedAt: "2026-09-01T10:00:00Z" });
    const recent = challenge({
      id: "recent",
      status: "COMPLETED",
      match: { ...MATCH, status: "COMPLETED", confirmedAt: "2026-09-27T10:00:00Z" },
    });
    expect(groupChallenges([old, recent], "a").done.map((c) => c.id)).toEqual(["recent", "old"]);
  });

  it("gebruikt de statuslabels uit het e2e-contract", () => {
    expect(statusLabel(challenge({ status: "ACCEPTED" })).label).toBe("Geaccepteerd");
    expect(statusLabel(challenge({ status: "ACCEPTED", match: { ...MATCH, status: "AWAITING_CONFIRMATION" } })).label).toBe(
      "Wacht op bevestiging",
    );
    expect(statusLabel(challenge({ status: "ACCEPTED", match: { ...MATCH, status: "DISPUTED" } })).label).toBe("Betwist");
    expect(statusLabel(challenge({ status: "COMPLETED" })).label).toBe("Voltooid");
  });
});
