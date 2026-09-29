import { describe, it, expect } from "vitest";
import {
  buildMatchHistory,
  computeDuoRecord,
  computeHeadToHead,
  computeReliability,
  computeStreak,
  CompletedMatchRow,
  groupMatchesByDuo,
  HistoryRatingRow,
  isInactive,
  lastActivityAt,
  matchFromPerspective,
  perspectiveScoreRaw,
} from "@/lib/stats";
import { headToHeadParamsSchema, matchHistoryQuerySchema } from "@/lib/stats/validation";
import { summarizeScore, parseScore } from "@/lib/match/score";

const A = "duo-a";
const B = "duo-b";
const C = "duo-c";

let seq = 0;
function match(
  challenger: string,
  challenged: string,
  scoreRaw: string,
  day: number,
  overrides: Partial<CompletedMatchRow> = {},
): CompletedMatchRow {
  seq++;
  return {
    matchId: `m-${String(seq).padStart(3, "0")}`,
    challengeId: `c-${seq}`,
    challengerDuoId: challenger,
    challengedDuoId: challenged,
    scoreRaw,
    submittedAt: new Date(Date.UTC(2026, 8, day, 12)),
    confirmedAt: new Date(Date.UTC(2026, 8, day + 1, 12)),
    ...overrides,
  };
}

describe("summarizeScore (KNLTB-telling)", () => {
  it("telt een match-tiebreak als één set én 1-0 in games", () => {
    expect(summarizeScore(parseScore("7-6,6-7,10-8"))).toEqual({
      challengerSets: 2,
      challengedSets: 1,
      challengerGames: 14,
      challengedGames: 13,
    });
  });

  it("telt gewone sets gewoon op", () => {
    expect(summarizeScore(parseScore("6-4,3-6,6-2"))).toEqual({
      challengerSets: 2,
      challengedSets: 1,
      challengerGames: 15,
      challengedGames: 12,
    });
  });
});

describe("matchFromPerspective", () => {
  it("draait de score om voor de uitgedaagde", () => {
    const p = matchFromPerspective(match(A, B, "6-4,3-6,10-8", 1), B)!;
    expect(p.won).toBe(false);
    expect(p.role).toBe("challenged");
    expect(p.score).toBe("4-6,6-3,8-10");
    expect(p.sets[2]).toEqual({ own: 8, opponent: 10, isMatchTiebreak: true });
    expect([p.setsWon, p.setsLost, p.gamesWon, p.gamesLost]).toEqual([1, 2, 10, 10]);
  });

  it("geeft null voor een niet-betrokken duo of een onleesbare score", () => {
    expect(matchFromPerspective(match(A, B, "6-4,6-4", 1), C)).toBeNull();
    expect(matchFromPerspective(match(A, B, "kapot", 1), A)).toBeNull();
  });
});

describe("computeStreak", () => {
  it("telt de reeks vanaf de laatste uitslag", () => {
    expect(computeStreak([])).toBeNull();
    expect(computeStreak([true, false, true, true, true])).toEqual({ result: "W", length: 3 });
    expect(computeStreak([true, false, false])).toEqual({ result: "L", length: 2 });
  });
});

describe("computeDuoRecord", () => {
  it("berekent W-L, reeks en saldo's chronologisch op indieningsmoment (niet invoervolgorde)", () => {
    const matches = [
      match(A, B, "6-0,6-0", 10), // A wint (laatste)
      match(C, A, "6-4,6-4", 5), // A verliest
      match(A, C, "7-6,6-7,10-8", 7), // A wint
    ];
    const r = computeDuoRecord(A, matches);
    expect(r.wins).toBe(2);
    expect(r.losses).toBe(1);
    expect(r.streak).toBe("W2");
    expect(r.streakDetail).toEqual({ result: "W", length: 2 });
    // sets: 2-0 + 0-2 + 2-1 ; games: 12-0 + 8-12 + 14-13
    expect([r.setsWon, r.setsLost, r.setDifference]).toEqual([4, 3, 1]);
    expect([r.gamesWon, r.gamesLost, r.gameDifference]).toEqual([34, 25, 9]);
    expect(r.lastConfirmedMatchAt).toEqual(new Date(Date.UTC(2026, 8, 11, 12)));
  });

  it("geeft een lege staat ('—') zonder matches", () => {
    const r = computeDuoRecord(A, []);
    expect(r).toMatchObject({ wins: 0, losses: 0, streak: "—", streakDetail: null, gameDifference: 0 });
    expect(r.lastConfirmedMatchAt).toBeNull();
  });

  it("slaat een onleesbare score over i.p.v. te crashen", () => {
    const r = computeDuoRecord(A, [match(A, B, "6-1,6-1", 1), match(A, B, "???", 2)]);
    expect(r.wins).toBe(1);
    expect(r.losses).toBe(0);
  });
});

describe("groupMatchesByDuo", () => {
  it("plaatst een match bij beide betrokken duo's en negeert onbekende duo's", () => {
    const m = match(A, B, "6-1,6-1", 1);
    const grouped = groupMatchesByDuo([m, match(B, C, "6-1,6-1", 2)], [A, B]);
    expect(grouped.get(A)).toEqual([m]);
    expect(grouped.get(B)).toHaveLength(2);
    expect(grouped.has(C)).toBe(false);
  });
});

