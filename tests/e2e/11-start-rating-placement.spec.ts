import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Startrating & plaatsing (akkoord PO 2026-11-22, docs/Advies_Startrating.md).
// Eigen seed-data in regio Zwolle (users 28-37, duo's 14-18), door geen ander
// spec gebruikt:
// - Nieuw Talent (user28, 1200, 0 wedstrijden) → plaatsingsperiode;
//   Top Toppers (1420, tier 14) is uitdaagbaar, Te Ver Weg (1510, tier 15) niet.
// - Late Bloeiers (user32 speelsterkte 1 + user33) en Stille Kracht (user34
//   speelsterkte 5 + user35): ongespeeld, zonder challenges, op 1200.
test.describe("Startrating & plaatsing", () => {
  test("plaatsingsperiode: een nieuw duo daagt een duo twee tiers hoger uit", async ({ page }) => {
    await login(page, "user28@example.com");
    await page.goto("/ladder");
    await page.getByLabel("Regio").selectOption({ label: "Zwolle" });

    const panel = page.getByRole("region", { name: "Nieuw Talent" });
    await expect(panel).toContainText("Tier 12 t/m 14");
    await expect(panel).toContainText("Plaatsingsperiode: nog 10 wedstrijden");

    await expect(
      page.locator("tr", { hasText: "Te Ver Weg" }).getByRole("button", { name: "Uitdagen" }),
    ).toHaveCount(0);

    await page.locator("tr", { hasText: "Top Toppers" }).getByRole("button", { name: "Uitdagen" }).click();
    await expect(page.getByText("Uitdaging verstuurd aan Top Toppers.")).toBeVisible();
  });

  test("admin herberekent startratings van een regio op basis van de speelsterkte", async ({ page }) => {
    await login(page, "admin@example.com");
    await page.goto("/admin/start-ratings");
    await expect(page.getByRole("heading", { name: "Startratings", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Herberekenen voor Zwolle" }).click();
    await page.getByRole("button", { name: "Ja, herberekenen" }).click();

    const status = page.getByRole("status").filter({ hasText: "Zwolle" });
    await expect(status).toContainText("2 startratings bijgewerkt");
    // Elif Stil: speelsterkte 5 → 1200 + 200 (plafond ongeverifieerd); gemiddeld met 1200.
    await expect(status).toContainText("Stille Kracht: 1200 → 1300");
    // Wilma Sterk: speelsterkte 1, nog niet geverifieerd → ook begrensd op +200.
    await expect(status).toContainText("Late Bloeiers: 1200 → 1300");
  });

  test("speler vraagt verificatie aan → admin verifieert → hogere startrating", async ({ browser }) => {
    const playerCtx = await browser.newContext();
    const adminCtx = await browser.newContext();
    const player = await playerCtx.newPage();
    const admin = await adminCtx.newPage();

    await login(player, "user32@example.com");
    await player.goto("/profile");
    await player.getByRole("button", { name: "Speelsterkte laten verifiëren" }).click();
    await expect(player.getByText("Verificatie aangevraagd. Een beheerder vraagt je per e-mail")).toBeVisible();

    await login(admin, "admin@example.com");
    await admin.goto("/admin/start-ratings");
    const request = admin.locator("li", { hasText: "user32@example.com" });
    await expect(request).toContainText("Speelsterkte 1");
    await request.getByRole("button", { name: "Verifiëren" }).click();
    await admin.getByRole("button", { name: "Ja, verifiëren" }).click();

    // Geverifieerd: plafond +400 → (1600 + 1200) / 2.
    await expect(admin.getByRole("status").filter({ hasText: "Wilma Sterk" })).toContainText(
      "Late Bloeiers: 1300 → 1400",
    );
    await expect(admin.locator("li", { hasText: "user32@example.com" })).toHaveCount(0);

    await player.reload();
    await expect(player.getByText("Speelsterkte geverifieerd")).toBeVisible();

    await playerCtx.close();
    await adminCtx.close();
  });
});
