# Padel Ladder App — Projectinstructies voor Claude Code

## Wat dit project is
Zie /docs/PRD_Padel_Ladder_App.md voor het volledige productoverzicht.
Dit is GEEN prototype — schrijf productiewaardige code: types overal,
input-validatie, transacties waar consistentie vereist is.

## Belangrijke ontwerpprincipes (niet afwijken zonder overleg)
- Ladderpositie ÉN rating-tier zijn altijd afgeleid (RANK()-query resp.
  floor(rating / tier_size)), nooit een los opgeslagen veld.
- Matchverwerking is idempotent en transactioneel (zie /docs/ELO_Algoritme.md §5).
- Een gebruiker mag lid zijn van MEERDERE actieve duo's tegelijk, tot het
  configureerbare maximum in `platform_config.max_active_duos_per_user`
  (afgedwongen via trigger, zie /docs/Database_Schema.sql). Dit is GEEN
  "1 actief duo per user"-regel meer.
- Hetzelfde koppel (dezelfde 2 users) kan nooit twee actieve duo's samen
  hebben (`member_pair_key`, unique index).
- Forfeit-penalty's (expired/unplayed_timeout) lopen NOOIT via de
  ELO-formule — altijd een vaste, configureerbare penalty, apart
  gelabeld met `is_forfeit = true` in RatingHistory.
- Alle tunable parameters (tier_size, max_active_duos, deadlines,
  forfeit_penalty, cooldowns) staan in de `platform_config`-tabel,
  nooit hardcoded op meerdere plekken.
- De externe availability-API deelt nooit persoonsgegevens (geen e-mail,
  geen user-id's) — alleen duo-naam, regio en tijdsblokken.

## Stack
- **Next.js 14.2 (App Router) + React 18 + TypeScript** — bewust NIET upgraden naar
  Next 15 / React 19 zonder overleg (shadcn-componenten zijn naar React 18
  `forwardRef` omgezet, zie docs/Design_System.md §9).
- **Prisma 5 + PostgreSQL** (lokaal Docker-container `padel-ladder-db`, productie
  Neon via Vercel). Schema/ER-diagram: /docs/Database_Schema.sql, /docs/ER_Diagram.mermaid.
- **UI: design system "Court"** — Tailwind v4 (CSS-first, geen tailwind.config) +
  shadcn/ui + Kokonut UI + Bklit UI (charts) + Motion (`motion/react`). Briefing:
  /docs/Design_System.md; levende catalogus `/design` (alleen in `npm run dev`).
- Tests: Vitest (unit, `tests/unit`) en Playwright (e2e, `tests/e2e`).

## UI-regels
- Nieuwe UI gebruikt uitsluitend de Court-kit (`src/components/ui`, `src/components/app`)
  en wordt in `<Page>` gewikkeld (licht/donker thema). Geen legacy-klassen
  (`.btn`, `.card`, …) of losse kleuren; mobiel eerst (390×844).
- Ontbrekende primitives/blokken toevoegen **via de shadcn-registry**
  (`npx shadcn@latest add …`, `@kokonutui/…`, `@bklit/…`, of de shadcn-MCP), niet
  zelf uitschrijven; daarna de fix-ups uit Design_System.md toepassen.
- Inhoud nooit alleen via scroll-animaties (whileInView) zichtbaar maken; respecteer reduced motion.
- Toon andere spelers altijd met hun weergavenaam (`publicDisplayName`), nooit met e-mailadres.

## Werkwijze
- **Altijd eerst graphify raadplegen** bij vragen over de codebase of vóór het
  zoeken/lezen van bronbestanden: `graphify query "<vraag>"`, `graphify explain
  "<concept>"` of `graphify path "<A>" "<B>"` (graph in graphify-out/, gitignored).
  Pas daarna gericht grep/lezen voor de exacte regels. De graph wordt automatisch
  bijgewerkt via git-hooks (post-commit/post-checkout) en bij Codespace-start;
  na grote ongecommitte wijzigingen: `graphify update .`. Subagents krijgen deze
  instructie expliciet mee (in worktrees eerst `graphify update .`).
- Schrijf eerst een kort plan (2-5 stappen) voordat je code genereert bij een nieuwe feature.
- Schrijf unit tests voor alle pure business-logica (met name /src/lib/elo).
- Vanaf Sprint 4: voeg voor elke nieuwe user-facing flow ook een Playwright
  e2e-test toe in /tests/e2e (zie playwright.config.ts — draait tegen een
  aparte database op poort 3100, nooit tegen de dev-omgeving op poort 3000).
  `npm run test:e2e` reset die testdatabase eerst volledig. Nieuwe specs gebruiken
  eigen seed-data (zie scripts/seed.ts: regio Zwolle is voor e2e 08–10) zodat
  specs elkaar niet beïnvloeden; selecteer op rol/label/tekst, niet op stylingklassen.
- Gebruik de bestaande Prisma-modellen; wijzig het schema alleen na expliciete instructie.
  Een al toegepaste migratie wordt nooit achteraf gewijzigd — altijd een nieuwe migratie
  (config-rijen voor `platform_config` ook via een (data-)migratie).
- Scope: Sprint 1–5 (/docs/Sprint1_User_Stories.md t/m Sprint5_User_Stories.md)
  plus de hieronder vastgelegde post-v1-akkoorden. Alles daarbuiten (bijv. seizoenen)
  pas bouwen na expliciet akkoord van de PO, en dat akkoord hier vastleggen.
- Ga NOOIT door naar de volgende sprint zonder expliciete goedkeuring van de PO.
  Sluit elke sprint af met een testrun + sprint-review-samenvatting (zie
  Claude_Code_Bouwplan.md §8) en wacht op akkoord.

## Sprint-status (bijwerken na elke afgeronde sprint)
- Sprint 1 (Auth, multi-duo, ladder) + ELO-prep: afgerond op 2026-07-26, akkoord PO.
  Zie /docs/Technical_Debt.md voor openstaande risico's/aannames/technical debt.
  Schema-aanvullingen t.o.v. Database_Schema.sql: tabel `duo_invitation`,
  kolom `duo.dissolution_requested_by_user_id` (beide in overleg/gemeld).
- Sprint 2 (Challenges met rank-tiers): afgerond op 2026-07-26, akkoord PO.
  Zie /docs/Technical_Debt.md ("Na Sprint 2") voor aannames/openstaande punten.
- Sprint 3 (Matches, ELO, speelverplichting): afgerond op 2026-07-29, akkoord PO.
  Zie /docs/Technical_Debt.md ("Na Sprint 3") voor aannames/openstaande punten.
- Sprint 4 (Disputes): afgerond op 2026-08-03, akkoord PO.
  Zie /docs/Technical_Debt.md ("Na Sprint 4") voor aannames/openstaande punten.
  Schema-aanvulling t.o.v. Database_Schema.sql: unieke index
  RatingHistory(duo_id, challenge_id) vervangen door een gewone index
  (in overleg, nodig voor dispute-correcties).
- Sprint 5 (Beschikbaarheid & externe API): afgerond op 2026-09-28, akkoord PO.
  Volledige v1-scope (Sprint 1–5) is compleet.
- Post-v1 (akkoord PO 2026-09-28): (1) vrije tijden/bewerken in beschikbaarheids-UI,
  (2) e-mail via Resend (fallback console), (3) admin-promotie-UI + rate limiting
  via Postgres, (4) "opnieuw spelen" na overturned dispute — schemawijziging
  op match.challenge_id expliciet goedgekeurd, (5) volledig nieuw design op
  Tailwind v4 + shadcn + Kokonut UI + Bklit UI + Motion (vervangt het
  Modernist-design system), (6) gap-analyse t.o.v. KNLTB-padel.
- KNLTB-aanvullingen (akkoord PO 2026-09-28, incl. benodigde schemawijzigingen):
  wedstrijdhistorie + onderling resultaat + W-L/reeks + betrouwbaarheid +
  inactief-markering (afgeleid); e-mailherinneringen met afmeldvoorkeuren;
  walkover/opgave als uitslag + uitstel met wederzijds akkoord; spelersprofiel
  (naam, optionele speelsterkte/categorie) + startrating nieuw duo uit
  bestaande duo-ratings; gamesaldo in de ELO-formule (forfeits blijven
  buiten de formule). NIET: seizoenen (bewust uitgesteld).
- Post-v1 + KNLTB-aanvullingen + Court-redesign: gebouwd, gemerged en live op
  2026-09-29 (498 unit tests, 16 e2e-specs groen). Details, beslissingen en
  restrisico's: /docs/Technical_Debt.md (secties "Post-v1", "KNLTB-aanvullingen",
  "Integratie-UI", "Vercel-deploy"). Openstaande PO-keuzes: overzicht van
  API-clients die de rate limit overschrijden, bevestigingsstap bij het afhandelen
  van disputes, Resend-domein koppelen, `/websitedesign` verwijderen.

