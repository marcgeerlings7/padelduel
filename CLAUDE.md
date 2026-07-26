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
- Gebruik de bestaande Prisma-modellen; wijzig het schema alleen na expliciete instructie.
- Volg per sprint het bijbehorende document (/docs/Sprint1_User_Stories.md t/m
  Sprint5_User_Stories.md) voor scope — bouw nooit vooruit op een latere sprint.
- Ga NOOIT door naar de volgende sprint zonder expliciete goedkeuring van de PO.
  Sluit elke sprint af met een testrun + sprint-review-samenvatting (zie
  Claude_Code_Bouwplan.md §8) en wacht op akkoord.

## Sprint-status (bijwerken na elke afgeronde sprint)
- Sprint 1 (Auth, multi-duo, ladder): nog niet gestart
- Sprint 2 (Challenges met rank-tiers): nog niet gestart
- Sprint 3 (Matches, ELO, speelverplichting): nog niet gestart
- Sprint 4 (Disputes): nog niet gestart
- Sprint 5 (Beschikbaarheid & externe API): nog niet gestart

## Wat NIET bouwen (zie PRD §4)
Chat, social feed, club-administratie, fysieke baanreservering/boeking, advertenties.
