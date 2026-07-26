# Sprint 1 — User Stories

## Sprintdoel

Aan het einde van Sprint 1 kan een gebruiker: registreren, een account activeren, inloggen, een duo vormen met een tweede gebruiker, en de (nog statische) ladder van de eigen regio bekijken met de eigen positie erin.

**Expliciet buiten Sprint 1:** challenges, matches, ELO-berekening, disputes. Ladderpositie is in Sprint 1 dus nog gebaseerd op de vaste startrating (1200) van elk duo — de rating verandert pas vanaf Sprint 2 (wanneer matches verwerkt kunnen worden).

---

## Epic A — Authenticatie & Account

### US-A1 — Registreren met e-mail en wachtwoord
**Als** nieuwe gebruiker
**wil ik** een account aanmaken met mijn e-mailadres en een wachtwoord
**zodat** ik toegang krijg tot het platform.

**Acceptatiecriteria:**
- Gegeven een geldig, nog niet gebruikt e-mailadres en een wachtwoord dat aan de complexiteitseisen voldoet, wanneer ik registreer, dan wordt er een account aangemaakt met status `is_active = false`.
- Het wachtwoord wordt gehashed opgeslagen (nooit plaintext, ook niet in logs).
- Bij een reeds bestaand e-mailadres krijg ik een duidelijke foutmelding zonder te onthullen of het account bestaat vanwege privacy (generieke melding).
- Na registratie ontvang ik een activatie-e-mail met een unieke, verlopende link.

### US-A2 — Account activeren
**Als** net geregistreerde gebruiker
**wil ik** mijn account activeren via een link in mijn e-mail
**zodat** ik kan inloggen en verder kan met het platform.

**Acceptatiecriteria:**
- Klikken op een geldige, niet-verlopen activatielink zet `is_active = true` en `activated_at` op het huidige tijdstip.
- Een verlopen of reeds gebruikte link geeft een duidelijke foutmelding, met optie om een nieuwe activatiemail aan te vragen.
- Inloggen is niet mogelijk zolang `is_active = false`.

### US-A3 — Inloggen
**Als** geactiveerde gebruiker
**wil ik** inloggen met e-mail en wachtwoord
**zodat** ik toegang krijg tot mijn dashboard.

**Acceptatiecriteria:**
- Correcte combinatie van e-mail/wachtwoord resulteert in een geldige sessie/JWT.
- Foutieve combinatie geeft een generieke foutmelding (geen onderscheid tussen "onbekend e-mailadres" en "fout wachtwoord").
- Na een instelbaar aantal mislukte pogingen wordt rate limiting toegepast op het login-endpoint.

---

## Epic B — Duo Management

### US-B1 — Duo voorstellen aan een andere gebruiker
**Als** ingelogde, geactiveerde gebruiker
**wil ik** een andere geregistreerde gebruiker uitnodigen om samen een duo te vormen
**zodat** wij samen aan de ladder kunnen deelnemen — ook als ik al in andere duo's zit.

**Acceptatiecriteria:**
- Ik kan een duo-naam, regio en het e-mailadres van mijn beoogde partner invoeren.
- Het voorstel krijgt een status `pending` totdat de andere gebruiker bevestigt.
- Ik kan lid zijn van **meerdere actieve duo's tegelijk**, tot een configureerbaar maximum (`max_active_duos_per_user`, richtwaarde 3–5, default 5, FR-1.4). Bij het bereiken van dat maximum krijg ik een duidelijke foutmelding bij een nieuw voorstel.
- Ik kan geen duo voorstellen aan iemand met wie ik al een **actief** duo heb (FR-2.3 — hetzelfde koppel kan niet twee keer tegelijk een actief duo vormen). Ik kan wel een nieuw duo voorstellen aan iemand met wie ik eerder een duo had dat inmiddels ontbonden is.
- Ik kan mijzelf niet uitnodigen.

### US-B2 — Duo-voorstel bevestigen
**Als** uitgenodigde gebruiker
**wil ik** een duo-voorstel accepteren of weigeren
**zodat** het duo pas ontstaat met wederzijdse instemming.

**Acceptatiecriteria:**
- Bij acceptatie wordt de duo `is_active = true` en verschijnen beide gebruikers als lid (2 rijen in `duo_membership`, `left_at IS NULL`).
- Bij weigering blijft er geen actief duo-voorstel bestaan; beide gebruikers kunnen een nieuw voorstel doen.
- Acceptatie wordt geweigerd (met duidelijke foutmelding) als één van beide gebruikers daarmee het maximum aantal actieve duo's zou overschrijden, of als het koppel al een ander actief duo samen heeft.
- Een gebruiker kan tegelijkertijd in meerdere duo's zitten, elk met een eigen, onafhankelijke rating (FR-6.1).

