import { test, expect } from "@playwright/test";

// De activatie-e-mail wordt in dev alleen naar de serverconsole gelogd
// (src/lib/auth/email.ts) — het JWT-activatietoken is dus niet vanuit de
// browser op te halen. Deze e2e-test dekt daarom het volledige, wél
// end-to-end testbare deel (formuliervalidatie, registratie, opnieuw
// versturen, en de foutafhandeling van een ongeldige activatielink), maar
// niet de activatie zelf — dat wordt gedekt door authService.test.ts
// (unit) op de servicelaag.
test.describe("Registreren (US-A1)", () => {
  test("account aanmaken toont een bevestiging, met validatie en opnieuw-versturen", async ({ page }) => {
    await page.goto("/register");

    await page.fill('input[type="email"]', "newplayer@example.com");
    await page.fill('input[type="password"]', "zwak");
    await page.fill('input[type="password"] >> nth=1', "zwak");
    await page.getByRole("button", { name: "Account aanmaken" }).click();
    await expect(page.getByText("hoofdletter, kleine letter en een cijfer")).toBeVisible();

    await page.fill('input[type="password"] >> nth=0', "SterkWachtwoord1");
    await page.fill('input[type="password"] >> nth=1', "AndersWachtwoord2");
    await page.getByRole("button", { name: "Account aanmaken" }).click();
    await expect(page.getByText("De wachtwoorden komen niet overeen.")).toBeVisible();

    await page.fill('input[type="password"] >> nth=1', "SterkWachtwoord1");
    await page.getByRole("button", { name: "Account aanmaken" }).click();

    await expect(page.getByText("Controleer je e-mail")).toBeVisible();
    await expect(page.getByText("newplayer@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Activatielink opnieuw versturen" }).click();
    await expect(page.getByText("ontvang je een nieuwe activatielink")).toBeVisible();
  });

  test("activeren met een ongeldig token toont een foutmelding", async ({ page }) => {
    await page.goto("/activate?token=onzin-token");
    await expect(page.getByText("Activeren mislukt")).toBeVisible();
    await expect(page.getByRole("link", { name: "Nieuw account aanmaken" })).toBeVisible();
  });
});
