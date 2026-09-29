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

- Elke spec gebruikt eigen seed-data (scripts/seed.ts); regio Zwolle (users 21–27) is voor 08–10. Nieuwe spec met nieuwe data? Voeg die toe aan de seed zonder bestaande specs te raken (Utrecht-ladder = precies 10 duo's).
- Pas op met `getByText` op statuswoorden ("Geaccepteerd", "Betwist"): die kunnen ook in badges/toasts staan (strict-mode-fout). Scope op de kaart (`li[data-group]`) of het `li`-item.
- De ladder heeft één `<tbody>` per tier: zoek in `table`, niet in `tbody`.
- Formulieren met eigen validatie hebben `noValidate`; test op de Nederlandse foutmelding.

## Draaien
- Volledig: `npm run test:e2e` (reset + seed testdatabase, start `dev:test` zelf).
- Eén bestand: `npm run db:test:reset && npx playwright test tests/e2e/04-disputes.spec.ts`.
- Zorg dat er niet al een server op :3100 draait (`reuseExistingServer: false`): `pkill -f "dev:test"` indien nodig.

- Timeouts: test 60s, assertions 15s, webServer-start 180s (on-demand compile in `next dev`). Een eerste bezoek aan een zware route kan traag zijn — dat is geen bug.
- Geheugen (8 GB): geen andere Next-servers of builds tegelijk. Crasht Chromium ("Target crashed"), stop andere servers; als noodgreep launch-args `--no-zygote --renderer-process-limit=1`.

## Bij falen
- Traces staan in `test-results/` (`trace: retain-on-failure`); bekijk met `npx playwright show-trace <pad>/trace.zip`.
- "Executable doesn't exist": `npx playwright install --with-deps chromium`.
- DB-fouten: check of de container `padel-ladder-db` draait (zie skill `dev-env`).