## Productie & deploy
- Live op **https://padelduel.vercel.app** (publiek domein). De
  `*-projects.vercel.app`-team-URL's zitten achter Vercel Authentication — nooit
  gebruiken als `APP_BASE_URL`/`APP_URL`.
- Elke push naar `main` deployt automatisch. `npm run vercel-build` draait
  `prisma migrate deploy` **alleen bij `VERCEL_ENV=production`**, via
  `DATABASE_URL_UNPOOLED` (directe Neon-verbinding); de app gebruikt runtime
  `POSTGRES_PRISMA_URL` (pooler) als die bestaat (src/lib/prisma.ts).
- Env-vars staan in Vercel (`vercel env ls`), nooit in de repo. Productiedata
  alleen via `vercel env pull --environment=production <tijdelijk bestand>` —
  nooit naar `.env.local` (die heeft voorrang op `.env` in `next dev`).
- `scripts/seed.ts` NOOIT tegen productie. Lege omgeving inrichten:
  `scripts/bootstrap-production.ts --region "<naam>" --admin <email>`.
- Achtergrondjobs (`/api/jobs/run-all`): Vercel Cron dagelijks (Hobby-limiet: een
  uurlijkse cron laat de hele deploy falen!) + `.github/workflows/hourly-jobs.yml`
  elk uur (secrets `APP_URL`, `JOBS_SECRET`).
- Route handlers zonder request-afhankelijkheid legt Next 14 bij de build statisch
  vast — database-GET's krijgen `export const dynamic = "force-dynamic"`.

## Omgeving & tooling
- Codespace: `.devcontainer/start.sh` (bij elke start, idempotent) regelt `.env`,
  Postgres-container, migraties, seed (alleen lege dev-db), dev-server, Playwright
  Chromium, Claude Code CLI, graphify (+ git-hooks) en Vercel CLI.
- Beperkt geheugen (8 GB / 2 cores): draai hooguit één Next-server tegelijk naast
  de e2e-run; parallelle agents mogen geen e2e draaien (gedeelde testdatabase).
- Project-skills in `.claude/skills` (o.a. `sprint-review`, `e2e-test`, `dev-env`,
  `frontend-design`, `web-design-guidelines`, `vercel-*`, `neon-postgres`, graphify);
  MCP-servers in `.mcp.json` (Vercel, shadcn).
- Reset NOOIT `padel_ladder_dev` zonder toestemming (handmatige testdata van de PO).

## Wat NIET bouwen (zie PRD §4)
Chat, social feed, club-administratie, fysieke baanreservering/boeking, advertenties.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
