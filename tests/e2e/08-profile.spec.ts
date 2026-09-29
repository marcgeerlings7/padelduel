import { test, expect } from "@playwright/test";
import { apiRequest, login } from "./helpers";

// user27 staat in de seed bewust zonder weergavenaam en zonder duo, en wordt
// door geen andere spec gebruikt.
test.describe("Spelersprofiel en e-mailvoorkeuren (KNLTB-aanvullingen)", () => {
  test("naam instellen via de melding, speelsterkte en e-mailvoorkeuren blijven bewaard", async ({ page }) => {
    await login(page, "user27@example.com");

    // Zonder naam vraagt het dashboard om er een in te stellen.
    const banner = page.getByRole("complementary", { name: "Stel je naam in" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Speler ");
    await banner.getByRole("link", { name: "Naam instellen" }).click();
    await page.waitForURL("**/profile");
    await expect(page.getByRole("heading", { name: "Profiel", level: 1 })).toBeVisible();
    await expect(page.getByText("Nog geen naam")).toBeVisible();

    // Een e-mailadres als naam wordt geweigerd (zelfde regel als de server).
    const nameInput = page.getByLabel("Weergavenaam");
    await nameInput.fill("zoe@example.com");
    await page.getByRole("button", { name: "Profiel opslaan" }).click();
    await expect(page.getByText("Je naam mag alleen letters, cijfers, spaties en . ' - _ bevatten.")).toBeVisible();

    await nameInput.fill("Zoë van Zwolle");
    await page.getByRole("combobox", { name: "KNLTB-speelsterkte" }).click();
    await page.getByRole("option", { name: "6", exact: true }).click();
    await expect(page.getByText("Zelf opgegeven, geen officiële KNLTB-rating.")).toBeVisible();
    await page.getByRole("button", { name: "Profiel opslaan" }).click();
    await expect(page.getByText("Profiel opgeslagen")).toBeVisible();
    await expect(page.getByRole("region", { name: "Zo zien andere spelers je" })).toContainText("Zoë van Zwolle");
    await expect(page.getByText("Nog geen naam")).toHaveCount(0);

    // E-mailvoorkeuren: zes schakelaars, standaard aan; uitzetten wordt direct bewaard.
    await expect(page.getByRole("switch")).toHaveCount(6);
    const challengeSwitch = page.getByRole("switch", { name: "Nieuwe uitdaging ontvangen" });
    await expect(challengeSwitch).toBeChecked();
    await challengeSwitch.click();
    await expect(page.getByText("E-mailmelding uitgezet")).toBeVisible();
    await expect(challengeSwitch).not.toBeChecked();

    // Na herladen staat alles er nog.
    await page.reload();
    await expect(page.getByLabel("Weergavenaam")).toHaveValue("Zoë van Zwolle");
    await expect(page.getByRole("combobox", { name: "KNLTB-speelsterkte" })).toContainText("6");
    await expect(page.getByRole("switch", { name: "Nieuwe uitdaging ontvangen" })).not.toBeChecked();
    await expect(page.getByRole("switch", { name: "Uitstelverzoeken en antwoorden daarop" })).toBeChecked();

    const profile = await apiRequest(page, "GET", "/api/me/profile");
    expect(profile.json).toMatchObject({ displayName: "Zoë van Zwolle", hasDisplayName: true, knltbLevel: 6 });
    const prefs = await apiRequest(page, "GET", "/api/me/notification-preferences");
    expect(prefs.json).toMatchObject({ preferences: { challengeReceived: false, postponement: true } });

    // De melding op het dashboard is weg, en "Profiel" staat in het Meer-menu.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Mijn duo's" })).toBeVisible();
    await expect(page.getByText("Je zit nog niet in een duo")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Stel je naam in" })).toHaveCount(0);
    await page.getByRole("button", { name: "Meer" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Profiel" }).click();
    await page.waitForURL("**/profile");
  });
});
