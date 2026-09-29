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
**Opgelost (post-v1, 2026-09-28):** Postgres-backed via `audit_log` — geen Redis nodig; zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

### E-mailverzending is een dev-console-stub
**Wat:** `src/lib/auth/email.ts` logt activatiemails naar de console i.p.v. ze echt te versturen.
**Risico:** Activatie-/resend-flow werkt niet voor echte gebruikers buiten dev/QA.
**Wanneer relevant:** Vóór een echte pilot-rollout (PRD §13).
**Mogelijke oplossing:** PRD §14 heeft dit als openstaande vraag (welke provider). `sendEmail()` is bewust als losse, vervangbare functie opgezet zodat alleen die implementatie hoeft te wijzigen.
**Opgelost (post-v1, 2026-09-28):** Resend-koppeling met console-fallback; zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

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
**Update (Vercel-deploy):** opgelost via `vercel.json` (`crons`) + een nieuw endpoint `GET/POST /api/jobs/run-all` dat alle drie de jobs (expire-challenges, auto-confirm-matches, expire-unplayed-challenges) in één aanroep combineert — nodig omdat het Hobby-plan maximaal 2 cron jobs toestaat. De losse endpoints blijven bestaan voor handmatige/gerichte aanroepen. Autorisatie via `src/lib/auth/jobAuth.ts`: accepteert zowel de bestaande `x-job-secret`-header als `Authorization: Bearer <JOBS_SECRET>` (het formaat waarmee Vercel Cron automatisch de `CRON_SECRET`-omgevingsvariabele meestuurt — die moet dus gelijk gezet worden aan `JOBS_SECRET`).

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
**Opgelost (post-v1, 2026-09-28):** "opnieuw spelen" na een overturned dispute, met schemawijziging op `match.challenge_id` (akkoord PO); zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

### Admin-account alleen via seed-script
**Wat:** `admin@example.com` wordt aangemaakt door `scripts/seed.ts`, er is geen UI/flow om een gebruiker tot admin te promoveren.
**Risico:** Geen voor de pilotschaal — bij een echte rollout moet er een manier komen om (extra) admins aan te wijzen buiten het seed-script om.
**Opgelost (post-v1, 2026-09-28):** admin-UI `/admin/users` om admins aan te wijzen/in te trekken. De állereerste admin van een nieuwe (productie)omgeving moet nog steeds via de database/seed worden aangewezen; zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

### Admin-link in de navigatiebalk leest de rol uit een ongeverifieerd JWT-payload
**Wat:** `getStoredRole()` decodeert het JWT client-side zonder handtekeningverificatie, puur om de "Admin"-link wel/niet te tonen.
**Risico:** Geen — dit is nooit de autorisatiegrens (elke admin-API-route controleert `user.role` server-side opnieuw via het geverifieerde token). Een gemanipuleerd client-side token zou hooguit een onterecht zichtbare link geven, niet toegang tot data.
**Aanvulling (post-v1, 2026-09-28):** admin-API-routes controleren de rol nu bovendien in de database (`requireAdmin`), zodat een gedegradeerde admin met een nog geldig token direct geen toegang meer heeft. De navigatielink leest nog steeds het JWT (tot opnieuw inloggen kan een gedegradeerde admin de link nog zien — de pagina toont dan "Alleen toegankelijk voor admins").

---

## Na Sprint 5 (Beschikbaarheid & Externe API) — afronding v1-scope

### Externe-API-ratelimiting is in-memory, per-instance
**Wat:** `src/lib/apiClient/rateLimit.ts` (fixed-window) heeft dezelfde grens als de login-rate-limiter uit Sprint 1: reset bij herstart, niet gedeeld tussen meerdere instanties.
**Risico:** Zelfde categorie als de bestaande login-rate-limiting-tech-debt. Bij opschalen naar meerdere instanties: vervangen door een gedeelde store (Redis).
**Opgelost (post-v1, 2026-09-28):** telt nu de gelogde aanroepen in `audit_log` (gedeeld over instanties); zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

### API-key-hashing met SHA-256 i.p.v. bcrypt (bewuste, afwijkende keuze)
**Wat:** `src/lib/apiClient/apiKey.ts` gebruikt een snelle cryptografische hash (SHA-256) i.p.v. bcrypt (dat wél gebruikt wordt voor wachtwoorden).
**Waarom geen risico:** API-keys zijn hoge-entropie, systeem-gegenereerde secrets (48 hex-tekens) — een offline brute-force-aanval op zo'n secret is praktisch onhaalbaar, dus de "langzaam maken"-eigenschap van bcrypt (bedoeld tegen laag-entropie, door mensen bedachte wachtwoorden) voegt hier geen relevante beveiliging toe, alleen onnodige latency per API-aanroep. Een deterministische hash maakt bovendien een directe DB-lookup op `api_key_hash` mogelijk i.p.v. alle actieve clients te moeten doorlopen.

### Voided-match-doodlopende-weg (herhaling vanuit Sprint 4) blijft ongewijzigd
Zie "Na Sprint 4" hierboven — niet opnieuw aangepakt in Sprint 5, buiten scope.
**Opgelost (post-v1, 2026-09-28):** zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

### Logging van mislukte externe-API-aanroepen (sprint-review-fix)
**Wat:** tijdens de sprint-review bleek dat aanroepen met een ingetrokken key (401) en met een ongeldige `dayOfWeek` (400) niet gelogd werden, terwijl US-H5 "elke aanroep" vraagt. Beide worden nu gelogd bij de betreffende client. `?dayOfWeek=` (leeg) of `1.5` gaf voorheen stilletjes zondag/een lege lijst terug; nu `400`.
**Bewuste grens:** een volledig onbekende key valt aan geen enkele `ApiClient` toe te schrijven en wordt daarom niet gelogd (de audit-log is per client).

### v1-scope compleet
Met Sprint 5 is de volledige v1-scope uit de PRD (Sprint 1 t/m 5) functioneel gebouwd. Openstaande, met opzet niet zelf ingevulde PRD-open-vragen (§14) — rating-tier-breedte, forfeit-penalty-hoogte, max-aantal-duo's, exacte deadlines — staan nog op de richtwaarden uit de documenten; dit is een bewuste keuze (niet zelf besluiten wat een productbeslissing is), geen omissie.

---

## Visuele restyling (na Sprint 5, op verzoek)

### Design system "Modernist" verwerkt uit /websitedesign
> **Vervangen (2026-09-28)** door design system "Court" (docs/Design_System.md); `/websitedesign` is verouderd.

