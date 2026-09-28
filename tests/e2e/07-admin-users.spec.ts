import { test, expect } from "@playwright/test";
import { login, apiRequest } from "./helpers";

// user20 zit in geen enkel seed-duo en wordt door geen ander e2e-spec gebruikt.
test.describe("Admin: gebruikersbeheer (post-v1)", () => {
  test("admin promoveert en degradeert een gebruiker; de laatste admin kan zichzelf niet degraderen", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const ctxAdmin = await browser.newContext();
    const ctx20 = await browser.newContext();
    const pageAdmin = await ctxAdmin.newPage();
    const page20 = await ctx20.newPage();

    await login(pageAdmin, "admin@example.com");

    // Zoeken + promoveren
    await pageAdmin.goto("/admin/users");
    await pageAdmin.getByLabel("Zoeken op e-mailadres").fill("user20@");
    await pageAdmin.getByRole("button", { name: "Zoeken" }).click();
    const row20 = pageAdmin.locator("tr", { hasText: "user20@example.com" });
    await expect(row20).toHaveCount(1);
    await expect(row20).toContainText("Speler");
    await row20.getByRole("button", { name: "Maak admin" }).click();
    await expect(row20).toContainText("Admin");
    await expect(row20.getByRole("button", { name: "Admin-rechten intrekken" })).toBeVisible();

    // De gepromoveerde gebruiker heeft na inloggen toegang tot de admin-API
    await login(page20, "user20@example.com");
    const asAdmin = await apiRequest(page20, "GET", "/api/admin/users");
    expect(asAdmin.status).toBe(200);

    // Degraderen werkt direct, ook voor een nog geldig token met ADMIN-rol
    await row20.getByRole("button", { name: "Admin-rechten intrekken" }).click();
    await expect(row20).toContainText("Speler");
    const afterDemote = await apiRequest(page20, "GET", "/api/admin/users");
    expect(afterDemote.status).toBe(403);

    // De enige overgebleven admin kan zichzelf niet degraderen
    await pageAdmin.getByLabel("Zoeken op e-mailadres").fill("");
    await pageAdmin.getByRole("button", { name: "Zoeken" }).click();
    const adminRow = pageAdmin.locator("tr", { hasText: "admin@example.com" });
    await adminRow.getByRole("button", { name: "Admin-rechten intrekken" }).click();
    await expect(pageAdmin.getByText("Je bent de laatste admin")).toBeVisible();
    await expect(adminRow).toContainText("Admin");

    await ctxAdmin.close();
    await ctx20.close();
  });

  test("een gewone gebruiker krijgt geen toegang tot de gebruikers-API", async ({ page }) => {
    await login(page, "user19@example.com");
    const list = await apiRequest(page, "GET", "/api/admin/users");
    expect(list.status).toBe(403);
    const promote = await apiRequest(
      page,
      "PATCH",
      "/api/admin/users/00000000-0000-4000-8000-100000000019/role",
      { role: "ADMIN" },
    );
    expect(promote.status).toBe(403);
  });
});
