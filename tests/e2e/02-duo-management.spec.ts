import { test, expect } from "@playwright/test";
import { login, apiPost } from "./helpers";

// user17/user18 zitten in geen enkele seed-duo — veilig om in dit bestand
// te muteren zonder andere e2e-specs te beïnvloeden.
test.describe("Duo management (US-B1/B2/B3)", () => {
  test("voorstellen (met verzonnen naam) → accepteren → ontbinden (request + confirm)", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await login(pageA, "user17@example.com");
    await login(pageB, "user18@example.com");

    // A ziet de CTA om een duo te vormen (nog geen actief duo)
    await expect(pageA.getByText("Vorm een duo")).toBeVisible();
    await pageA.getByRole("link", { name: "Vorm een duo" }).click();
    await pageA.waitForURL("**/duos/propose");

    await pageA.getByRole("button", { name: "🎲 Verzin" }).click();
    const duoNameInput = pageA.locator('input[placeholder*="verzinnen"]');
    await expect(duoNameInput).not.toHaveValue("");
    const duoName = await duoNameInput.inputValue();
    await pageA.fill('input[type="email"]', "user18@example.com");
    await pageA.getByRole("button", { name: "Voorstel versturen" }).click();
    await expect(pageA.getByText("Voorstel verstuurd")).toBeVisible();

    // B accepteert
    await pageB.goto("/duos/invitations");
    await expect(pageB.locator("li", { hasText: duoName })).toBeVisible();
    await pageB.locator("li", { hasText: duoName }).getByRole("button", { name: "Accepteren" }).click();
    await expect(pageB.locator("li", { hasText: duoName })).toHaveCount(0);

    // Beide dashboards tonen het nieuwe duo
    await pageA.goto("/dashboard");
    await expect(pageA.locator("section", { hasText: duoName })).toBeVisible();
    await pageB.goto("/dashboard");
    await expect(pageB.locator("section", { hasText: duoName })).toBeVisible();

    // Ontbinden: A vraagt aan, kan niet zelf bevestigen, B bevestigt
    const duoCardA = pageA.locator("section", { hasText: duoName });
    const duoUrl = await duoCardA.getByRole("link", { name: "Challenges bekijken" }).getAttribute("href");
    const duoId = duoUrl?.split("/")[2];
    expect(duoId).toBeTruthy();

    const dissolveResponseA = await apiPost(pageA, `/api/duos/${duoId}/dissolve`);
    expect(dissolveResponseA.status).toBe(200);
    expect(dissolveResponseA.json).toMatchObject({ status: "requested" });

    const selfConfirmAttempt = await apiPost(pageA, `/api/duos/${duoId}/dissolve`);
    expect(selfConfirmAttempt.status).toBe(400);

    const dissolveResponseB = await apiPost(pageB, `/api/duos/${duoId}/dissolve`);
    expect(dissolveResponseB.status).toBe(200);
    expect(dissolveResponseB.json).toMatchObject({ status: "dissolved" });

    await pageA.goto("/dashboard");
    await expect(pageA.locator("section", { hasText: duoName })).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });
});