describe("computeReliability", () => {
  it("rekent X/Y met afgerond percentage", () => {
    expect(computeReliability(7, 2)).toEqual({ played: 7, total: 9, percentage: 78 });
    expect(computeReliability(0, 0)).toEqual({ played: 0, total: 0, percentage: null });
    expect(computeReliability(0, 3).percentage).toBe(0);
  });

  it("weigert negatieve of niet-gehele tellingen", () => {
    expect(() => computeReliability(-1, 0)).toThrow(RangeError);
    expect(() => computeReliability(1.5, 0)).toThrow(RangeError);
  });
});

describe("activiteit / inactief", () => {
  const created = new Date("2026-01-01T00:00:00Z");

  it("neemt de meest recente eigen activiteit", () => {
    const latest = new Date("2026-06-01T00:00:00Z");
    expect(
      lastActivityAt({
        duoCreatedAt: created,
        lastConfirmedMatchAt: new Date("2026-03-01T00:00:00Z"),
        lastChallengeSentAt: latest,
        lastChallengeAcceptedAt: null,
      }),
    ).toEqual(latest);
    expect(
      lastActivityAt({
        duoCreatedAt: created,
        lastConfirmedMatchAt: null,
        lastChallengeSentAt: null,
        lastChallengeAcceptedAt: null,
      }),
    ).toEqual(created);
  });

  it("is inactief pas strikt ná N dagen", () => {
    const last = new Date("2026-01-01T00:00:00Z");
    expect(isInactive(last, new Date("2026-03-02T00:00:00Z"), 60)).toBe(false); // precies 60 dagen
    expect(isInactive(last, new Date("2026-03-02T00:00:01Z"), 60)).toBe(true);
    expect(() => isInactive(last, last, -1)).toThrow(RangeError);
  });
});

