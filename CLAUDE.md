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
Next.js + TypeScript + Prisma + PostgreSQL + Tailwind. Zie /docs voor schema en ER-diagram.

## Werkwijze
- Schrijf eerst een kort plan (2-5 stappen) voordat je code genereert bij een nieuwe feature.
- Schrijf unit tests voor alle pure business-logica (met name /src/lib/elo).
- Vanaf Sprint 4: voeg voor elke nieuwe user-facing flow ook een Playwright
  e2e-test toe in /tests/e2e (zie playwright.config.ts — draait tegen een
  aparte database op poort 3100, nooit tegen de dev-omgeving op poort 3000).
  `npm run test:e2e` reset die testdatabase eerst volledig.
- Gebruik de bestaande Prisma-modellen; wijzig het schema alleen na expliciete instructie.
- Volg per sprint het bijbehorende document (/docs/Sprint1_User_Stories.md t/m
  Sprint5_User_Stories.md) voor scope — bouw nooit vooruit op een latere sprint.
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

## Wat NIET bouwen (zie PRD §4)
Chat, social feed, club-administratie, fysieke baanreservering/boeking, advertenties.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
