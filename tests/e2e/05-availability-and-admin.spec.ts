import { test, expect } from "@playwright/test";
import { login, apiPost } from "./helpers";

// Drop Shot Dynamo (users 11/12) wordt door geen ander e2e-spec aangeraakt.
test.describe("Beschikbaarheid & externe API (Epic H)", () => {
  test("duo geeft beschikbaarheid door, admin beheert een API-client die het terugziet", async ({
    browser,
  }) => {
    const ctx11 = await browser.newContext();
    const ctxAdmin = await browser.newContext();
    const page11 = await ctx11.newPage();
    const pageAdmin = await ctxAdmin.newPage();

    await login(page11, "user11@example.com"); // Drop Shot Dynamo
    await login(pageAdmin, "admin@example.com");

    // Beschikbaarheid doorgeven
    await page11.goto("/dashboard");
    await page11
      .locator("section", { hasText: "Drop Shot Dynamo" })
      .getByRole("link", { name: "Beschikbaarheid" })
      .click();
    const cell = page11.getByRole("button", { name: "Dinsdag Avond" });
    await cell.click();
    await expect(cell).toHaveText("Beschikbaar");

    // Admin maakt een API-client aan
    await pageAdmin.goto("/admin/api-clients");
    await pageAdmin.fill('input[type="text"]', "Test Club E2E");
    await pageAdmin.getByRole("button", { name: "Aanmaken" }).click();
    await expect(pageAdmin.getByText("Nieuwe API-key")).toBeVisible();
    const apiKey = await pageAdmin.locator("code").innerText();
    expect(apiKey).toMatch(/^padel_live_/);

    // De externe API geeft de zojuist doorgegeven beschikbaarheid terug,
    // zonder persoonsgegevens.
    const response = await pageAdmin.request.get("/api/v1/availability", {
      headers: { "x-api-key": apiKey },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.availability).toContainEqual(
      expect.objectContaining({ duoName: "Drop Shot Dynamo", region: "Utrecht", dayOfWeek: 1 }),
    );
    const rawBody = JSON.stringify(body);
    expect(rawBody).not.toContain("@example.com");

    // Admin trekt de client in; de key werkt daarna niet meer
    await pageAdmin.getByRole("button", { name: "Intrekken" }).click();
    await expect(pageAdmin.getByText("ingetrokken")).toBeVisible();
    const afterRevoke = await pageAdmin.request.get("/api/v1/availability", {
      headers: { "x-api-key": apiKey },
    });
    expect(afterRevoke.status()).toBe(401);

    // Opruimen: het toegevoegde tijdsblok weer verwijderen (toggle terug uit)
    await page11.reload();
    await page11.getByRole("button", { name: "Dinsdag Avond" }).click();
    await expect(page11.getByText("Nog geen beschikbaarheid doorgegeven.")).toBeVisible();

    await ctx11.close();
    await ctxAdmin.close();
  });
});
