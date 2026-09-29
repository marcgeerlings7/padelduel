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
  // Dev-server compileert routes on-demand; met de UI-kit (Tailwind v4,
  // shadcn, Motion, charts) duurt een eerste compile soms >30s.
  timeout: 60_000,
  // Assertions wachten langer dan de standaard 5s: de eerste bezoek aan een
  // route/API compileert on-demand in de dev-server.
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    viewport: { width: 390, height: 844 }, // mobile-first, conform CLAUDE.md
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Na de spread: anders overschrijft "Desktop Chrome" (1280×720) de
        // mobile-first viewport uit `use` hierboven.
        viewport: { width: 390, height: 844 },
        // De devcontainer heeft maar 64 MB /dev/shm; Chromium crasht daardoor
        // sporadisch ("Target crashed") bij meerdere gelijktijdige contexts.
        launchOptions: { args: ["--disable-dev-shm-usage"] },
      },
    },
  ],
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000, // eerste compile van de dev-server kan onder load traag zijn
  },
});
