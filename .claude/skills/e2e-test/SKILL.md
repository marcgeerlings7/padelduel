---
name: e2e-test
description: Schrijf of draai Playwright e2e-tests voor een user-facing flow volgens de projectconventies (tests/e2e, aparte testdatabase op poort 3100, mobile viewport). Gebruik bij nieuwe user-facing flows of als e2e-tests falen.
---

# Playwright e2e-tests

## Conventies
- Tests staan in `tests/e2e/NN-onderwerp.spec.ts` (volgnummer doorzetten). Hergebruik `tests/e2e/helpers.ts` (login, seed-data) i.p.v. eigen setup.
- Draaien ALTIJD tegen `padel_ladder_test` op :3100 via `.env.test` — nooit tegen de dev-omgeving op :3000.
- `workers: 1`, gedeelde database: tests mogen niet afhankelijk zijn van volgorde tussen bestanden; maak eigen data aan waar nodig.
- Viewport is mobiel (390×844); selecteer bij voorkeur op role/label/tekst, niet op CSS-klassen.

## Draaien
- Volledig: `npm run test:e2e` (reset + seed testdatabase, start `dev:test` zelf).
- Eén bestand: `npm run db:test:reset && npx playwright test tests/e2e/04-disputes.spec.ts`.
- Zorg dat er niet al een server op :3100 draait (`reuseExistingServer: false`): `pkill -f "dev:test"` indien nodig.

## Bij falen
- Traces staan in `test-results/` (`trace: retain-on-failure`); bekijk met `npx playwright show-trace <pad>/trace.zip`.
- "Executable doesn't exist": `npx playwright install --with-deps chromium`.
- DB-fouten: check of de container `padel-ladder-db` draait (zie skill `dev-env`).
