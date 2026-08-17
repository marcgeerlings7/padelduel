import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Bandeja Boys (users 13/14) en Vibora Vipers (users 15/16) zijn beide
// tier 11 in de seed-data (1160/1120) en worden door geen ander e2e-spec
// aangeraakt.
test.describe("Challenge → Match → ELO (Epic E/F)", () => {
  test("uitdagen (zelfde tier) → accepteren → score indienen → bevestigen → rating bijgewerkt", async ({
    browser,
  }) => {
    const ctx13 = await browser.newContext();
    const ctx15 = await browser.newContext();
    const page13 = await ctx13.newPage();
    const page15 = await ctx15.newPage();

    await login(page13, "user13@example.com"); // Bandeja Boys
    await login(page15, "user15@example.com"); // Vibora Vipers

    await page13.goto("/ladder");
    await page13.waitForTimeout(500);
    const actingSelect = page13.locator("select").nth(1);
    if (await actingSelect.count()) {
      await actingSelect.selectOption({ label: "Bandeja Boys" });
      await page13.waitForTimeout(300);
    }
    await page13
      .locator("tr", { hasText: "Vibora Vipers" })
      .getByRole("button", { name: "Uitdagen" })
      .click();
    await expect(page13.getByText("Uitdaging verstuurd")).toBeVisible();

    // Vibora Vipers accepteert
    await page15.goto("/dashboard");
    await page15
      .locator("section", { hasText: "Vibora Vipers" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    await page15.getByRole("button", { name: "Accepteren" }).click();
    await expect(page15.getByText("Geaccepteerd")).toBeVisible();

    // Bandeja Boys dient de score in: 6-4, 6-3 (winst)
    await page13.goto("/dashboard");
    await page13
      .locator("section", { hasText: "Bandeja Boys" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    const setInputs = page13.locator('input[type="number"]');
    await setInputs.nth(0).fill("6");
    await setInputs.nth(1).fill("4");
    await setInputs.nth(2).fill("6");
    await setInputs.nth(3).fill("3");
    await page13.getByRole("button", { name: "Score indienen" }).click();
    await expect(page13.getByText("Wacht op bevestiging")).toBeVisible();

    // Vibora Vipers bevestigt
    await page15.goto("/dashboard");
    await page15
      .locator("section", { hasText: "Vibora Vipers" })
      .getByRole("link", { name: "Challenges bekijken" })
      .click();
    await page15.getByRole("button", { name: "Bevestigen" }).click();
    await expect(page15.getByText("Voltooid")).toBeVisible();

    // Rating van Bandeja Boys (winnaar) is gestegen, terug te zien in de geschiedenis
    await page13.goto("/dashboard");
    const bandejaCard = page13.locator("section", { hasText: "Bandeja Boys" });
    await expect(bandejaCard).toContainText("rating 1"); // sanity: rating-tekst aanwezig
    await bandejaCard.getByRole("link", { name: "Ratinggeschiedenis" }).click();
    await expect(page13.getByText("Wedstrijdresultaat")).toBeVisible();
    const historyRow = page13.locator("tr", { hasText: "Wedstrijdresultaat" }).first();
    await expect(historyRow).toContainText("1160 → ");

    await ctx13.close();
    await ctx15.close();
  });
});
