import { test, expect, type Page } from "@playwright/test";
import { apiRequest, login } from "./helpers";

// Regio Zwolle (seed): challenge Rebote Rebels (25/26) vs. Lob Legends (21/22),
// geaccepteerd, speeldeadline over 5 dagen. Alleen deze spec gebruikt hem.
const CHALLENGE_ID = "00000000-0000-4000-8000-400000000008";
const DUO = {
  lobLegends: "00000000-0000-4000-8000-200000000011",
  reboteRebels: "00000000-0000-4000-8000-200000000013",
};
const DAY_MS = 24 * 60 * 60 * 1000;

type Overview = {
  matchDeadline: string | null;
  canRequest: boolean;
  remaining: number;
  pending: unknown;
};

async function overview(page: Page): Promise<Overview> {
  const res = await apiRequest(page, "GET", `/api/challenges/${CHALLENGE_ID}/postponement`);
  expect(res.status).toBe(200);
  return res.json as Overview;
}

async function openCard(page: Page, duoId: string, opponent: string) {
  await page.goto(`/duos/${duoId}/challenges`);
  const card = page.locator("li[data-group]", { hasText: `vs. ${opponent}` });
  await expect(card).toBeVisible();
  return card;
}

test.describe("Uitstel in onderling overleg (KNLTB-aanvullingen)", () => {
  test("Rebote Rebels vraagt 3 dagen uitstel → Lob Legends accepteert → deadline schuift precies 3 dagen op", async ({
    browser,
  }) => {
    const ctx25 = await browser.newContext();
    const ctx21 = await browser.newContext();
    const page25 = await ctx25.newPage();
    const page21 = await ctx21.newPage();
    await login(page25, "user25@example.com"); // Rebote Rebels
    await login(page21, "user21@example.com"); // Lob Legends

    const before = await overview(page25);
    expect(before.canRequest).toBe(true);
    expect(before.matchDeadline).not.toBeNull();

    // Rebote Rebels vraagt uitstel aan.
    let card = await openCard(page25, DUO.reboteRebels, "Lob Legends");
    await card.getByRole("button", { name: "Uitstel vragen" }).click();
    const sheet = page25.getByRole("dialog", { name: "Uitstel vragen aan Lob Legends" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radiogroup", { name: "Aantal dagen uitstel" }).getByRole("radio", { name: "3 dagen" }).click();
    await sheet.getByLabel("Reden (optioneel)").fill("Blessure aan de pols");
    await sheet.getByRole("button", { name: "Vraag uitstel aan" }).click();
    await expect(page25.getByText("Uitstel gevraagd")).toBeVisible();

    card = page25.locator("li[data-group]", { hasText: "vs. Lob Legends" });
    await expect(card.getByText("Jullie vroegen 3 dagen uitstel")).toBeVisible();
    // De aanvrager kan zijn eigen verzoek niet accepteren, wel intrekken.
    await expect(card.getByRole("button", { name: "Uitstel accepteren" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Verzoek intrekken" })).toBeVisible();

    // Lob Legends ziet het verzoek met reden en accepteert.
    card = await openCard(page21, DUO.lobLegends, "Rebote Rebels");
    await expect(card.getByText("Rebote Rebels vraagt 3 dagen uitstel")).toBeVisible();
    await expect(card.getByText("Blessure aan de pols")).toBeVisible();
    await card.getByRole("button", { name: "Uitstel accepteren" }).click();

    const historyItem = card.locator("li", { hasText: "Rebote Rebels: 3 dagen" });
    await expect(historyItem).toBeVisible();
    await expect(historyItem).toContainText("Speeldeadline verschoven naar");

    // De speeldeadline is exact 3 dagen opgeschoven en het maximum (1) is bereikt.
    const after = await overview(page21);
    expect(after.pending).toBeNull();
    expect(after.canRequest).toBe(false);
    expect(after.remaining).toBe(0);
    const shift = new Date(after.matchDeadline!).getTime() - new Date(before.matchDeadline!).getTime();
    expect(shift).toBe(3 * DAY_MS);

    await ctx25.close();
    await ctx21.close();
  });
});
