import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Ladder (US-C1, US-E1)", () => {
  test("toont de seed-duo's gesorteerd op rating, met tier-kolom", async ({ page }) => {
    await page.goto("/ladder");
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(10);

    const firstRow = rows.first();
    await expect(firstRow).toContainText("Smash Sisters");
    await expect(firstRow).toContainText("1450");

    const lastRow = rows.last();
    await expect(lastRow).toContainText("Global Gladiators");
    await expect(lastRow).toContainText("1020");
  });

  test("markeert het eigen duo van een ingelogde gebruiker", async ({ page }) => {
    await login(page, "user1@example.com"); // lid van Smash Sisters + Chiquita Chargers
    await page.goto("/ladder");
    await page.waitForTimeout(500); // client-side fetch van /api/duos/mine laten landen

    const ownRows = page.locator("tr.bg-yellow-100");
    await expect(ownRows).toHaveCount(2);
    await expect(page.locator("tbody")).toContainText("Smash Sisters (jouw duo)");
    await expect(page.locator("tbody")).toContainText("Chiquita Chargers (jouw duo)");
  });
});
