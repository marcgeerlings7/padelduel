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

    // Admin ziet de dispute en handhaaft de score
    await pageAdmin.goto("/admin/disputes");
    await expect(pageAdmin.getByText("Volley Vikings vs. Ace Avengers")).toBeVisible();
    await pageAdmin.getByRole("button", { name: "Score handhaven" }).click();
    await expect(pageAdmin.getByText("Geen openstaande disputes")).toBeVisible();

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
});