**Wat:** de door de gebruiker aangeleverde `/websitedesign`-map (een Claude-gegenereerd design system + schermmockup) is verwerkt als de daadwerkelijke styling van de app: `src/app/design-system.css` (kopie van de tokens/componentklassen), Archivo-lettertype via `next/font/google`, en alle bestaande pagina's herstijld met de nieuwe componentklassen (`.btn`, `.card`, `.tag`, `.table`, `.field`/`.input`, `.hr`). Geen dark-mode meer (het design system is bewust single-theme).
**Belangrijk:** dit was een **presentatie-only** wijziging — geen enkele service, API-route of databaselaag is aangeraakt. Alle 165 unit tests en 6 e2e-tests slagen ongewijzigd; één e2e-selector (`tr.bg-yellow-100` → `tr[data-own="true"]`) is aangepast omdat de visuele stijl van "eigen duo" veranderde, niet de onderliggende logica.
**`/websitedesign` blijft in de repo staan** als brondocumentatie voor het design system (tokens aanpassen kan daar, zie het `readme.md` erin) — het is geen onderdeel van de gebouwde app zelf.
**Risico:** Geen bekend risico. Wel een aandachtspunt voor toekomstige sprints: nieuwe UI moet de nieuwe componentklassen gebruiken (niet terugvallen op losse Tailwind-grijstinten), en nieuwe e2e-tests moeten waar mogelijk op tekst/rol/`data-*`-attributen selecteren i.p.v. op stylingklassen, om herstyling in de toekomst niet weer tests te laten breken.

---

## Lay-out-herbouw naar de PDF-mockup (na de restyling hierboven, op verzoek)

De eerdere restyling had alleen kleuren/componentklassen overgenomen, niet de daadwerkelijke schermindeling uit `/websitedesign`. Deze ronde bouwt de indeling zelf na, met een paar bewuste aanpassingen waar de mockup (een statische illustratieve demo) niet één-op-één paste op het echte datamodel:

