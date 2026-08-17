import { Page, expect } from "@playwright/test";

export const SEED_PASSWORD = "PadelTest123!";

export async function login(page: Page, email: string, password = SEED_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([page.waitForURL("**/dashboard"), page.click('button[type="submit"]')]);
  await expect(page.getByRole("heading", { name: "Mijn duo's" })).toBeVisible();
}

/**
 * Roept een API-endpoint aan mét de Bearer-token van de ingelogde
 * gebruiker. `page.request` (Playwright's APIRequestContext) kent de
 * localStorage-token van de pagina niet — deze helper doet de fetch
 * daarom vanuit de pagina zelf (zoals de app het ook doet via apiFetch).
 */
export async function apiPost(
  page: Page,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  return page.evaluate(
    async ({ path, body }) => {
      const token = window.localStorage.getItem("padel_ladder_session_token");
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json().catch(() => null) };
    },
    { path, body },
  );
}