describe("buildMatchHistory", () => {
  const duoA = { id: A, name: "Alfa" };
  const duoB = { id: B, name: "Bravo" };
  const duoC = { id: C, name: "Charlie" };

  it("combineert matches, voided matches en forfeits (nieuwste eerst) met gesommeerde rating-delta's", () => {
    const ratingRows: HistoryRatingRow[] = [
      { matchId: "m-1", challengeId: null, ratingBefore: 1200, ratingAfter: 1211, isForfeit: false, createdAt: new Date("2026-09-02"), challenge: null },
      // unplayed_timeout: penalty + correctie (overturned, schuld bij de ander)
      {
        matchId: null, challengeId: "c-f", ratingBefore: 1211, ratingAfter: 1201, isForfeit: true, createdAt: new Date("2026-09-10"),
        challenge: { id: "c-f", status: "UNPLAYED_TIMEOUT", challengerDuo: duoC, challengedDuo: duoA },
      },
      {
        matchId: null, challengeId: "c-f", ratingBefore: 1201, ratingAfter: 1211, isForfeit: true, createdAt: new Date("2026-09-12"),
        challenge: { id: "c-f", status: "UNPLAYED_TIMEOUT", challengerDuo: duoC, challengedDuo: duoA },
      },
    ];
    const entries = buildMatchHistory(
      A,
      [
        { matchId: "m-1", challengeId: "c-1", status: "COMPLETED", challengerDuo: duoB, challengedDuo: duoA, scoreRaw: "4-6,3-6", submittedAt: new Date("2026-09-01"), confirmedAt: new Date("2026-09-02") },
        { matchId: "m-0", challengeId: "c-2", status: "VOIDED", challengerDuo: duoA, challengedDuo: duoC, scoreRaw: "6-1,6-1", submittedAt: new Date("2026-09-05"), confirmedAt: null },
      ],
      ratingRows,
    );

    expect(entries.map((e) => e.kind)).toEqual(["forfeit", "voided", "match"]);

    const [forfeit, voided, played] = entries;
    expect(forfeit).toMatchObject({
      challengeId: "c-f",
      opponent: duoC,
      role: "challenged",
      ratingDelta: 0,
      isForfeit: true,
      forfeitReason: "unplayed_timeout",
      forfeitCorrected: true,
      result: null,
      score: null,
    });
    expect(forfeit.date).toEqual(new Date("2026-09-10"));

    expect(voided).toMatchObject({ result: null, ratingDelta: 0, score: "6-1,6-1", opponent: duoC });

    expect(played).toMatchObject({
      result: "W",
      role: "challenged",
      score: "6-4,6-3",
      ratingDelta: 11,
      opponent: duoB,
      gamesWon: 12,
      gamesLost: 7,
    });
  });

  it("labelt een expired-forfeit zonder correctie", () => {
    const entries = buildMatchHistory(A, [], [
      {
        matchId: null, challengeId: "c-e", ratingBefore: 1200, ratingAfter: 1190, isForfeit: true, createdAt: new Date("2026-09-10"),
        challenge: { id: "c-e", status: "EXPIRED", challengerDuo: duoB, challengedDuo: duoA },
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ forfeitReason: "expired", forfeitCorrected: false, ratingDelta: -10 });
  });
  it("labelt walkover en opgave vanuit het eigen duo, met de gespeelde stand bij opgave", () => {
    const entries = buildMatchHistory(
      A,
      [
        {
          matchId: "m-w", challengeId: "c-w", status: "COMPLETED", challengerDuo: duoA, challengedDuo: duoB,
          scoreRaw: "6-0,6-0", submittedAt: new Date("2026-09-01"), confirmedAt: new Date("2026-09-02"),
          resultType: "WALKOVER", concedingSide: "CHALLENGED", playedScoreRaw: null,
        },
        {
          matchId: "m-r", challengeId: "c-r", status: "COMPLETED", challengerDuo: duoC, challengedDuo: duoA,
          scoreRaw: "6-4,7-5,6-0", submittedAt: new Date("2026-09-05"), confirmedAt: new Date("2026-09-06"),
          resultType: "RETIRED", concedingSide: "CHALLENGED", playedScoreRaw: "6-4,5-5",
        },
        {
          matchId: "m-p", challengeId: "c-p", status: "COMPLETED", challengerDuo: duoA, challengedDuo: duoC,
          scoreRaw: "6-4,6-4", submittedAt: new Date("2026-09-08"), confirmedAt: new Date("2026-09-09"),
        },
      ],
      [],
    );
    const [played, retired, walkover] = entries;
    expect(played).toMatchObject({ resultType: "played", concededBy: null, playedScore: null });
    expect(retired).toMatchObject({ resultType: "retired", concededBy: "self", playedScore: "4-6,5-5", result: "L" });
    expect(walkover).toMatchObject({ resultType: "walkover", concededBy: "opponent", playedScore: null, result: "W" });
  });

  it("forfeits hebben geen uitslagsoort", () => {
    const entries = buildMatchHistory(A, [], [
      {
        matchId: null, challengeId: "c-e", ratingBefore: 1200, ratingAfter: 1190, isForfeit: true, createdAt: new Date("2026-09-10"),
        challenge: { id: "c-e", status: "EXPIRED", challengerDuo: duoB, challengedDuo: duoA },
      },
    ]);
    expect(entries[0]).toMatchObject({ resultType: null, concededBy: null, playedScore: null });
  });
});

describe("perspectiveScoreRaw", () => {
  it("draait de stand om voor de uitgedaagde en weigert onzin", () => {
    expect(perspectiveScoreRaw("6-4,3-2", "challenger")).toBe("6-4,3-2");
    expect(perspectiveScoreRaw("6-4,3-2", "challenged")).toBe("4-6,2-3");
    expect(perspectiveScoreRaw("6-4,x", "challenged")).toBeNull();
  });
});

describe("computeHeadToHead", () => {
  it("telt alleen matches tussen precies deze twee duo's, vanuit het eerste duo", () => {
    const m1 = match(A, B, "6-2,6-2", 1);
    const m2 = match(B, A, "6-4,6-4", 3);
    const m3 = match(A, C, "6-0,6-0", 4);
    const h2h = computeHeadToHead(A, B, [m1, m2, m3], [
      { duoId: A, matchId: m1.matchId, ratingBefore: 1200, ratingAfter: 1214 },
      { duoId: B, matchId: m1.matchId, ratingBefore: 1200, ratingAfter: 1186 },
    ]);
    expect(h2h).toMatchObject({
      matches: 2,
      wins: 1,
      losses: 1,
      setsWon: 2,
      setsLost: 2,
      gamesWon: 20,
      gamesLost: 16,
      setDifference: 0,
      gameDifference: 4,
    });
    expect(h2h.meetings.map((m) => m.matchId)).toEqual([m2.matchId, m1.matchId]);
    expect(h2h.meetings[0]).toMatchObject({ result: "L", role: "challenged", score: "4-6,4-6", ratingDelta: null });
    expect(h2h.meetings[1]).toMatchObject({ result: "W", ratingDelta: 14, opponentRatingDelta: -14 });
  });

  it("geeft een lege samenvatting zonder ontmoetingen", () => {
    expect(computeHeadToHead(A, B, [], [])).toMatchObject({ matches: 0, wins: 0, meetings: [] });
  });
});

describe("validatie", () => {
  const uuid1 = "11111111-1111-4111-8111-111111111111";
  const uuid2 = "22222222-2222-4222-8222-222222222222";

  it("head-to-head vereist twee verschillende uuid's", () => {
    expect(headToHeadParamsSchema.safeParse({ id: uuid1, otherId: uuid2 }).success).toBe(true);
    expect(headToHeadParamsSchema.safeParse({ id: uuid1, otherId: uuid1 }).success).toBe(false);
    expect(headToHeadParamsSchema.safeParse({ id: "x", otherId: uuid2 }).success).toBe(false);
  });

  it("historie-paginering heeft defaults en grenzen", () => {
    expect(matchHistoryQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(matchHistoryQuerySchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
    expect(matchHistoryQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(matchHistoryQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(matchHistoryQuerySchema.safeParse({ page: "abc" }).success).toBe(false);
  });
});
