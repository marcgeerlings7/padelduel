# Technical Debt, Aannames & Open Risico's

Dit document wordt bijgewerkt na elke sprint-review (zie `Claude_Code_Bouwplan.md` §8).
Items worden **niet** verwijderd zodra ze zijn opgelost — voeg een `Opgelost:`-regel toe met datum/sprint i.p.v. te verwijderen, zodat de historie navolgbaar blijft.

---

## Na Sprint 1 (incl. Fase 5 ELO-prep)

### Rate limiting is in-memory, per-instance
**Wat:** De login-rate-limiter (`src/lib/auth/rateLimit.ts`) houdt de telling in het geheugen van het proces bij.
**Risico:** Reset bij een herstart van de app; werkt niet correct zodra er meerdere app-instanties tegelijk draaien (elke instantie heeft zijn eigen telling).
**Wanneer relevant:** Zodra er meer dan 1 instantie draait (horizontale schaling) of bij frequente herstarts in productie.
**Mogelijke oplossing:** Vervangen door een gedeelde store (bijv. Redis) met dezelfde `checkRateLimit`/`recordFailedAttempt`/`resetRateLimit`-interface.

### E-mailverzending is een dev-console-stub
**Wat:** `src/lib/auth/email.ts` logt activatiemails naar de console i.p.v. ze echt te versturen.
**Risico:** Activatie-/resend-flow werkt niet voor echte gebruikers buiten dev/QA.
**Wanneer relevant:** Vóór een echte pilot-rollout (PRD §13).
**Mogelijke oplossing:** PRD §14 heeft dit als openstaande vraag (welke provider). `sendEmail()` is bewust als losse, vervangbare functie opgezet zodat alleen die implementatie hoeft te wijzigen.

### Eén sessietoken, geen refresh-tokens
**Wat:** Login geeft een enkel JWT (2 uur geldig) i.p.v. het in Bouwplan §2 genoemde access+refresh-tokenpaar.
**Risico:** Gebruikers moeten elke 2 uur opnieuw inloggen; geen manier om een sessie eerder in te trekken.
**Wanneer relevant:** Als gebruikerscomfort bij langere sessies een probleem wordt.
**Mogelijke oplossing:** Refresh-token-flow toevoegen aan `src/lib/auth/tokens.ts` + een `Session`-achtige opslag voor intrekbaarheid.

### Geen "minimum tijd tussen matches"-regel
**Wat:** ELO_Algoritme.md §6.3 noemt een minimum-tijd tussen wedstrijden van hetzelfde duo als anti-manipulatiemaatregel; dit is nog niet gebouwd.
**Risico:** Nog geen risico — er bestaan nog geen matches (dat begint in Sprint 3).
**Wanneer relevant:** Sprint 3 (Epic F, matches).
**Mogelijke oplossing:** Bij matchregistratie de tijd sinds de laatste match van dat duo controleren.

### Geen admin-UI voor regiobeheer
**Wat:** Regio's worden alleen via `scripts/seed.ts` aangemaakt, niet via een admin-scherm.
**Risico:** Geen — US-D1's acceptatiecriteria stond expliciet een "minimale, eventueel niet-UI interface" toe.
**Wanneer relevant:** Zodra een platform-admin zelf regio's moet kunnen toevoegen zonder code/seed-toegang.

### `prisma init`-incompatibiliteit met Node 24
**Wat:** Het kale `prisma init`-commando faalt op deze Prisma 5.22/Node 24-combinatie (`(0, CSe.isError) is not a function`). De daadwerkelijke workflow (`prisma migrate dev --create-only` + handmatige SQL + apply) werkt wél foutloos en is de bewezen aanpak in dit project.
**Risico:** Laag — alleen relevant als iemand opnieuw `prisma init` los aanroept.
**Mogelijke oplossing:** Prisma upgraden (5.22 → 7.x is beschikbaar) als dit ooit hindert.

### Geen permanente e2e-testsuite
**Opgelost:** na Sprint 3 (2026-07-29) — zie sectie "Playwright e2e-infrastructuur" hieronder.

