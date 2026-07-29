import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-tests draaien tegen een APARTE database/poort (padel_ladder_test op
 * :3100), zodat ze nooit de dev-database op :3000 aanraken die de
 * gebruiker zelf handmatig bekijkt. `npm run test:e2e` reset+seedt eerst
 * de test-database (zie package.json), daarna start Playwright zelf de
 * server hieronder.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1, // gedeelde test-database: sequentieel om data-races te voorkomen
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    viewport: { width: 390, height: 844 }, // mobile-first, conform CLAUDE.md
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