### Nieuwe top-level pagina's: `/challenges`, `/rating-history`, `/availability`
**Wat:** deze routes bestonden voorheen alleen duo-scoped (`/duos/[id]/...`), bereikbaar via een link op een specifieke duo-kaart op het dashboard. De mockup toont ze als eigen navigatietabs. De duo-scoped content is verplaatst naar herbruikbare view-componenten (`src/components/duo/Duo*View.tsx`); de nieuwe top-level pagina's tonen een duo-picker (nodig zodra een gebruiker meerdere actieve duo's heeft) en renderen dezelfde view. De duo-scoped routes bestaan nog steeds (dashboard-kaarten linken er nog naartoe, en de e2e-tests over meerdere duo's leunen erop).
**Risico:** Geen — puur navigatie/hergebruik, geen logica gewijzigd.

### Beschikbaarheid: vaste tijdvakken (Ochtend/Middag/Avond) i.p.v. vrije tijdsblokken
**Wat:** de mockup toont een weekrooster met 3 vaste dagdelen per dag, aan/uit te toggelen. Het echte datamodel (`DuoAvailability`) ondersteunt vrije start-/eindtijden. Om de mockup-indeling te volgen zijn 3 vaste tijdvakken gekozen (08:00–12:00 / 12:00–18:00 / 18:00–22:00); een klik op een cel maakt of verwijdert het bijbehorende blok via de bestaande API. Dit is een **bewuste beperking t.o.v. de oude UI** (niet meer élk tijdstip kiezen) ten gunste van de gevraagde lay-out-fidelity.
**Risico:** Laag — de API/datamodel ondersteunen nog steeds vrije tijden; alleen deze UI legt zichzelf vast op 3 vakken. Als vrije tijden alsnog gewenst zijn, is dat een aparte productbeslissing.
**Opgelost (post-v1, 2026-09-28):** vrije tijden + bewerken terug in de UI, rooster blijft als snelkeuze; zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

### Nieuwe admin-pagina `/admin/platform-config` (+ endpoint `GET /api/admin/platform-config`)
**Wat:** read-only overzicht van de `platform_config`-tabel, zoals in de mockup. Nieuw, want bestond nog niet.
**Risico:** Geen — alleen-lezen, admin-only (zelfde auth-check als de andere admin-routes).

### Ladder toont nu ook `tierSize`/tier-aantal (API-uitbreiding)
**Wat:** `GET /api/ladder` en `GET /api/dashboard` geven nu ook `tierSize` resp. `tier` per duo terug (voorheen alleen server-side gebruikt binnen `ladderService`), zodat de UI dit kan tonen zonder de waarde hard te coderen. Puur additief, geen bestaand gedrag gewijzigd.

### Weggelaten mockup-elementen (bewust, want geen echte data)
**W-L-record en streak** op de ladder-tabel: de mockup toont deze kolommen, maar de app houdt geen wedstrijd-telling/streak bij (alleen rating). Niet nagebouwd met verzonnen data.
**Opgelost (KNLTB-aanvullingen, 2026-09-28):** W-L, reeks, set-/gamesaldo, betrouwbaarheid en inactief-vlag worden nu afgeleid uit bevestigde matches/challenges (`statsService`, `src/lib/stats`) en additief meegegeven in `GET /api/ladder` en `GET /api/dashboard`; zie "KNLTB-aanvullingen (akkoord PO 2026-09-28) — statistieken & ELO-gamesaldo" onderaan. **"Sprint-status"-sectie** op de admin-configpagina: dat is projectmanagement-informatie uit CLAUDE.md, geen app-data — bewust weggelaten i.p.v. hardcoded/nep-content in de live app te zetten.

### Nieuwe pagina `/info`
**Wat:** statische uitlegpagina (ladder, tiers, multi-duo, challenges, ELO-rating in eenvoudige taal, forfeit, disputes, beschikbaarheid) — op expliciet verzoek. Geen bestaande functionaliteit geraakt.

**Testen:** alle 165 unit tests en alle 6 e2e-specs slagen. Twee e2e-bestanden zijn aangepast op de nieuwe lay-out: `helpers.ts` (inlog-heading "Mijn dashboard" → "Mijn duo's"), `03-challenge-and-match.spec.ts` (rating-historie-rij is nu een `<tr>` i.p.v. `<li>`), `05-availability-and-admin.spec.ts` (tijdsblok-formulier vervangen door het aanklikken van een roostercel via `aria-label`).

---

## Vercel-deploy

### `prisma generate` ontbrak in het build-proces
**Wat:** Vercel cachet `node_modules` tussen builds, waardoor `prisma generate` (dat normaal via `npm install`'s post-install-lifecycle van Prisma zelf draait) soms wordt overgeslagen — de gegenereerde Prisma Client blijft dan verouderd/afwezig, met een `PrismaClientInitializationError` tijdens "Collecting page data" tot gevolg.
**Oplossing:** `"postinstall": "prisma generate"` toegevoegd aan `package.json`, zodat dit expliciet en betrouwbaar bij elke install gebeurt (de door Prisma zelf aanbevolen fix voor Vercel, zie https://pris.ly/d/vercel-build).

### Vereiste environment-variabelen in het Vercel-project
Moeten in Vercel (Project Settings → Environment Variables) gezet worden — staan nergens in de repo (`.env` is gitignored):
- `DATABASE_URL` — een bereikbare, gehoste PostgreSQL (Neon/Supabase/Vercel Postgres/etc.); de lokale devcontainer-Postgres is vanaf Vercel niet bereikbaar.
- `JWT_SECRET` — willekeurige lange string, voor sessie- en activatietokens.
- `APP_BASE_URL` — de productie-URL (bijv. `https://padelduel.vercel.app`), gebruikt om de activatielink in registratiemails op te bouwen.
- `JOBS_SECRET` — willekeurige lange string, beveiligt de `/api/jobs/*`-endpoints.
- `CRON_SECRET` — **exact dezelfde waarde als `JOBS_SECRET`.** Vercel Cron stuurt automatisch `Authorization: Bearer $CRON_SECRET` mee bij het aanroepen van een pad uit `vercel.json`; `isAuthorizedJobRequest` (`src/lib/auth/jobAuth.ts`) accepteert dat header-formaat naast de bestaande `x-job-secret`-header.
- `RESEND_API_KEY` + `EMAIL_FROM` — *(post-v1)* voor echte e-mailverzending via Resend; zonder key worden activatiemails alleen gelogd (zie "Post-v1" onderaan).

### Database-migraties draaien bij de productie-build (gewijzigd 2026-09-29)
**Wat:** het script `vercel-build` (dat Vercel automatisch i.p.v. `build` gebruikt) draait `prisma migrate deploy` **alleen als `VERCEL_ENV=production`**, daarna `next build`. Eerder was dit bewust handmatig, maar met vier nieuwe migraties (post-v1 + KNLTB) zou de nieuwe code direct crashen tegen een niet-gemigreerde productiedatabase. Preview-deploys migreren nooit (anders zou een ongemergde branch de productiedatabase kunnen wijzigen als previews dezelfde `DATABASE_URL` delen).
**Risico:** een mislukte migratie laat de build falen — dat is gewenst (de oude deploy blijft dan live). Migraties blijven additief/handgecontroleerd; destructieve migraties vereisen nog steeds handmatige review vooraf. `scripts/seed.ts` wordt nooit tegen productie gedraaid.

### Achtergrondjobs: dagelijkse Vercel Cron + uurlijkse GitHub Actions (fix 2026-09-29)
**Wat:** de oorspronkelijke uurlijkse Vercel-cron (`0 * * * *`) is op het Hobby-plan niet toegestaan (max. één keer per dag) — Vercel weigerde daardoor **elke deploy sinds 17-08-2026** ("Deployment failed", link naar de cron-pricing-docs). Nu: `vercel.json` draait `run-all` dagelijks om 04:00 UTC als vangnet, en `.github/workflows/hourly-jobs.yml` roept `POST /api/jobs/run-all` elk uur aan met de `x-job-secret`-header. Vereist repository-secrets `APP_URL` en `JOBS_SECRET` (zonder die secrets slaat de workflow over met een waarschuwing).
**Risico:** GitHub Actions-schedules kunnen bij drukte enkele minuten tot ~een half uur vertraagd zijn en worden na 60 dagen repo-inactiviteit automatisch uitgeschakeld. Alle jobs zijn idempotent, dus vertraging of een dubbele run is veilig. Bij een Vercel Pro-plan kan de cron terug naar elk uur en de workflow weg.

### E-mail wordt nog niet echt verstuurd
> **Deels opgelost (Post-v1):** `sendEmail` verstuurt via Resend zodra `RESEND_API_KEY` (+ `EMAIL_FROM` met geverifieerd domein) gezet is. Op productie is dat nog niet gedaan (keuze PO 2026-09-29), dus onderstaande geldt daar nog.

**Wat:** `sendEmail` (`src/lib/auth/email.ts`) logt de activatielink alleen naar de servers-console (Vercel Function Logs) — er is nog geen echte provider gekoppeld (bewuste, nog niet ingevulde PRD-open-vraag, zie eerdere Sprint 1-notitie). Op Vercel betekent dit concreet: na registreren moet de activatielink even uit de Vercel Function Logs gehaald worden om een account te activeren, i.p.v. dat de gebruiker een e-mail ontvangt.
**Risico:** Prima voor een demo aan vrienden; niet geschikt voor een echte rollout zonder een provider (Resend/Postmark/SES) te koppelen.
**Opgelost (post-v1, 2026-09-28):** zet `RESEND_API_KEY` (+ `EMAIL_FROM`) in Vercel; zonder key blijft het console-gedrag; zie "Post-v1 (akkoord PO 2026-09-28)" onderaan.

---

## Post-v1 (akkoord PO 2026-09-28)

Vier door de PO goedgekeurde uitbreidingen na de v1-scope. UI bewust functioneel/minimaal (bestaande componentklassen); de logica zit in services en client-hooks, zodat de aparte UI-redesign alleen presentatie hoeft aan te passen.

### 1. Beschikbaarheid: vrije tijden en bewerken (US-H1/H2)
**Wat:** `DuoAvailabilityView` heeft naast het snelkeuze-rooster (Ochtend 08–12 / Middag 12–18 / Avond 18–22) weer een formulier voor een vrij tijdsblok (dag, van, tot, "vast terugkerend") en een lijst van álle blokken met **Bewerken** (`PATCH /api/availability/[id]`, bestond al) en **Verwijderen**. Beide duo-leden kunnen dit (lidmaatschapscheck in de service). Logica in `src/lib/client/useDuoAvailability.ts`; client-side validatie hergebruikt het zod-schema van de API (`validateAvailabilityInput` in `src/lib/availability/validation.ts`).
**Keuzes:** een rooster-cel telt alleen als "aan" bij een exacte match (dag + begin + eind) — voorheen matchte alleen de begintijd, waardoor een vrij blok van bijv. 08:00–10:00 via de "Ochtend"-cel verwijderd kon worden. `PATCH` blijft een volledige vervanging (alle velden verplicht, `recurring` default `true`). Een ongeldig blok-id geeft nu `404` i.p.v. een 500.
**Restrisico:** overlappende blokken worden niet samengevoegd of geweigerd (datamodel/API stonden dit al toe; onschuldig voor de externe API). `recurring=false` heeft geen datum in het datamodel — het betekent alleen "geen vast patroon"; een echte eenmalige datum is een aparte productbeslissing.

### 2. E-mail via Resend
**Wat:** `sendEmail` (`src/lib/auth/email.ts`) verstuurt via de Resend HTTP-API (`fetch` naar `https://api.resend.com/emails`, geen SDK-dependency) als `RESEND_API_KEY` gezet is; afzender `EMAIL_FROM` (default `Padel Ladder <onboarding@resend.dev>`). Zonder key: het oude console-gedrag. Beide variabelen staan met uitleg in `.env.example` en moeten in Vercel gezet worden.
**Keuze bij een mislukte verzending:** `sendEmail` gooit niet, maar geeft `{ ok: false, error }` terug en logt de fout — zonder API-key (wordt ook uit een eventuele provider-echo geredigeerd) en met gemaskeerde ontvanger (`s***@example.com`). **Registratie** maakt het account dan tóch aan en antwoordt `201` met `emailSent: false` + een melding; de registratiepagina verwijst naar "Activatielink opnieuw versturen". Waarom geen rollback/500: bij een providerstoring zou elke registratie falen, en een 500 terwijl het account al bestaat laat de retry stuklopen op "bestaat al". **Resend-activation** blijft altijd hetzelfde generieke antwoord geven (geen account-enumeratie via "verzenden mislukt").
**Restrisico:** met de default-afzender `onboarding@resend.dev` kan Resend alleen naar het eigen account-adres sturen — voor echte gebruikers moet een eigen domein geverifieerd en `EMAIL_FROM` gezet worden. Geen retry-queue: een mislukte mail wordt niet automatisch opnieuw geprobeerd (de gebruiker kan zelf opnieuw aanvragen). Timeout per verzending: 10 s.

### 3a. Admin-beheer: admins aanwijzen/intrekken
**Wat:** nieuwe pagina `/admin/users` (+ navigatielink "Gebruikers"), `GET /api/admin/users?q=` (max. 200 rijen, zoeken op e-mail) en `PATCH /api/admin/users/[id]/role` (`{ role: "USER" | "ADMIN" }`). Service: `src/server/services/userAdminService.ts`; hook: `src/lib/client/useAdminUsers.ts`.
**Regels/keuzes:**
- De **laatste actieve admin kan nooit gedegradeerd worden** (niet door zichzelf en niet door een ander) → `409 last_admin`. Rolwijzigingen lopen in een transactie met een Postgres advisory lock, zodat twee admins die elkaar gelijktijdig degraderen niet samen de laatste admin kunnen wegnemen.
- Alleen **geactiveerde** accounts kunnen admin worden (`400 user_not_active`).
- Elke wijziging → `audit_log` (`entity_type 'app_user'`, `action 'user_role_changed'`, `payload {from, to}`, `performed_by` = admin). Dezelfde rol opnieuw zetten is een no-op zonder audit-rij.
- **Alle `/api/admin/*`-routes** gebruiken nu `requireAdmin` (`src/lib/auth/requireAdmin.ts`): naast het JWT wordt de rol uit de database gelezen. Het sessietoken bevat de rol van het inlogmoment (TTL 2 uur); zonder deze check zou een gedegradeerde admin tot 2 uur admin blijven. Kost één PK-lookup per admin-request.

**Restrisico:** een nieuw aangewezen admin ziet de admin-menu-items pas na opnieuw inloggen (de API werkt wél direct). De allereerste admin in een lege productieomgeving moet via de database worden aangewezen.

### 3b. Rate limiting via Postgres (externe API én login)
**Externe availability-API** (`src/lib/apiClient/rateLimit.ts`): glijdend venster van 60 s over de al bestaande `audit_log`-rijen per API-client (`availability_api_call`); limiet blijft `platform_config.availability_api_rate_limit_per_minute`. Aanroepen die zelf met `429` geweigerd zijn tellen niet mee (anders blijft een client die blijft aandringen eeuwig geblokkeerd). `Retry-After` = tijd tot de oudste meegetelde aanroep uit het venster valt (min. 1 s). Geen schemawijziging.
**Login** (`src/lib/auth/rateLimit.ts`): mislukte pogingen worden als `audit_log`-rij vastgelegd (`entity_type 'login_rate_limit'`, `action 'login_failed'`); een geslaagde login ná mislukte pogingen schrijft een reset-marker. `entity_id` is een uit SHA-256 afgeleide UUID van de key (e-mail + IP) — e-mailadres/IP worden niet opgeslagen. Semantiek: maximaal `login_max_attempts` mislukte pogingen per `login_lockout_minutes` per key (glijdend venster). **Gedragsverschil t.o.v. de oude in-memory limiter:** mislukte pogingen verlopen nu vanzelf na het venster (voorheen telden ze door tot een geslaagde login), en de blokkade duurt tot de oudste van de laatste N pogingen uit het venster valt (i.p.v. altijd precies `login_lockout_minutes` na de N-de poging).
**Restrisico's:**
- Een API-aanroep wordt pas aan het eind van de request gelogd: bij gelijktijdige (in-flight) requests van dezelfde client kan de limiet met maximaal het aantal gelijktijdige requests worden overschreden. Exact afdwingen vereist een reservering vóór elke request (extra schrijfactie per call); bewust niet gedaan.
- De telquery gebruikt de bestaande index `idx_audit_log_entity (entity_type, entity_id)` en filtert daarna op `created_at`. Bij heel veel historische rijen per client/key wordt dat trager; dan helpt een index `(entity_type, entity_id, created_at)` (schemawijziging, niet zonder akkoord gedaan) en/of periodiek archiveren van oude `audit_log`-rijen.
- `audit_log` groeit nu ook met elke mislukte login; geen opschoning.
- `created_at` wordt door de app-instantie gezet; kleine klokverschillen tussen instanties verschuiven het venster marginaal.

### 4. Opnieuw spelen na een overturned match-score-dispute (schemawijziging, akkoord PO)
**Migratie:** `20260928120000_match_replay_after_void` — unieke index `match_challenge_id_key` vervangen door een gewone index `idx_match_challenge` plus een **partial unique index** `idx_match_challenge_not_voided ON match (challenge_id) WHERE status <> 'voided'` (hooguit één niet-voided match per challenge). In Prisma: `Match.challengeId` niet meer `@unique`, `Challenge.match` → `Challenge.matches` (1:n). De partial index staat alleen in de raw-SQL-migratie (zelfde aanpak als `member_pair_key`); `docs/Database_Schema.sql` en het ER-diagram zijn bijgewerkt.
**Gedrag:**
- `resolved_overturned` op een match-score-dispute: match → `voided`, challenge blijft `accepted`, en **de speeltermijn herstart**: nieuwe `match_deadline` = nu + `challenge_match_deadline_days`, maar nooit korter dan de oorspronkelijke. Reden: de oude deadline is bij afhandeling vaak al verstreken, wat ofwel elke nieuwe score blokkeert, ofwel direct een forfeit geeft voor iets waar de duo's niets aan konden doen. Dispute-status, match-status, deadline en audit-log gebeuren nu in **één transactie met compare-and-swaps** (voorheen losse writes); een dubbele/gelijktijdige afhandeling wordt geweigerd i.p.v. half uitgevoerd. De audit-payload bevat `replayAllowed` en `newMatchDeadline`.
- `submitScore` staat een nieuwe match toe zodra alle eerdere matches voided zijn. Het aanmaken gebeurt in een transactie met `SELECT … FOR UPDATE` op de challenge-rij (status/deadline worden na de lock opnieuw gecontroleerd); een eventuele race met een gelijktijdige submit wordt door de partial unique index opgevangen en als `score_already_submitted` (of, bij dezelfde idempotency-key, als de bestaande match) teruggegeven. Idempotency-keys blijven globaal uniek; een retry met de key van de voided poging geeft die (voided) match terug — de UI genereert per indiening een nieuwe key.
- **Unplayed-timeout-job:** een challenge met uitsluitend voided matches telt als "nog niet gespeeld". De job neemt dezelfde rij-lock als `submitScore` en controleert daarna opnieuw of er geen niet-voided match is én of de (mogelijk verlengde) deadline nog steeds verstreken is. Speelt het duo-paar de replay niet binnen de nieuwe termijn, dan volgt de gewone vaste forfeit-penalty voor beide duo's (met de bestaande forfeit-dispute-mogelijkheid).
- **ELO:** ongewijzigd — pas bij bevestiging/auto-confirm van de nieuwe match via `finalizeMatch` (idempotente CAS op de matchstatus, één transactie). Een voided match heeft nooit rating-impact gehad, dus er is niets terug te draaien. `RatingHistory(duo_id, match_id)` blijft uniek per match.
- **API/UI:** `GET /api/duos/[id]/challenges` behoudt het veld `match` (= de actieve, niet-voided match of `null`) en krijgt `voidedMatches` erbij; de challenges-view toont bij een replay "Eerdere score … is ongeldig verklaard door een admin — speel opnieuw".

**Restrisico's:** bij herhaald overturnen kan een duo-paar in theorie steeds opnieuw spelen met steeds een nieuwe termijn — geen limiet op het aantal replays (productbeslissing; de admin kan in plaats daarvan de score handhaven). **Deploy-volgorde:** de migratie moet op productie vóór (of tegelijk met) deze code draaien (`npx prisma migrate deploy`); zonder migratie weigert de oude unieke index een replay-score (nette `score_already_submitted`-fout, geen datacorruptie).

### Overig
- `.eslintrc.json` heeft nu `"root": true`, zodat ESLint in een geneste git-worktree niet ook de config van de bovenliggende checkout laadt (gaf een plugin-conflict). Geen gedragswijziging in de hoofd-checkout.
- `playwright.config.ts`: Chromium start met `--disable-dev-shm-usage`. De devcontainer heeft maar 64 MB `/dev/shm`; onder geheugendruk (meerdere agents/dev-servers tegelijk) crashte Chromium sporadisch ("Target crashed"/"Page crashed") bij de specs met meerdere browsercontexts.
- Nieuwe/uitgebreide e2e-tests: `04-disputes` (overturned → nieuwe score → bevestigen → ELO), `05-availability-and-admin` (vrij blok toevoegen/bewerken/verwijderen door beide leden), `07-admin-users` (promoveren/degraderen, laatste-admin-regel, 403 voor een gewone gebruiker). Let op: de replay-test in `04` wijzigt de rating van Global Gladiators (onderste ladderrij); `01-ladder` draait in de volledige suite eerder (alfabetische volgorde, `workers: 1`).

---

## KNLTB-aanvullingen (akkoord PO 2026-09-28) — statistieken & ELO-gamesaldo

Geen schemawijziging en geen migratie (die lopen via het parallelle schema-werk). Alleen lib/services/API/tests/docs; de UI wordt door de redesign opgepakt.

### A. Gamesaldo in de ELO-formule
**Wat:** K wordt geschaald met een margin-of-victory-multiplier `M = M_min + (M_max − M_min) · m`, met `m = (G_w − G_l)/(G_w + G_l)` begrensd tot [0, 1]; games volgens de KNLTB-telling (match-tiebreak = één set en 1-0 in games). Volledige formule, rationale en rekenvoorbeeld: `ELO_Algoritme.md` §2bis. Code: `src/lib/elo/gameMargin.ts`, `applyMatchResult` (optionele `games`/`marginConfig`), `summarizeScore` in `src/lib/match/score.ts`, `finalizeMatch` in `matchService`.
**Keuzes:**
- Multiplier op K i.p.v. een marge-afhankelijke `S` in [0.5, 1]: met `S < 1` kan een favoriet die nipt wint punten verliezen. Nu wint de winnaar altijd (≥ +1) en verliest de verliezer altijd (≤ −1).
- Symmetrisch afronden (half van nul af) i.p.v. `Math.round` → exact zero-sum bij gelijke K. Kleine gedragswijziging t.o.v. v1 bij delta's van precies x.5 (verliezer −8 i.p.v. −7).
- Minimaal 1 punt winst/verlies (voorheen kon een extreme favoriet +0 krijgen).
- `RatingHistory.k_factor` = effectief toegepaste K (status-K × demping × M, afgerond) — de multiplier zelf wordt niet apart opgeslagen (geen kolom), maar is uit `score_raw` + de config te herleiden.
- Idempotentie/transactionaliteit ongewijzigd: de multiplier wordt vóór de transactie berekend (zoals percentiel en demping), de CAS op de matchstatus bewaakt dubbele verwerking.
- Geen herberekening van historische matches: oude `RatingHistory`-rijen blijven zoals ze zijn; het gamesaldo geldt voor matches die vanaf deze release bevestigd worden.

### B. Afgeleide statistieken
**Wat:** per duo W-L, huidige reeks (`W3`/`L2`), set- en gamesaldo, betrouwbaarheid ("X/Y challenges gespeeld"), inactief-vlag; wedstrijdhistorie en onderling resultaat. Puur in `src/lib/stats/*` (unit tests in `tests/unit/stats`), queries in `src/server/services/statsService.ts`.
**Definities (productkeuzes):**
- **W-L/reeks/saldo's:** uitsluitend bevestigde matches (`match.status = completed`). Forfeits zijn géén gespeelde wedstrijden en tellen niet als verlies (**gedragswijziging:** de oude ladderberekening telde een forfeit-penalty als verlies en leidde winst af uit het teken van de rating-delta). Een walkover/opgave die als synthetische score wordt vastgelegd, telt wél mee als match. Chronologie op `submitted_at` (≈ speeldatum), niet op `confirmed_at`.
- **Set-/gamesaldo:** KNLTB-telling, identiek aan de ELO-telling (`summarizeScore`).
- **Betrouwbaarheid:** X = challenges van het duo met status `completed`; Y = X + aan het duo toe te rekenen forfeits: `unplayed_timeout` (beide duo's, behalve het duo dat via een `resolved_overturned` forfeit-dispute is vrijgepleit — herkend aan zijn correctie-record) en `expired` (alleen de uitgedaagde). Niet meegeteld: `declined`, lopende challenges, `expired` voor de uitdager. `percentage` = afgerond, `null` bij Y = 0.
- **Inactief:** laatste activiteit = max(duo aangemaakt, laatste bevestigde match, laatste zelf verstuurde challenge, laatste geaccepteerde challenge) ligt strikt meer dan `inactive_after_days` (default 60) dagen terug. Passief uitgedaagd worden of een forfeit krijgen telt niet als activiteit.
- **Historie:** bevestigde matches, voided matches (label, delta 0) en forfeits (reden `expired`/`unplayed_timeout`, `forfeitCorrected`), nieuwste eerst. De rating-delta is de **som** van alle `RatingHistory`-rijen van die match/challenge (penalty + correctie). Lopende matches (awaiting_confirmation/disputed) staan er niet in.
- **Onderling resultaat:** alleen bevestigde matches tussen precies deze twee duo's (beide uitdaag-richtingen); forfeits tellen niet als ontmoeting.
- **Streak zonder matches** blijft `"—"` (bestaand ladder-contract); `streakDetail` is de gestructureerde variant (`null` zonder matches).

**API (additief):**
- `GET /api/ladder` (publiek, ongewijzigd) en `GET /api/dashboard` (ingelogd): elke ladderrij resp. `duos[].duo` krijgt `wins, losses, streak, streakDetail, setDifference, gameDifference, reliability, inactive, lastActivityAt`.
- Nieuw `GET /api/duos/[id]/matches?page=&pageSize=` (page ≥ 1, pageSize 1–100, default 20) en `GET /api/duos/[id]/head-to-head/[otherId]`: ingelogd vereist, geen lidmaatschap (zelfde regel als `/rating-history`). zod-validatie (uuid's, `id ≠ otherId`) → `400 invalid_input`; onbekend duo → `404 duo_not_found`. Alleen duo-id's/-namen, geen e-mail of user-id's.
**Performance:** ladder/dashboard gebruiken voor álle duo's samen twee extra queries (bevestigde matches + één geaggregeerde challenge-/forfeit-query met `GROUP BY`), geen N+1. `finalizeMatch` gebruikt nu `getLadderPositions` (zonder statistieken) voor het percentiel.

**Restrisico's:**
- De ladder leest alle bevestigde matches van de regio-duo's in het geheugen (scores moeten geparsed worden). Prima tot tienduizenden matches per regio; daarna materialiseren of in SQL aggregeren (schemawijziging/view).
- De historie pagineert in het geheugen (alle matches/forfeits van één duo worden gelezen); bij honderden wedstrijden per duo geen probleem.
- De rijen in de nieuwe routes zijn niet gecachet; bij veel verkeer op de publieke ladder is een korte cache (zoals bij `platform_config`) een optie.
- `inactive` is puur informatief; er is (nog) geen gedrag aan gekoppeld (bijv. verbergen of afwaarderen).

### Nog toe te voegen `platform_config`-rijen (volgende migratie)
De code leest deze keys via `getConfigNumberOrDefault` (nieuw in `platformConfigRepository`) en valt terug op de gedocumenteerde default zolang de rij ontbreekt; een aanwezige maar ongeldige waarde blijft een harde fout. Toe te voegen in de eerstvolgende migratie (data-only):

```sql
INSERT INTO "platform_config" (key, value, description) VALUES
    ('elo_margin_multiplier_min', '0.75', 'ELO-gamesaldo: K-multiplier bij de kleinste marge (m = 0); moet > 0 zijn'),
    ('elo_margin_multiplier_max', '1.5', 'ELO-gamesaldo: K-multiplier bij de grootste marge (m = 1, bijv. 6-0 6-0); moet >= min zijn'),
    ('inactive_after_days', '60', 'Dagen zonder eigen activiteit waarna een duo als inactief wordt gemarkeerd')
ON CONFLICT (key) DO NOTHING;
```


> **Status van deze rijen:** opgenomen in de data-only vervolgmigratie `20260928160000_elo_margin_inactive_config` (een al toegepaste migratie wordt nooit achteraf gewijzigd).

---

## KNLTB-aanvullingen (akkoord PO 2026-09-28) — profiel, walkover, uitstel, notificaties

Eén schemamigratie: `20260928150000_knltb_profile_walkover_postponement_notifications` (Prisma-deel + met de hand gecontroleerde raw SQL voor CHECK-constraints en partial indexen + `platform_config`-rijen). `docs/Database_Schema.sql` en `docs/ER_Diagram.mermaid` zijn bijgewerkt. Alleen schema/services/API/jobs/e-mailtemplates/tests/docs — geen pagina-UI (dat doet de redesign).

**Nieuwe `platform_config`-keys:** `default_start_rating` (1200), `postponement_max_days` (7), `postponement_max_per_challenge` (1), `notification_response_deadline_lead_hours` (24), `notification_match_deadline_lead_hours` (48), `notification_auto_confirm_lead_hours` (12).

### 1. Spelersprofiel
**Wat:** `app_user.display_name` (VARCHAR(40), nullable) en `app_user.knltb_level` (SMALLINT 1–9, nullable, CHECK). `GET/PATCH /api/me/profile` (`src/server/services/profileService.ts`, validatie in `src/lib/profile/validation.ts`). Registratie accepteert `displayName`.
**Keuzes:**
- **Weergavenaam** 2–40 tekens (letters incl. accenten, cijfers, spatie, `. ' - _`; geen `@`, zodat er nooit een e-mailadres als publieke naam komt). Niet uniek: de publieke identiteit op de ladder is de duo-naam.
- **In de API tijdelijk optioneel bij registratie**: de huidige registratiepagina stuurt het veld nog niet mee (en pagina-UI valt buiten deze opdracht). Wordt het meegestuurd, dan geldt de volledige validatie. De nieuwe registratiepagina hoort het verplicht te maken; daarna is `displayName: displayNameSchema.optional()` in `registerSchema` één regel om verplicht te maken. `GET /api/me/profile` geeft `hasDisplayName: false`, zodat de UI bestaande spelers om een naam kan vragen.
- **Fallback** voor spelers zonder naam: `Speler XXXXXX` (eerste 6 hex-tekens van het willekeurige user-id, `publicDisplayName`), nooit het e-mailadres.
- **Speelsterkte** is expliciet *zelf opgegeven* (`knltbLevelIsSelfDeclared: true` in de API), wordt niet geverifieerd en heeft geen invloed op rating of uitdaagregels. **Geen** KNLTB-bondsnummer opgeslagen (schema weigert onbekende velden).
- **Categorie op het duo** (`duo.category`: `HEREN`/`DAMES`/`GEMENGD`, nullable), niet op de speler: het KNLTB-speltype hoort bij de combinatie. Optioneel bij `POST /api/duos/propose` (opgeslagen op `duo_invitation.category` en bij acceptatie overgenomen); wijzigen via `PATCH /api/duos/[id]/category` (elk actief lid, audit-log `duo_category_changed`). **Informatief**: geen invloed op uitdaagregels of ladder (een aparte ladder per speltype zou de pilot-ladder versnipperen). Niet opgenomen in de ladder-/dashboard-responses (die worden parallel uitgebreid) — wel in `/api/duos/mine` en `/api/duos/[id]/challenges`.
- Niets hiervan gaat via de externe availability-API (die selecteert expliciet alleen duo-naam, regio en tijdsblokken — ongewijzigd).

**Audit e-mailadressen zichtbaar voor andere gebruikers:**
| Plek | Bevinding | Actie |
|---|---|---|
| `GET /api/duos/invitations` | Bevatte alleen user-id's; de uitgenodigde kon niet zien wie uitnodigde | `proposedByName`/`invitedUserName` (publieke naam) toegevoegd, nooit e-mail |
| `GET /api/duos/[id]/challenges` | Volledige duo-rijen van de tegenstander, incl. `memberPairKey` (= user-id's van de leden) en `dissolutionRequestedByUserId` | Beperkt tot `id, name, regionId, currentRating, isActive, category` |
| `GET /api/dashboard` (`partnerEmail`) | E-mailadres van de eigen duo-partner | **Opgelost (2026-09-29):** vervangen door `partnerName` (weergavenaam/fallback), zie "Integratie-UI" |
| `POST /api/duos/propose` | Uitnodigen gaat via het e-mailadres; foutmelding "Gebruiker met dit e-mailadres niet gevonden" verraadt of een adres geregistreerd is (enumeratie) | Ongewijzigd (UX-keuze); restrisico, zie hieronder |
| `GET /api/admin/disputes`, `GET /api/admin/users` | E-mail zichtbaar, maar alleen voor admins | E-mail blijft (contact), `displayName` toegevoegd; admin-zoeken zoekt ook op naam |
| Ladder, rating-historie, externe API, notificatiemails | Geen e-mailadressen | — |

### 2. Startrating nieuw duo
**Wat:** zie `ELO_Algoritme.md` §4 (bijgewerkt): gemiddelde van beide spelers, per speler het gemiddelde van zijn/haar andere **actieve** duo's of `default_start_rating`. Pure functie `computeStartRating` (`src/lib/duo/startRating.ts`), aangeroepen in `respondToInvitation` binnen de transactie die het duo aanmaakt. Provisional K blijft (matches_played = 0).
**Niet gedaan:** bijsturen op zelf opgegeven speelsterkte (manipuleerbaar, niet geverifieerd) — kan later via een config-mapping.
**Restrisico ("rating shoppen", PRD §11):** een speler kan eerst zijn duo's ontbinden en dan een nieuw duo vormen dat op de default start; mitigatie is de ontbindings-cooldown + admin-monitoring. Het gemiddelde weegt niet naar aantal gespeelde matches (een net gevormd, nog provisional duo telt even zwaar als een gevestigd duo). Bestaande duo's worden niet herberekend.

### 3. Walkover en opgave (KNLTB CRP art. 35.4 / 52.3)
**Wat:** `match.result_type` (`played`/`walkover`/`retired`), `match.conceding_side`, `match.played_score_raw` + CHECK dat de velden consistent zijn. Logica puur in `src/lib/match/resultType.ts`; `POST /api/challenges/[id]/score` accepteert `resultType` (default `played`, dus bestaande clients blijven werken).
**Keuzes:**
- **Walkover:** alleen door het duo dat wél kwam in te dienen; de niet-gekomen kant wordt afgeleid (= het andere duo). Vastgelegd als 6-0 6-0 en via de **gewone ELO-verwerking** (incl. gamesaldo → maximale multiplier; geaccepteerd). **Geen** `is_forfeit` — dat blijft voor `expired`/`unplayed_timeout`. Iemand die lid is van beide duo's kan geen walkover indienen (`ambiguous_duo`).
- **Opgave:** door beide duo's in te dienen, met `retiredSide`. Validatie: 1–3 sets; alle sets behalve de laatste moeten geldige eindstanden zijn; de laatste mag onafgemaakt zijn (0–6 per kant, nog niet beslist, incl. 5-5/6-5/6-6); een al beslist resultaat of een set ná de beslissing wordt geweigerd ("dien een gewone uitslag in"); de opgevende kant mag niet al gewonnen hebben. Aanvulling: lopende set naar 6-x / 7-5 / 7-6 voor de niet-opgevende kant, resterende sets 6-0. De voltooide uitslag wordt nog eens tegen `validateSets` gecontroleerd.
- Bevestigen/betwisten, auto-confirm, disputes en idempotentie zijn ongewijzigd (zelfde `submitScore`-transactie met rij-lock).
**Restrisico's:** een opgave tijdens een (super-)tiebreak wordt als games van de lopende set ingevoerd (bijv. 6-6 → 7-6); de tiebreakpunten zelf worden niet vastgelegd, en een match-tiebreak als 3e set wordt bij opgave als gewone set 6-x aangevuld. Walkover-"farming" (afspreken dat de ander niet komt) levert maximale ELO-winst op; de bestaande anti-manipulatiemaatregelen (herhaalde-tegenstander-demping, disputes, admin-review) gelden onverkort.

### 4. Uitstel in onderling overleg
**Wat:** tabel `challenge_postponement` (partial unique index: hooguit één `pending` per challenge; CHECK op de deadlines bij `accepted`). Service `src/server/services/postponementService.ts`, endpoints `GET/POST /api/challenges/[id]/postponement` en `POST /api/challenges/[id]/postponement/[postponementId]` (`accept`/`decline` door het andere duo, `cancel` door het vragende duo).
**Regels/keuzes:** alleen voor een `accepted` challenge vóór de speeltermijn en zolang er geen (niet-voided) score is; 1 ≤ dagen ≤ `postponement_max_days`; alleen **geaccepteerde** verzoeken tellen voor `postponement_max_per_challenge`; nieuwe deadline = deadline **op het moment van accepteren** + dagen (de deadline kan tussen verzoek en acceptatie nog wijzigen door een overturned dispute). De aanvrager kan nooit zelf accepteren, ook niet als lid van beide duo's. Aanvragen en accepteren nemen dezelfde rij-lock als `submitScore` en de unplayed-timeout-job (gedeelde helper `src/server/repositories/challengeLock.ts`) en controleren daarna alles opnieuw; statusovergangen zijn compare-and-swaps. De unplayed-timeout-job zet een nog openstaand verzoek in dezelfde transactie op `expired`. Alle acties → `audit_log` (`postponement_requested/accepted/declined/cancelled`).
**Restrisico:** een verzoek kan tot vlak voor de deadline worden ingediend; reageert het andere duo niet op tijd, dan volgt gewoon de forfeit (bewust: geen eenzijdig uitstel). Na een overturned dispute herstart de termijn, maar het aantal gebruikte uitstellen blijft staan.

### 5. E-mailnotificaties met afmeldvoorkeuren
**Wat:** `notification_preference` (per-user toggles, geen rij = alles aan) en `notification_log` (unique op user + soort + entiteit + `occurrence_key`). Service `src/server/services/notificationService.ts`, templates `src/lib/notifications/templates.ts` (tekst + eenvoudige HTML, Nederlands, link via `APP_BASE_URL`, afmeldhint naar `/profile`), voorkeuren `GET/PATCH /api/me/notification-preferences`. `sendEmail` accepteert nu een optionele `html` (Resend krijgt `text` + `html`).
**Soorten:** nieuwe uitdaging (uitgedaagd duo), herinnering reactietermijn (uitgedaagd duo), herinnering speeltermijn (beide duo's, alleen zonder score), score wacht op bevestiging + herinnering vóór auto-confirm (het duo dat moet bevestigen; één toggle `scoreConfirmation`), geschil afgehandeld (beide duo's), uitstel gevraagd (ander duo) / beantwoord (vragend duo; niet bij intrekken).
**Keuzes:**
- **Event-mails ná de commit** via `notifySafely`: fouten (DB of provider) worden gelogd en breken de hoofdactie nooit. Een idempotente herhaling van een score-indiening stuurt geen tweede mail.
- **Herinneringen** in de uurlijkse `/api/jobs/run-all` (ná de verloop-/bevestigingsjobs, en een fout daarin laat de rest van de run ongemoeid) en los via `/api/jobs/send-reminders`. Alleen deadlines in de toekomst binnen de lead-tijd. De deadline zit in de `occurrence_key`, zodat na een uitstel/overturned dispute wél een nieuwe herinnering volgt.
- **Nooit dubbel:** vóór verzending wordt de log-rij geclaimd (`createMany … skipDuplicates`); bij een mislukte verzending wordt de claim vrijgegeven, zodat de volgende jobrun het opnieuw probeert.
- Elke ontvanger krijgt een eigen mail; alleen actieve leden (`left_at IS NULL`) met een geactiveerd account; mails bevatten alleen duo-namen en de naam van de ontvanger, nooit e-mailadressen van anderen. Duo-namen en redenen worden in de HTML ge-escaped.
**Restrisico's:**
- Serverless: event-mails worden binnen het request afgewacht (niet fire-and-forget, dat kan op Vercel na het antwoord worden afgebroken); dat maakt de actie iets trager bij een trage provider (Resend-timeout 10 s per mail).
- Crasht het proces tussen claim en verzending, dan wordt die ene mail nooit verstuurd (bewust: liever één gemiste dan dubbele mail). Een permanent mislukkende herinnering wordt elk uur opnieuw geprobeerd tot de deadline verstreken is.
- Geen retry/queue voor event-mails; geen afmeldlink met token (afmelden vereist inloggen op `/profile`, dat de UI-redesign bouwt). `notification_log` groeit zonder opschoning.
- Met de default-afzender van Resend komen mails alleen aan op het eigen account-adres (zie "Post-v1 §2").

### API-overzicht (voor de UI)
- `GET /api/me/profile` → `MyProfile`; `PATCH /api/me/profile` `{ displayName?, knltbLevel?: 1–9 | null }` → `MyProfile`.
- `GET/PATCH /api/me/notification-preferences` → `{ preferences, labels }`; PATCH met een deel van de zes booleans.
- `POST /api/auth/register` `{ email, password, displayName? }`.
- `POST /api/duos/propose` `{ …, category?: "HEREN" | "DAMES" | "GEMENGD" }`; `PATCH /api/duos/[id]/category` `{ category: … | null }`.
- `GET /api/duos/invitations`: elke uitnodiging + `proposedByName`, `invitedUserName`, `region`.
- `POST /api/challenges/[id]/score`: `{ resultType?: "played", sets, idempotencyKey }` | `{ resultType: "walkover", idempotencyKey }` | `{ resultType: "retired", sets, retiredSide, idempotencyKey }`.
- `GET /api/duos/[id]/challenges`: matches met `resultType`, `concedingSide`, `playedScoreRaw`; per challenge `postponements`.
- `GET/POST /api/challenges/[id]/postponement`, `POST /api/challenges/[id]/postponement/[postponementId]` `{ action }`.
- Jobs: `/api/jobs/run-all` bevat nu `reminders`; nieuw `/api/jobs/send-reminders`.

**Deploy-volgorde:** eerst `npx prisma migrate deploy` (nieuwe kolommen/tabellen/config), dan de code — de nieuwe code leest `default_start_rating`, `postponement_*` en `notification_*` via `getConfigNumber` (harde fout als de rij ontbreekt).

### Productie-inrichting (2026-09-29)
**Wat:** het Vercel-project had géén enkele environment-variabele meer (vermoedelijk verloren bij het opnieuw koppelen van de repo op 17-08). Nu gezet: `JWT_SECRET`, `JOBS_SECRET`, `CRON_SECRET` (= JOBS_SECRET) voor production + preview, `APP_BASE_URL` voor production, en `DATABASE_URL` via de Neon-integratie (Vercel Marketplace). Een lege productiedatabase krijgt via de migraties tabellen + `platform_config`, maar geen regio's of admin: daarvoor is er `scripts/bootstrap-production.ts` (idempotent; `--region "<naam>"`, `--admin <email>` voor een bestaand geactiveerd account). `scripts/seed.ts` nooit tegen productie.
**Let op:** previews delen dezelfde Neon-database als productie (geen migraties vanuit previews, zie hierboven) — voor een pilot acceptabel; bij groei Neon-branches per preview gebruiken. E-mail (Resend) is bewust nog niet gekoppeld: activatielinks staan in de Vercel Function Logs.

---

## Integratie-UI KNLTB-aanvullingen (2026-09-29)

**Wat:** UI voor de eerder gebouwde backend: `/profile` (weergavenaam, zelf opgegeven KNLTB-speelsterkte, zes e-mailvoorkeuren), "Stel je naam in"-melding op het dashboard, weergavenaam verplicht bij registratie, walkover/opgave-invoer + weergave op challengekaarten en in de wedstrijdhistorie, uitstel aanvragen/accepteren/weigeren/intrekken, en uitleg daarvan op `/info`.
**API-wijzigingen (additief, behalve één):** dashboard geeft `partnerName` i.p.v. **`partnerEmail` (verwijderd — privacy)**; matches in `GET /api/duos/[id]/challenges` krijgen `submittedByDuoId` (zelfde regel als `respondToMatch`); `GET /api/duos/mine` krijgt `tierSize`, `position`, `ladderSize`; wedstrijdhistorie krijgt `resultType`, `concededBy`, `playedScore`; `ApiError` draagt nu de API-`code`.
**Seed:** extra regio Zwolle (users 21–27, drie duo's met geaccepteerde challenges) uitsluitend voor e2e 08–10; de Utrecht-ladder blijft ongewijzigd.
**Tests:** e2e 08 (profiel), 09 (walkover + opgave), 10 (uitstel) toegevoegd; volledige suite 16/16 groen. Assertion-timeout in Playwright naar 15s (on-demand compile in de dev-server); registratieformulier kreeg `noValidate` zodat de eigen Nederlandse validatie i.p.v. de browserpopup verschijnt.
**Restpunt:** bestaande accounts zonder naam zien een neutrale fallback ("Speler XXXXXX") tot ze er een instellen; er is geen dwang.