### Aannames/interpretaties bij ontbrekende schemadetails (Fase 3)
**Wat:** `docs/Database_Schema.sql` had geen ruimte voor een "voorstel, wacht op bevestiging"-status voor duo-vorming. In overleg opgelost met een nieuwe `duo_invitation`-tabel (jouw keuze) en een kleine kolomtoevoeging `duo.dissolution_requested_by_user_id` (mijn voorstel, expliciet gemeld). Ontbinding is geïnterpreteerd als een 2-staps request→confirm-flow; `dissolution_requested_at` wordt gezet bij de aanvraag, `dissolved_at`/`is_active=false` pas bij bevestiging door de andere speler.
**Risico:** Laag, maar een interpretatiekeuze — als de bedoeling anders was, moet dit vóór Sprint 4 (disputes bouwen voort op deze flow) gecorrigeerd worden.

### Wachtwoordcomplexiteit is een eigen default
**Wat:** Minimaal 10 tekens + hoofdletter/kleine letter/cijfer. PRD §14 had dit als open vraag, geen vastgestelde eis.
**Risico:** Laag — kan zonder schemawijziging aangepast worden in `src/lib/auth/password.ts`.

### ELO K-factor-parameters nog niet in `platform_config`
**Wat:** De ELO-module (`src/lib/elo`) is bewust DB-onafhankelijk; K-factor-drempels/-waarden (40/24/16, top-10%) zitten nu in een `DEFAULT_K_FACTOR_CONFIG`-constante, niet in `platform_config`.
**Risico:** Geen op dit moment — de module wordt pas in Sprint 3 aan matches gekoppeld.
**Wanneer relevant:** Sprint 3 (Epic F). De aanroepende service moet dan `platform_config`-rijen voor deze parameters toevoegen (data-migratie, geen schemawijziging) en doorgeven aan `getKFactor`/`applyMatchResult`.

---

## Na Sprint 2 (Challenge-engine met rank-tiers)

### Aanname: uitdagen is beperkt tot dezelfde regio, niet alleen dezelfde tier
**Wat:** De user stories (FR-4.2/US-E2) noemen alleen een tier-restrictie voor uitdagen. `challengeService.proposeChallenge` weigert daarnaast ook uitdagingen tussen duo's in verschillende regio's (`different_region`).
**Waarom:** Wedstrijden worden fysiek gespeeld (PRD §6); twee duo's uit verschillende regio's tegen elkaar laten spelen is praktisch onzinnig, ook al staat dat nergens expliciet als AC.
**Risico:** Laag — als dit ongewenst is (bijv. omdat er bewust cross-regio uitgedaagd moet kunnen worden), is dit één `if`-check in `proposeChallenge` om te verwijderen.

### "Achtergrondjob" voor challenge-expiratie is een handmatig/extern te triggeren endpoint
**Wat:** US-E4's achtergrondjob is gebouwd als `POST /api/jobs/expire-challenges`, beveiligd met een gedeeld secret (`JOBS_SECRET`-header), in plaats van een echte scheduled job/worker.
**Risico:** Zonder een externe scheduler (bijv. Vercel Cron, een cron-container, of een handmatige aanroep) die dit endpoint periodiek aanroept, verlopen challenges nooit automatisch.
**Wanneer relevant:** Vóór een echte pilot-rollout (PRD §13) — dan moet er een scheduler geconfigureerd worden die dit endpoint bijv. elk uur aanroept.
**Mogelijke oplossing:** Vercel Cron (`vercel.json` met een `crons`-sectie) of een gelijkwaardige scheduler in de gekozen hostingomgeving.

### Forfeit-cooldown wordt afgeleid uit `RatingHistory`, niet uit een aparte kolom
**Wat:** `isDuoInForfeitCooldown` in `challengeService.ts` bepaalt de cooldown door het meest recente `RatingHistory`-record met `is_forfeit=true` op te zoeken en `forfeit_cooldown_days` erbij op te tellen — zelfde patroon als de duo-dissolution-cooldown uit Sprint 1.
**Risico:** Geen bekend risico; dit is een bewuste, consistente ontwerpkeuze om geen schema-uitbreiding nodig te hebben. Wel een extra query per cooldown-check — bij een grote `RatingHistory`-tabel is een index op `(duo_id, is_forfeit, created_at)` aan te raden (nu gedekt door de bestaande `idx_rating_history_duo`-index, die begint met `duo_id, created_at`, dus dit is al redelijk efficiënt).

