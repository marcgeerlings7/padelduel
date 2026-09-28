import { describe, it, expect } from "vitest";
import {
  buildNotificationEmail,
  escapeHtml,
  formatScoreRaw,
  type NotificationContent,
} from "@/lib/notifications/templates";
import { updateNotificationPreferencesSchema, PREFERENCE_FOR_KIND } from "@/lib/notifications/preferences";

const BASE = "https://padel.example.nl";
const deadline = new Date("2026-10-01T18:00:00Z");

const ALL_CONTENTS: NotificationContent[] = [
  { kind: "CHALLENGE_RECEIVED", challengerDuoName: "Net Ninjas", challengedDuoName: "Smash Sisters", responseDeadline: deadline },
  { kind: "CHALLENGE_RESPONSE_REMINDER", challengerDuoName: "Net Ninjas", challengedDuoName: "Smash Sisters", responseDeadline: deadline },
  { kind: "MATCH_DEADLINE_REMINDER", ownDuoName: "A", opponentDuoName: "B", matchDeadline: deadline },
  { kind: "SCORE_SUBMITTED", ownDuoName: "A", opponentDuoName: "B", scoreText: "A – B: 6-4 6-3", resultType: "played", autoConfirmDeadline: deadline },
  { kind: "AUTO_CONFIRM_REMINDER", ownDuoName: "A", opponentDuoName: "B", scoreText: "A – B: 0-6 0-6", resultType: "walkover", autoConfirmDeadline: deadline },
  { kind: "DISPUTE_RESOLVED", ownDuoName: "A", opponentDuoName: "B", subject: "match_score", resolution: "overturned", newMatchDeadline: deadline },
  { kind: "DISPUTE_RESOLVED", ownDuoName: "A", opponentDuoName: "B", subject: "forfeit", resolution: "upheld", newMatchDeadline: null },
  { kind: "POSTPONEMENT_REQUESTED", ownDuoName: "A", requestingDuoName: "B", requestedDays: 3, currentMatchDeadline: deadline, reason: "Blessure" },
  { kind: "POSTPONEMENT_ANSWERED", ownDuoName: "A", respondingDuoName: "B", accepted: true, newMatchDeadline: deadline },
  { kind: "POSTPONEMENT_ANSWERED", ownDuoName: "A", respondingDuoName: "B", accepted: false, newMatchDeadline: null },
];

describe("buildNotificationEmail", () => {
  it.each(ALL_CONTENTS.map((c) => [c.kind, c] as const))(
    "%s: tekst + HTML, begroeting, link naar de app en afmeldhint naar /profile",
    (_kind, content) => {
      const email = buildNotificationEmail("jan@example.com", "Jan", content, BASE);
      expect(email.to).toBe("jan@example.com");
      expect(email.subject).toMatch(/^Padel Ladder — /);
      expect(email.body).toContain("Hoi Jan,");
      expect(email.body).toContain(`${BASE}/challenges`);
      expect(email.body).toContain(`${BASE}/profile`);
      expect(email.html).toContain(`href="${BASE}/challenges"`);
      expect(email.html).toContain(`href="${BASE}/profile"`);
      // Nooit het e-mailadres van de ontvanger (of iemand anders) in de inhoud.
      expect(email.body).not.toContain("@");
      expect(email.html).not.toContain("jan@example.com");
    },
  );

  it("escapet gebruikersinvoer (duo-namen, redenen) in de HTML", () => {
    const email = buildNotificationEmail(
      "x@example.com",
      "Jan",
      {
        kind: "POSTPONEMENT_REQUESTED",
        ownDuoName: "<b>A</b>",
        requestingDuoName: "B & co",
        requestedDays: 2,
        currentMatchDeadline: deadline,
        reason: '<script>alert("x")</script>',
      },
      BASE,
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("B &amp; co");
    expect(email.body).toContain("<script>"); // platte tekst hoeft niet ge-escaped
  });

  it("toont de datum in Nederlandse tijd", () => {
    const email = buildNotificationEmail("x@example.com", "Jan", ALL_CONTENTS[0], BASE);
    expect(email.body).toContain("20:00"); // 18:00 UTC = 20:00 CEST
    expect(email.body).toMatch(/oktober/);
  });

  it("markeert walkover/opgave in de score-mail", () => {
    const email = buildNotificationEmail("x@example.com", "Jan", ALL_CONTENTS[4], BASE);
    expect(email.body).toContain("(walkover)");
  });
});

describe("helpers", () => {
  it("escapeHtml", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
  it("formatScoreRaw", () => {
    expect(formatScoreRaw("6-4,3-6,10-8")).toBe("6-4 3-6 10-8");
  });
});

describe("notificatievoorkeuren", () => {
  it("partiële update, strict, niet leeg", () => {
    expect(updateNotificationPreferencesSchema.safeParse({ challengeReceived: false }).success).toBe(true);
    expect(updateNotificationPreferencesSchema.safeParse({}).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({ marketing: true }).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({ challengeReceived: "nee" }).success).toBe(false);
  });

  it("score-bevestiging en auto-confirm-herinnering delen één toggle", () => {
    expect(PREFERENCE_FOR_KIND.SCORE_SUBMITTED).toBe("scoreConfirmation");
    expect(PREFERENCE_FOR_KIND.AUTO_CONFIRM_REMINDER).toBe("scoreConfirmation");
  });
});
