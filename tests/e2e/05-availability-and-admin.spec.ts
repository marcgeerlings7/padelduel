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

  // Post-v1 (US-H1/H2): vrije tijden + bewerken, door beide duo-leden.
  test("duo-lid voegt een vrij tijdsblok toe, bewerkt het, en het andere lid verwijdert het", async ({ browser }) => {
    const DUO_AVAILABILITY = "/duos/00000000-0000-4000-8000-200000000006/availability"; // Drop Shot Dynamo
    const ctx11 = await browser.newContext();
    const ctx12 = await browser.newContext();
    const page11 = await ctx11.newPage();
    const page12 = await ctx12.newPage();
    await login(page11, "user11@example.com");
    await login(page12, "user12@example.com");

    // user12 voegt een vrij, niet-terugkerend blok toe
    await page12.goto(DUO_AVAILABILITY);
    const addForm = page12.locator("form", { has: page12.getByRole("button", { name: "Toevoegen" }) });
    await addForm.getByLabel("Dag").selectOption({ label: "Woensdag" });
    await addForm.getByLabel("Van").fill("19:30");
    await addForm.getByLabel("Tot").fill("21:15");
    await addForm.getByLabel("Vast terugkerend (elke week)").uncheck();
    await addForm.getByRole("button", { name: "Toevoegen" }).click();
    const created = page12.locator("li", { hasText: "Woensdag 19:30–21:15" });
    await expect(created).toBeVisible();
    await expect(created).toContainText("Niet vast terugkerend");

    // Ongeldige bewerking wordt geweigerd met een melding, geldige wordt opgeslagen
    await created.getByRole("button", { name: "Bewerken" }).click();
    const editForm = page12.locator("form", { has: page12.getByRole("button", { name: "Opslaan" }) });
    await editForm.getByLabel("Tot").fill("19:00");
    await editForm.getByRole("button", { name: "Opslaan" }).click();
    await expect(page12.getByText("De eindtijd moet na de begintijd liggen.")).toBeVisible();
    await editForm.getByLabel("Van").fill("20:00");
    await editForm.getByLabel("Tot").fill("22:00");
    await editForm.getByLabel("Vast terugkerend (elke week)").check();
    await editForm.getByRole("button", { name: "Opslaan" }).click();
    const edited = page12.locator("li", { hasText: "Woensdag 20:00–22:00" });
    await expect(edited).toBeVisible();
    await expect(edited).toContainText("Elke week");
    await expect(page12.locator("li", { hasText: "Woensdag 19:30–21:15" })).toHaveCount(0);

    // Het andere duo-lid ziet het bewerkte blok en verwijdert het
    await page11.goto(DUO_AVAILABILITY);
    const seenBy11 = page11.locator("li", { hasText: "Woensdag 20:00–22:00" });
    await expect(seenBy11).toBeVisible();
    await seenBy11.getByRole("button", { name: "Verwijderen" }).click();
    await expect(page11.getByText("Nog geen beschikbaarheid doorgegeven.")).toBeVisible();

    await ctx11.close();
    await ctx12.close();
  });
});
