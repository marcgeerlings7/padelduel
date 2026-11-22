import { test, expect } from "@playwright/test";
import { DEMO_PASSWORD } from "../../src/lib/region/demo";
import { login } from "./helpers";

// Demo-accounts (migratie 20261122140000_demo_accounts, verzoek PO 2026-11-22):
// demo1..demo5@example.com in de aparte regio "Demo". Alleen lezen, zodat de
// demo-data in deze spec niet verandert.

test.describe("Demo-accounts", () => {
  test("demo-speler logt in en ziet zijn duo's en de demoladder", async ({ page }) => {
    await login(page, "demo1@example.com", DEMO_PASSWORD);
    await expect(page.locator("section", { hasText: "Demo Smashers" }).first()).toBeVisible();
    await expect(page.locator("section", { hasText: "Demo Bandejas" }).first()).toBeVisible();

    await page.goto("/ladder");
    // Standaard de regio van het eigen duo, ook al staat "Demo" achteraan.
    await expect(page.getByLabel("Regio")).toHaveValue("demo");
    await expect(page.getByRole("region", { name: "Demo Smashers" })).toBeVisible();
    await expect(page.locator("tr", { hasText: "Demo Chiquitas" })).toBeVisible();
  });

  test("inlogpagina toont de demo-accounts en vult er één in met één klik", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Invullen met Demo Joris" }).click();
    await expect(page.getByLabel("E-mailadres")).toHaveValue("demo2@example.com");
    await Promise.all([page.waitForURL("**/dashboard"), page.getByRole("button", { name: "Inloggen" }).click()]);
    await expect(page.locator("section", { hasText: "Demo Viboras" }).first()).toBeVisible();
  });

  test("bezoekers zonder account zien standaard een echte regio, niet de demoregio", async ({ page }) => {
    await page.goto("/ladder");
    await expect(page.getByLabel("Regio")).toHaveValue("utrecht");
  });
});