---

## Na Sprint 3 (Matches, ELO-verwerking & Speelverplichting)

### Score-formaat is een eigen invulling
**Wat:** `score_raw` had in `Database_Schema.sql` nooit een voorgeschreven encoding (alleen `VARCHAR(50)`). Gekozen formaat: `"6-4,6-3[,10-8]"` (games per set, 2-3 sets, komma-gescheiden), geparst/gevalideerd in `src/lib/match/score.ts`.
**Risico:** Laag — als er ooit een client (bijv. een losse mobiele app) buiten deze codebase om scores indient, moet die exact dit formaat aanhouden. Gedocumenteerd en volledig unit-getest (`tests/unit/match/score.test.ts`).

### 2 nieuwe `platform_config`-rijen voor matchverwerking
**Wat:** `match_auto_confirm_hours` (48) en `repeated_opponent_window_days` (14) toegevoegd via een data-migratie — geen schemawijziging, beide expliciet "configureerbaar" genoemd in `ELO_Algoritme.md`/Sprint3-doc maar nog niet eerder geseed.
**Risico:** Geen.

### Challenge krijgt status `completed` bij een voltooide match
**Wat:** Naast de match zelf zet `finalizeMatch` ook `challenge.status = 'completed'` — dit staat al in het `challenge_status`-enum maar wordt niet expliciet genoemd in de Sprint3-AC's.
**Waarom:** Zonder dit zou `hasActiveChallenge()` (Sprint 2) een duo voor altijd als "bezet" blijven beschouwen na een voltooide wedstrijd, waardoor het nooit meer een nieuwe challenge zou kunnen aangaan.
**Risico:** Geen bekend risico; noodzakelijk voor correcte werking van Epic E.

### "Achtergrondjobs" voor auto-confirm en unplayed-timeout zijn handmatig/extern te triggeren endpoints
**Wat:** `POST /api/jobs/auto-confirm-matches` en `POST /api/jobs/expire-unplayed-challenges`, zelfde beveiligingsaanpak (gedeeld secret) als de challenge-expiratiejob uit Sprint 2.
**Risico:** Zelfde als de Sprint 2-tech-debt hierboven: zonder een externe scheduler gebeurt dit nooit vanzelf. Alle drie de job-endpoints moeten samen ingepland worden vóór een pilot-rollout.

