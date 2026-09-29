import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// Regio Zwolle (seed): Lob Legends (users 21/22), Pared Pirates (23/24) en
// Rebote Rebels (25/26) met geaccepteerde, nog niet gespeelde challenges.
// Alleen deze spec en 10-postponement gebruiken ze, elk met een eigen challenge:
// - Lob Legends vs. Pared Pirates    → walkover (hier)
// - Pared Pirates vs. Rebote Rebels  → opgave (hier)
// - Rebote Rebels vs. Lob Legends    → uitstel (10-postponement)
const DUO = {
  lobLegends: "00000000-0000-4000-8000-200000000011",
  paredPirates: "00000000-0000-4000-8000-200000000012",
  reboteRebels: "00000000-0000-4000-8000-200000000013",
};

/** De challengekaart tegen `opponent` op de challengespagina van het duo. */
async function openCard(page: Page, duoId: string, opponent: string) {
  await page.goto(`/duos/${duoId}/challenges`);
  const card = page.locator("li[data-group]", { hasText: `vs. ${opponent}` });
  await expect(card).toBeVisible();
  return card;
}

test.describe("Walkover en opgave (KNLTB-aanvullingen)", () => {
  test("walkover melden door het duo dat er was → tegenstander bevestigt → in de wedstrijdhistorie", async ({
    browser,
  }) => {
    const ctx21 = await browser.newContext();
    const ctx23 = await browser.newContext();
    const page21 = await ctx21.newPage();
    const page23 = await ctx23.newPage();
    await login(page21, "user21@example.com"); // Lob Legends
    await login(page23, "user23@example.com"); // Pared Pirates

    // Lob Legends: via het dashboard naar de challenges.
    await page21
      .locator("section", { hasText: "Lob Legends" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    let card = page21.locator("li[data-group]", { hasText: "vs. Pared Pirates" });
    await expect(card).toBeVisible();

    await card.getByRole("radio", { name: /^Walkover/ }).click();
    await expect(card.getByText("Alleen voor als jullie er wél waren en Pared Pirates niet kwam opdagen")).toBeVisible();
    await card.getByRole("button", { name: "Walkover melden" }).click();

    // Bevestigingsstap in een bottom sheet.
    const sheet = page21.getByRole("dialog", { name: "Walkover tegen Pared Pirates?" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Bevestig walkover" }).click();
    await expect(page21.getByText("Walkover gemeld")).toBeVisible();

    card = page21.locator("li[data-group]", { hasText: "vs. Pared Pirates" });
    await expect(card.getByText("Wacht op bevestiging")).toBeVisible();
    await expect(card.getByText("Walkover: Pared Pirates kwam niet opdagen. Telt als 6-0 6-0.")).toBeVisible();
    // Het indienende duo kan zijn eigen uitslag niet bevestigen of betwisten.
    await expect(card.getByRole("button", { name: "Bevestigen" })).toHaveCount(0);
    await expect(card.getByText("Jullie hebben deze uitslag ingevuld.")).toBeVisible();

    // Pared Pirates ziet de walkover en bevestigt.
    card = await openCard(page23, DUO.paredPirates, "Lob Legends");
    await expect(card.getByText("Walkover: jullie waren er niet. Telt als 0-6 0-6.")).toBeVisible();
    await card.getByRole("button", { name: "Bevestigen" }).click();
    await expect(card.getByText("Voltooid")).toBeVisible();
    await expect(card.getByText("Verloren")).toBeVisible();

    // Wedstrijdhistorie labelt de walkover.
    await page23.goto(`/duos/${DUO.paredPirates}/matches`);
    const row = page23.locator("li", { hasText: "Lob Legends" }).first();
    await expect(row).toContainText("Walkover (jullie afwezig)");

    await ctx21.close();
    await ctx23.close();
  });

  test("opgave invullen met gespeelde stand → validatie zoals de server → tegenstander bevestigt", async ({
    browser,
  }) => {
    const ctx23 = await browser.newContext();
    const ctx25 = await browser.newContext();
    const page23 = await ctx23.newPage();
    const page25 = await ctx25.newPage();
    await login(page23, "user23@example.com"); // Pared Pirates
    await login(page25, "user25@example.com"); // Rebote Rebels

    let card = await openCard(page23, DUO.paredPirates, "Rebote Rebels");
    await card.getByRole("radio", { name: /^Opgave/ }).click();
    await card.getByRole("radiogroup", { name: "Welk duo gaf op?" }).getByRole("radio", { name: "Rebote Rebels" }).click();

    const games = (set: number, duo: string) => card.getByLabel(`Opgave set ${set}: games ${duo}`, { exact: true });
    await games(1, "Pared Pirates").fill("6");
    await games(1, "Rebote Rebels").fill("4");
    await card.getByRole("button", { name: "Set toevoegen" }).click();

    // Een al beslist resultaat is geen opgave.
    await games(2, "Pared Pirates").fill("6");
    await games(2, "Rebote Rebels").fill("3");
    await expect(card.getByText("De opgegeven sets vormen al een volledige uitslag; dien een gewone uitslag in.")).toBeVisible();

    // Opgave bij 6-4 3-2: telt als 6-4 6-2.
    await games(2, "Pared Pirates").fill("3");
    await games(2, "Rebote Rebels").fill("2");
    await expect(card.getByText("Telt als winst voor Pared Pirates:")).toBeVisible();
    await expect(card.getByText("Uitslag 6-4, 6-2")).toBeAttached();
    await card.getByRole("button", { name: "Opgave indienen" }).click();
    await expect(page23.getByText("Opgave ingediend")).toBeVisible();

    card = page23.locator("li[data-group]", { hasText: "vs. Rebote Rebels" });
    await expect(card.getByText("Wacht op bevestiging")).toBeVisible();
    await expect(
      card.getByText("Opgave door Rebote Rebels bij 6-4 3-2. De rest van de wedstrijd telt als gewonnen."),
    ).toBeVisible();

    // Rebote Rebels ziet de opgave vanuit het eigen perspectief en bevestigt.
    card = await openCard(page25, DUO.reboteRebels, "Pared Pirates");
    await expect(
      card.getByText("Opgave door jullie bij 4-6 2-3. De rest van de wedstrijd telt als verloren."),
    ).toBeVisible();
    await card.getByRole("button", { name: "Bevestigen" }).click();
    await expect(card.getByText("Voltooid")).toBeVisible();

    await page25.goto(`/duos/${DUO.reboteRebels}/matches`);
    await expect(page25.locator("li", { hasText: "Pared Pirates" }).first()).toContainText("Opgave door jullie bij 4-6 2-3");

    await ctx23.close();
    await ctx25.close();
  });
});
