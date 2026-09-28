import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Volley Vikings (users 7/8) en Ace Avengers (users 9/10) zijn beide
// tier 12 in de seed-data en worden door geen ander e2e-spec aangeraakt.
test.describe("Disputes (Epic G)", () => {
  test("match-score betwisten → dispute openen → admin bevestigt score (upheld) → ELO alsnog verwerkt", async ({
    browser,
  }) => {
    test.setTimeout(60_000); // 3 actoren + meerdere rondes, standaard 30s is te krap
    const ctx7 = await browser.newContext();
    const ctx9 = await browser.newContext();
    const ctxAdmin = await browser.newContext();
    const page7 = await ctx7.newPage();
    const page9 = await ctx9.newPage();
    const pageAdmin = await ctxAdmin.newPage();

    await login(page7, "user7@example.com"); // Volley Vikings
    await login(page9, "user9@example.com"); // Ace Avengers
    await login(pageAdmin, "admin@example.com");

    // Uitdagen
    await page7.goto("/ladder");
    await page7.waitForTimeout(500);
    const actingSelect = page7.locator("select").nth(1);
    if (await actingSelect.count()) {
      await actingSelect.selectOption({ label: "Volley Vikings" });
      await page7.waitForTimeout(300);
    }
    await page7
      .locator("tr", { hasText: "Ace Avengers" })
      .getByRole("button", { name: "Uitdagen" })
      .click();
    await expect(page7.getByText("Uitdaging verstuurd")).toBeVisible();

    // Accepteren
    await page9.goto("/dashboard");
    await page9
      .locator("section", { hasText: "Ace Avengers" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    await page9.getByRole("button", { name: "Accepteren" }).click();
    await expect(page9.getByText("Geaccepteerd")).toBeVisible();

    // Score indienen (Volley Vikings "wint" volgens de indiener)
    await page7.goto("/dashboard");
    await page7
      .locator("section", { hasText: "Volley Vikings" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    const setInputs = page7.locator('input[type="number"]');
    await setInputs.nth(0).fill("6");
    await setInputs.nth(1).fill("4");
    await setInputs.nth(2).fill("6");
    await setInputs.nth(3).fill("3");
    await page7.getByRole("button", { name: "Score indienen" }).click();
    await expect(page7.getByText("Wacht op bevestiging")).toBeVisible();

    // Ace Avengers betwist de score i.p.v. te bevestigen
    await page9.goto("/dashboard");
    await page9
      .locator("section", { hasText: "Ace Avengers" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    await page9.getByRole("button", { name: "Betwisten" }).click();
    await expect(page9.getByText("Betwist")).toBeVisible();

    // Dispute openen met een reden
    await page9.locator("textarea").fill("De score klopt niet, wij hebben gewonnen.");
    await page9.getByRole("button", { name: "Dispute openen" }).click();
    await expect(page9.getByText("Dispute geopend")).toBeVisible();

    // Admin ziet de dispute en handhaaft de score. De seed-data bevat ook
    // een eigen open dispute (Smash Sisters vs. Baseline Bandits), dus
    // scopen we de actie op de kaart van déze dispute.
    await pageAdmin.goto("/admin/disputes");
    const disputeCard = pageAdmin.locator("li", { hasText: "Volley Vikings vs. Ace Avengers" });
    await expect(disputeCard).toBeVisible();
    await disputeCard.getByRole("button", { name: "Score handhaven" }).click();
    await expect(pageAdmin.getByText("Volley Vikings vs. Ace Avengers")).toHaveCount(0);

    // Match/challenge zijn nu voltooid, rating is bijgewerkt
    await page7.goto("/dashboard");
    await page7
      .locator("section", { hasText: "Volley Vikings" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    await expect(page7.getByText("Voltooid")).toBeVisible();

    await page7.goto("/dashboard");
    const volleyCard = page7.locator("section", { hasText: "Volley Vikings" });
    await Promise.all([
      page7.waitForURL("**/rating-history"),
      volleyCard.getByRole("link", { name: "Ratinggeschiedenis" }).click(),
    ]);
    await expect(page7.getByText("Wedstrijdresultaat")).toBeVisible({ timeout: 10_000 });

    await ctx7.close();
    await ctx9.close();
    await ctxAdmin.close();
  });

  // Post-v1 (akkoord PO 2026-09-28): na een overturned match-score-dispute
  // kan hetzelfde duo-paar opnieuw spelen en een nieuwe score indienen.
  // Gebruikt de seed-challenge Global Gladiators -> Chiquita Chargers
  // (PENDING, beide tier 10) die door geen ander spec geaccepteerd wordt.
  // Let op: dit wijzigt de rating van Global Gladiators; 01-ladder.spec.ts
  // (dat de onderste ladderrij controleert) draait in de volledige suite
  // eerder (alfabetische volgorde, workers: 1).
  test("match-score betwisten → admin verklaart ongeldig → opnieuw score indienen → bevestigen → ELO verwerkt", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const CHIQUITA = "/duos/00000000-0000-4000-8000-200000000009";
    const GLOBAL = "/duos/00000000-0000-4000-8000-200000000010";

    const ctx3 = await browser.newContext();
    const ctx5 = await browser.newContext();
    const ctxAdmin = await browser.newContext();
    const page3 = await ctx3.newPage();
    const page5 = await ctx5.newPage();
    const pageAdmin = await ctxAdmin.newPage();

    await login(page3, "user3@example.com"); // o.a. Chiquita Chargers (uitgedaagd)
    await login(page5, "user5@example.com"); // o.a. Global Gladiators (uitdager)
    await login(pageAdmin, "admin@example.com");

    // Chiquita Chargers accepteert de openstaande seed-challenge
    await page3.goto(`${CHIQUITA}/challenges`);
    await page3.getByRole("button", { name: "Accepteren" }).click();
    await expect(page3.getByText("Geaccepteerd")).toBeVisible();

    // Global Gladiators dient een score in
    await page5.goto(`${GLOBAL}/challenges`);
    let setInputs = page5.locator('input[type="number"]');
    await setInputs.nth(0).fill("6");
    await setInputs.nth(1).fill("4");
    await setInputs.nth(2).fill("6");
    await setInputs.nth(3).fill("3");
    await page5.getByRole("button", { name: "Score indienen" }).click();
    await expect(page5.getByText("Wacht op bevestiging")).toBeVisible();

    // Chiquita Chargers betwist en opent een dispute
    await page3.reload();
    await page3.getByRole("button", { name: "Betwisten" }).click();
    await expect(page3.getByText("Betwist")).toBeVisible();
    await page3.locator("textarea").fill("Deze wedstrijd is nooit volledig gespeeld.");
    await page3.getByRole("button", { name: "Dispute openen" }).click();
    await expect(page3.getByText("Dispute geopend")).toBeVisible();

    // Admin verklaart de match ongeldig (overturned)
    await pageAdmin.goto("/admin/disputes");
    const disputeCard = pageAdmin.locator("li", { hasText: "Global Gladiators vs. Chiquita Chargers" });
    await expect(disputeCard).toBeVisible();
    await disputeCard.getByRole("button", { name: "Match ongeldig verklaren" }).click();
    await expect(pageAdmin.getByText("Global Gladiators vs. Chiquita Chargers")).toHaveCount(0);

    // De challenge staat nog op geaccepteerd; er kan opnieuw een score in
    await page5.reload();
    await expect(page5.getByText("ongeldig verklaard door een admin")).toBeVisible();
    setInputs = page5.locator('input[type="number"]');
    await setInputs.nth(0).fill("6");
    await setInputs.nth(1).fill("2");
    await setInputs.nth(2).fill("6");
    await setInputs.nth(3).fill("2");
    await page5.getByRole("button", { name: "Score indienen" }).click();
    await expect(page5.getByText("Wacht op bevestiging")).toBeVisible();

    // Chiquita Chargers bevestigt de nieuwe score -> ELO-verwerking
    await page3.reload();
    await page3.getByRole("button", { name: "Bevestigen" }).click();
    await expect(
      page3.locator("li", { hasText: "vs. Global Gladiators" }).getByText("Voltooid"),
    ).toBeVisible();

    // Global Gladiators had nog geen rating-historie in de seed: de nieuwe
    // wedstrijdregel (vanaf 1020) bewijst dat de ELO-verwerking is gedaan.
    await page5.goto(`${GLOBAL}/rating-history`);
    const historyRow = page5.locator("tr", { hasText: "Wedstrijdresultaat" });
    await expect(historyRow).toHaveCount(1, { timeout: 10_000 });
    await expect(historyRow).toContainText("1020");

    await ctx3.close();
    await ctx5.close();
    await ctxAdmin.close();
  });
});