### Percentiel-/herhaalde-tegenstander-berekening gebeurt buiten de schrijf-transactie
**Wat:** `finalizeMatch` leest de ladder-positie (voor K-factor) en de matchhistorie (voor de herhaalde-tegenstander-demping) vóór de transactie start; alleen de daadwerkelijke schrijfacties (rating-update, RatingHistory, challenge-status) zitten in de transactie, beveiligd met een compare-and-swap guard.
**Risico:** Laag — bij een zeer nauwe race (twee matches van dezelfde duo's binnen milliseconden afgerond) zou de K-factor/demping op licht verouderde data gebaseerd kunnen zijn. De correctheid van de rating-update zelf (geen dubbele verwerking, geen halve update) blijft gegarandeerd door de guard. Bij een grotere schaal kan dit strikter binnen de transactie getrokken worden.

---

## Infrastructuur (buiten sprint-scope, op verzoek toegevoegd na Sprint 3)

### Codespace start nu automatisch op (devcontainer)
**Wat:** `.devcontainer/devcontainer.json` (image `mcr.microsoft.com/devcontainers/universal:2`, hetzelfde default-image dat de Codespace al gebruikte) + `.devcontainer/start.sh` als `postStartCommand`: start/creëert de Postgres-container (nu mét volume, `padel-ladder-db-data`, zodat data een herstart overleeft — dit loste het probleem op dat eerder in deze sessie speelde), past migraties toe, seedt alleen als de dev-db leeg is, en start `npm run dev` op de achtergrond als die nog niet draait.
**Let op:** dit bestand bestond nog niet; het treedt pas in werking bij de **volgende** Codespace-(her)start, niet met terugwerkende kracht op de huidige sessie.
**Risico:** Geen bekend risico — idempotent, geverifieerd door het script handmatig te draaien.

### Playwright e2e-infrastructuur
**Wat:** `playwright.config.ts` + `tests/e2e/*.spec.ts` (ladder, duo-management, challenge-and-match, disputes). Draait tegen een **aparte database** (`padel_ladder_test`) op een **aparte poort** (3100), zodat `npm run test:e2e` nooit de dev-database/poort-3000-server aanraakt die de gebruiker zelf handmatig bekijkt. `npm run test:e2e` doet eerst een ECHTE reset (`prisma migrate reset --force --skip-seed`, niet alleen de idempotente seed-upsert) zodat leftover data van vorige runs nooit tests laat slagen/falen op de verkeerde gronden.
**Belangrijke vondst tijdens het opzetten:** een echte race-condition-bug in `src/app/ladder/page.tsx` — de `useEffect` die bepaalde "namens welk duo uitdagen" had een onvolledige dependency-array, waardoor de uitdaagbare-duo-berekening kon vastlopen op een lege staat als de eigen-duo's-data vóór de ladder-data binnenkwam. Gefixt met `useMemo` + correcte dependencies. Dit is een voorbeeld van precies het soort regressie waar de e2e-suite voor bedoeld is.
**Vervolg:** vanaf Sprint 4 wordt het toevoegen van e2e-tests voor nieuwe features onderdeel van de reguliere sprint-workflow, niet meer optioneel.
**Kanttekening:** multi-actor e2e-tests (2-3 browsercontexten, meerdere rondes) kunnen de standaard 30s Playwright-testtimeout overschrijden door `next dev`'s on-demand compilatie — expliciet `test.setTimeout(60_000)` toegevoegd waar nodig (zie `04-disputes.spec.ts`). Geen productie-risico (productie-builds hebben geen compilatie-overhead per request), wel iets om aan te denken bij nieuwe multi-actor e2e-tests.

---

## Na Sprint 4 (Disputes)

### RatingHistory(duo_id, challenge_id) is niet meer uniek (in overleg)
**Wat:** de unieke index is vervangen door een gewone index — nodig omdat een `resolved_overturned` forfeit-dispute een NIEUW, gekoppeld correctie-record vereist náást het originele forfeit-record (auditability, US-G3), wat met de oorspronkelijke (in Fase 1 al zo aangelegde) unieke index onmogelijk was.
**Risico:** Laag. Dit betekent wel dat een duo nu in theorie meerdere `RatingHistory`-rijen voor dezelfde challenge kan hebben (origineel + correctie(s)) — bij het optellen/weergeven van "totale impact van deze challenge" moet je dus over alle rijen sommeren, niet uitgaan van precies 1 rij per duo per challenge.

### Voided match sluit de challenge blijvend af, zonder nieuwe score-poging
**Wat:** bij `resolved_overturned` op een match-score-dispute wordt de match op `voided` gezet, maar de challenge zelf blijft op `accepted` staan. Omdat `match.challenge_id` uniek is, kan er nooit een nieuwe score voor diezelfde challenge ingediend worden — er is geen "opnieuw spelen"-pad.
**Risico:** Laag/zeldzaam (disputes zijn een uitzondering), maar wel een échte doodlopende weg voor dat duo-paar totdat een nieuwe challenge wordt aangemaakt. Niet expliciet gevraagd in de Sprint4-AC's; bewust niet zelf een "heropen challenge"-flow verzonnen.

### Admin-account alleen via seed-script
**Wat:** `admin@example.com` wordt aangemaakt door `scripts/seed.ts`, er is geen UI/flow om een gebruiker tot admin te promoveren.
**Risico:** Geen voor de pilotschaal — bij een echte rollout moet er een manier komen om (extra) admins aan te wijzen buiten het seed-script om.

### Admin-link in de navigatiebalk leest de rol uit een ongeverifieerd JWT-payload
**Wat:** `getStoredRole()` decodeert het JWT client-side zonder handtekeningverificatie, puur om de "Admin"-link wel/niet te tonen.
**Risico:** Geen — dit is nooit de autorisatiegrens (elke admin-API-route controleert `user.role` server-side opnieuw via het geverifieerde token). Een gemanipuleerd client-side token zou hooguit een onterecht zichtbare link geven, niet toegang tot data.