### US-B3 — Duo ontbinden
**Als** lid van een actief duo
**wil ik** het duo kunnen ontbinden
**zodat** ik (na de cooldown) een nieuw duo kan vormen.

**Acceptatiecriteria:**
- Ontbinding vereist bevestiging van beide leden (of expliciete admin-override, buiten scope Sprint 1).
- Na ontbinding wordt `dissolution_requested_at` gezet; het duo verdwijnt direct uit de actieve ladder (`is_active = false`).
- Beide voormalige leden kunnen pas een nieuw duo vormen na het verstrijken van de cooldown-periode (exacte duur: configuratiewaarde, zie PRD open vraag §14).
- Historische gegevens van het ontbonden duo blijven raadpleegbaar (niet hard-deleten).

---

## Epic C — Ladder (read-only in Sprint 1)

### US-C1 — Ladder van mijn regio bekijken
**Als** lid van een actief duo
**wil ik** de ladder van mijn regio zien, gesorteerd op rating
**zodat** ik weet waar ik sta ten opzichte van anderen.

**Acceptatiecriteria:**
- De ladder toont alleen actieve duo's (`is_active = true`) binnen de gekozen regio.
- Sortering is aflopend op `current_rating`; bij gelijke rating op `created_at` (oudste eerst) als tiebreaker.
- Ladderpositie wordt live berekend (geen los opgeslagen positieveld — conform FR-3.3), bijvoorbeeld via een `RANK()`-window function.
- Mijn eigen duo is visueel gemarkeerd in de lijst.

### US-C2 — Eigen dashboard met rank en nabije tegenstanders
**Als** lid van één of meerdere actieve duo's
**wil ik** op mijn dashboard per duo mijn rank en de duo's vlak boven en onder mij zien
**zodat** ik in één oogopslag de positie van elk van mijn duo's begrijp.

**Acceptatiecriteria:**
- Dashboard toont een kaart/sectie per actief duo waarvan ik lid ben: duo-naam, huidige rating, huidige ladderpositie, regio.
- Per duo toont het dashboard de 3 duo's direct boven en de 3 duo's direct onder die positie (of minder, als de ladder korter is).
- Als ik nog geen enkel actief duo heb, toont het dashboard een duidelijke call-to-action om er één te vormen (link naar US-B1).
- Als ik al één of meer actieve duo's heb maar nog niet het maximum (FR-1.4), blijft de call-to-action "nieuw duo vormen" zichtbaar naast mijn bestaande duo's.

---

## Epic D — Admin & Data (technische randvoorwaarde voor Sprint 1)

### US-D1 — Regio's beheren (seed/admin)
**Als** admin
**wil ik** regio's kunnen aanmaken
**zodat** duo's zich daaraan kunnen koppelen.

**Acceptatiecriteria:**
- Admin kan via een (minimale, eventueel niet-UI) interface een regio aanmaken met naam en slug.
- Voor de pilot (PRD §13) is minimaal 1 regio vooraf aangemaakt via een seed-script.

### US-D2 — Testdata seeden voor development/QA
**Als** ontwikkelaar/QA
**wil ik** een seed-script dat realistische testdata genereert (regio, gebruikers, duo's)
**zodat** de ladder-view en duo-flows getest kunnen worden zonder handmatige setup.

**Acceptatiecriteria:**
- Seed-script maakt minimaal: 1 regio, 20 gebruikers, 10 actieve duo's met variërende (vaste, niet via matches berekende) startratings.
- Script is herhaalbaar (idempotent) op een lege/dev-database.

---

## Vervolg: Sprint 2 t/m 5

De volgende epics zijn inmiddels volledig uitgewerkt als losse documenten en zijn dus **geen** onderdeel van Sprint 1:

- **Sprint2_User_Stories.md — Epic E: Challenges met rank-tiers**
- **Sprint3_User_Stories.md — Epic F: Matches, ELO-verwerking & speelverplichting**
- **Sprint4_User_Stories.md — Epic G: Disputes**
- **Sprint5_User_Stories.md — Epic H: Beschikbaarheid & externe API**

Elke sprint kent aan het eind een verplicht review/test/presentatie-moment voordat de volgende start — zie `Claude_Code_Bouwplan.md` §8.

## Definition of Done (Sprint 1, geldt voor alle stories)

- [ ] Unit tests voor business-logica (bijv. "één actief duo per user"-regel, activatie-flow).
- [ ] Input-validatie op alle nieuwe endpoints.
- [ ] Geen plaintext wachtwoorden, ook niet in logs of foutmeldingen.
- [ ] Mobile-first UI getest op minimaal 1 klein (mobiel) en 1 groot (desktop) breakpoint.
- [ ] Code + migratiescripts in versiebeheer, met werkende `dev`-omgevingsconfiguratie.
