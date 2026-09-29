# Padel Ladder

Een ranked ladder voor padel-duo's, los van verenigingen. Spelers vormen duo's (je kunt in meerdere duo's tegelijk zitten), dagen andere duo's uit binnen hun rating-tier, spelen de wedstrijd en klimmen of dalen via een ELO-rating die ook het gamesaldo meeweegt. Clubsystemen kunnen via een API zien wanneer duo's willen spelen.

**Live:** https://padelduel.vercel.app

## Functies

- **Ladder per regio:** positie en tier worden altijd uit de rating berekend. Per duo zie je W-V, reeks, betrouwbaarheid ("12/13 gespeeld") en of het duo inactief is.
- **Duo's:** een duo voorstellen met een zelfgekozen of verzonnen naam, uitnodigingen accepteren, een duo ontbinden met akkoord van beide spelers, en optioneel een speltype (heren/dames/gemengd). Een nieuw duo start op het gemiddelde van de andere duo's van zijn spelers.
- **Challenges en wedstrijden:**
  - uitdagen binnen de eigen tier, met deadlines om te reageren en om te spelen;
  - de uitslag invoeren (inclusief super-tiebreak), die de tegenstander bevestigt;
  - walkover en opgave volgens de KNLTB-regels;
  - uitstel alleen als beide duo's akkoord gaan.
- **ELO-rating:** de rating verschuift meer bij een grote overwinning en minder bij een krappe. Forfeits zijn altijd een vaste penalty buiten de formule. Zie [docs/ELO_Algoritme.md](docs/ELO_Algoritme.md).
- **Disputes:** een uitslag of forfeit betwisten; een admin beslist. Is een uitslag ongeldig verklaard, dan kan de wedstrijd opnieuw gespeeld worden.
- **Statistieken:** een ratinggrafiek met tiergrenzen, de wedstrijdhistorie, en per tegenstander het onderlinge resultaat met set- en gamesaldo.
- **Beschikbaarheid:** een snelkeuze per dagdeel of blokken met vrije tijden. De externe API (`/api/v1/availability`, met API-key) geeft alleen duo-naam, regio en tijdsblokken terug, nooit persoonsgegevens.
- **Profiel en e-mail:**
  - een weergavenaam en optioneel een zelf opgegeven KNLTB-speelsterkte;
  - herinneringen per e-mail (via Resend) die je per soort aan of uit zet.
- **Admin:** disputes afhandelen, API-clients beheren, de platformconfiguratie bekijken en gebruikers admin maken of die rechten intrekken.

Bewust niet gebouwd: chat, een social feed, club-administratie, baanreservering en advertenties ([PRD §4](docs/PRD_Padel_Ladder_App.md)).

## Stack

| Onderdeel | Keuze |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript |
| Data | Prisma 5, PostgreSQL (lokaal in Docker, productie op Neon) |
| UI | Design system "Court": Tailwind v4, shadcn/ui, Kokonut UI, Bklit UI (grafieken), Motion. Zie [docs/Design_System.md](docs/Design_System.md) |
| Tests | Vitest (unit), Playwright (e2e, mobiele viewport) |
| Hosting | Vercel, met Neon via de Vercel Marketplace |

## Lokaal ontwikkelen

### In GitHub Codespaces (aanbevolen)

Open de repo in een Codespace. [.devcontainer/start.sh](.devcontainer/start.sh) draait bij elke start en regelt:
- `.env` met nieuwe geheimen;
- de Postgres-container `padel-ladder-db` met de dev- en testdatabase;
- migraties, en demodata als de dev-database leeg is;
- de dev-server op http://localhost:3000;
- de Playwright-browser, de Claude Code CLI, graphify en de Vercel CLI.

Demo-accounts, allemaal met wachtwoord `PadelTest123!`:

| Account | Wat |
|---|---|
| `user1@example.com` … `user20@example.com` | spelers in regio Utrecht (user1 heeft een uitgebreid demoscenario) |
| `admin@example.com` | admin |

### Handmatig

Vereisten: Node 20 en Docker.

```bash
cp .env.example .env               # vul JWT_SECRET en JOBS_SECRET met willekeurige waarden
docker run -d --name padel-ladder-db -e POSTGRES_USER=padel -e POSTGRES_PASSWORD=padel \
  -e POSTGRES_DB=padel_ladder_dev -p 5432:5432 postgres:16-alpine
docker exec padel-ladder-db psql -U padel -d postgres -c "CREATE DATABASE padel_ladder_test"
npm ci
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Scripts

| Script | Wat het doet |
|---|---|
| `npm run dev` | dev-server op poort 3000 (dev-database) |
| `npm test` | unit-tests (Vitest) |
| `npm run test:e2e` | **reset de testdatabase**, daarna Playwright tegen een aparte server op poort 3100 |
| `npm run lint` | ESLint |
| `npm run build` | productie-build |
| `npm run db:seed` | demodata in de dev-database (idempotent, **nooit op productie**) |
| `npm run vercel-build` | wat Vercel draait: migraties (alleen bij productie) en de build |

## Tests

- **Unit-tests** in `tests/unit`, voor alle pure businesslogica (ELO, score, statistieken, validatie) en de services met een gemockte Prisma.
- **E2e-tests** in `tests/e2e`, één spec per gebruikersflow:

  | Spec | Flow |
  |---|---|
  | 01 | ladder |
  | 02 | duo-beheer |
  | 03 | challenge, wedstrijd en ELO |
  | 04 | disputes |
  | 05 | beschikbaarheid en de externe API |
  | 06 | registratie |
  | 07 | admin-gebruikers |
  | 08 | profiel |
  | 09 | walkover en opgave |
  | 10 | uitstel |

  De tests draaien tegen `padel_ladder_test` (`.env.test`), nooit tegen de dev-database.

## Productie (Vercel + Neon)

- **Deployen:** elke push naar `main` deployt automatisch. Bij productie-builds draait eerst `prisma migrate deploy`, via de directe Neon-verbinding (`DATABASE_URL_UNPOOLED`).
- **Env-variabelen in Vercel:**
  - `DATABASE_URL` en verwante `POSTGRES_*`/`PG*`-variabelen: gezet door de Neon-integratie;
  - `JWT_SECRET`;
  - `JOBS_SECRET` en `CRON_SECRET` (exact dezelfde waarde);
  - `APP_BASE_URL` = `https://padelduel.vercel.app`;
  - optioneel `RESEND_API_KEY` en `EMAIL_FROM`. Zonder die twee staan activatielinks in de Vercel-logs.
- **Achtergrondjobs** (verlopen challenges, auto-confirm, speelverplichting, herinneringen):
  - Vercel Cron één keer per dag; op het Hobby-plan mag een cron niet vaker draaien.
  - Daarnaast [een GitHub Actions-workflow](.github/workflows/hourly-jobs.yml) elk uur, met de repository-secrets `APP_URL` en `JOBS_SECRET`.
- **Lege omgeving inrichten:**
  ```bash
  npx tsx scripts/bootstrap-production.ts --region "Utrecht" --admin jij@example.com
  ```
  Gebruik als `DATABASE_URL` de directe productie-URL uit een tijdelijke `vercel env pull`. Zet die nooit in `.env.local`. Het account moet al geregistreerd en geactiveerd zijn.

## Documentatie

| Document | Inhoud |
|---|---|
| [CLAUDE.md](CLAUDE.md) | werkafspraken, ontwerpprincipes, sprintstatus en deploy-regels (ook voor Claude Code) |
| [docs/PRD_Padel_Ladder_App.md](docs/PRD_Padel_Ladder_App.md) | productvisie en scope |
| [docs/Sprint1–5_User_Stories.md](docs) | user stories en acceptatiecriteria per sprint |
| [docs/ELO_Algoritme.md](docs/ELO_Algoritme.md) | ratingformule, gamesaldo, idempotente verwerking |
| [docs/Database_Schema.sql](docs/Database_Schema.sql), [docs/ER_Diagram.mermaid](docs/ER_Diagram.mermaid) | datamodel |
| [docs/Design_System.md](docs/Design_System.md) | design system "Court": tokens, componenten, beweging |
| [docs/Technical_Debt.md](docs/Technical_Debt.md) | beslissingen, aannames en restrisico's per sprint |
| [docs/Claude_Code_Bouwplan.md](docs/Claude_Code_Bouwplan.md) | bouwplan en het sprint-reviewprotocol |
