# Sprint 3 — User Stories: Matches, ELO-verwerking & Speelverplichting (Epic F)

## Sprintdoel

Een geaccepteerde challenge kan daadwerkelijk resulteren in een geregistreerde, bevestigde wedstrijd, die vervolgens transactioneel tot een rating-update leidt volgens het ELO-model. Wordt er niet binnen de speeltermijn een bevestigde wedstrijd geregistreerd, dan treedt de `unplayed_timeout`-forfeit in werking (voor beide duo's).

**Afhankelijkheid:** bouwt voort op Sprint 2 (challenge moet `accepted` zijn voordat een match geregistreerd kan worden).
**Expliciet buiten Sprint 3:** de dispute-flow zelf (openen/beoordelen van geschillen) — dat is **Sprint 4**. In Sprint 3 kan een score wel als "betwist" gemarkeerd worden (status `disputed`), maar de admin-afhandeling daarvan volgt later.

---

## US-F1 — Score indienen na een geaccepteerde challenge
**Als** lid van een duo met een `accepted` challenge
**wil ik** de einduitslag van de wedstrijd invoeren
**zodat** de wedstrijd verwerkt kan worden.

**Acceptatiecriteria:**
- Score-invoer is alleen mogelijk bij challenges met status `accepted`, vóór het verstrijken van `match_deadline`.
- Bij indiening wordt een `Match` aangemaakt met status `awaiting_confirmation`, `submitted_by` = de indienende gebruiker, en `auto_confirm_deadline` = nu + een configureerbare termijn (richtwaarde: te bepalen, bijv. 48 uur).
- Score-invoer vereist een client-gegenereerde `idempotency_key`; een herhaalde submit met dezelfde key resulteert niet in een tweede Match (FR-5.5).
- Alleen leden van de twee betrokken duo's mogen een score indienen voor die challenge.

## US-F2 — Score bevestigen door de tegenstander
**Als** lid van het andere duo bij die wedstrijd
**wil ik** de ingediende score bevestigen of betwisten
**zodat** de uitslag pas definitief wordt met wederzijdse instemming (FR-5.2).

**Acceptatiecriteria:**
- Bevestigen zet `Match.status = completed`, `confirmed_by`, `confirmed_at`, en triggert de ELO-verwerking (US-F4).
- Betwisten zet `Match.status = disputed` en maakt de wedstrijd beschikbaar voor de dispute-flow van Sprint 4 (geen automatische ELO-verwerking totdat de dispute is opgelost).
- Alleen leden van het duo dat de score niet heeft ingediend, mogen bevestigen/betwisten.

## US-F3 — Automatische bevestiging bij timeout
**Als** systeem
**wil ik** een ingediende score automatisch bevestigen als de tegenstander niet reageert
**zodat** een wedstrijd niet eindeloos "hangt" (FR-5.3).

**Acceptatiecriteria:**
- Een achtergrondjob zet `Match`-rijen met status `awaiting_confirmation` en verstreken `auto_confirm_deadline` om naar `completed`, en triggert vervolgens dezelfde ELO-verwerking als een handmatige bevestiging.
- Deze auto-bevestiging is duidelijk als zodanig gelabeld (bijv. in de audit log), zodat achteraf te zien is dat het geen actieve bevestiging was.

## US-F4 — ELO-verwerking na een voltooide match
**Als** systeem
**wil ik** bij elke `completed` match de rating van beide duo's transactioneel bijwerken
**zodat** de ladder altijd een correcte, actuele afspiegeling is (FR-6.1 t/m FR-6.4).

**Acceptatiecriteria:**
- Verwerking volgt exact het model uit `ELO_Algoritme.md` (§2–§7): `expectedScore`, K-factor per duo-status, rating-cap, demping bij herhaalde tegenstanders.
- Per match worden **twee** `RatingHistory`-records aangemaakt (één per duo), met `is_forfeit = false`, `match_id` gevuld, `k_factor` gevuld.
- De update van `Duo.current_rating` (voor beide duo's) en het aanmaken van de twee `RatingHistory`-records gebeurt in **één databasetransactie**; bij een fout rollt alles terug (geen halve verwerking).
- Alle unit tests uit `ELO_Algoritme.md` §8 slagen tegen de daadwerkelijke implementatie (niet alleen tegen de pseudocode).

## US-F5 — Unplayed timeout: forfeit bij niet spelen binnen de termijn
**Als** systeem
**wil ik** een `accepted` challenge waarvoor geen bevestigde match bestaat bij het verstrijken van `match_deadline` markeren als `unplayed_timeout`
**zodat** duo's niet eindeloos kunnen uitstellen (FR-4.5).

**Acceptatiecriteria:**
- Achtergrondjob controleert challenges met status `accepted` en verstreken `match_deadline` zonder een gekoppelde `completed` match.
- Bij het zetten van `unplayed_timeout` krijgen **beide** duo's de vaste forfeit-penalty (zelfde mechanisme als US-E4 in Sprint 2), elk met een eigen `RatingHistory`-record (`is_forfeit = true`, `challenge_id` gevuld).
- Beide duo's krijgen daarna de forfeit-cooldown.
- Is er een match met status `awaiting_confirmation` of `disputed` op het moment van de deadline, dan wordt de challenge **niet** als `unplayed_timeout` gemarkeerd (er is immers wél actie ondernomen) — dit valt verder onder de dispute-flow van Sprint 4.

## US-F6 — Ratingverandering zichtbaar maken
**Als** lid van een duo
**wil ik** direct zien hoeveel mijn rating is veranderd na een wedstrijd of forfeit
**zodat** ik begrijp waarom mijn positie wijzigt (FR-7.4).

**Acceptatiecriteria:**
- UI toont bij een recente wedstrijd expliciet "+N" of "−N" rating, met duidelijk onderscheid tussen een wedstrijdresultaat en een forfeit-penalty (bijv. ander label/icoon).
- Ratinggeschiedenis (uit `RatingHistory`) is chronologisch inzichtelijk per duo.

---

## Sprint 3 — Review, Test & Presentatie (verplicht vóór start Sprint 4)

- [ ] Volledige unit test-suite voor de ELO-module (§8 van ELO_Algoritme.md) draait tegen de echte implementatie, niet alleen tegen pseudocode.
- [ ] Integratietest: complete flow challenge → accepted → score ingediend → bevestigd → rating van beide duo's correct bijgewerkt, in één transactie.
- [ ] Test voor idempotentie van score-indiening (dubbele submit met dezelfde `idempotency_key` geeft geen dubbele Match/rating-update).
- [ ] Test voor `unplayed_timeout`: beide duo's krijgen de penalty; geen penalty als er een match in `awaiting_confirmation`/`disputed` hangt.
- [ ] Demo aan PO: laat een volledige challenge-naar-rating-cyclus zien, inclusief een expres niet-tijdig gespeelde challenge die tot `unplayed_timeout` leidt.
- [ ] Expliciete go/no-go van de PO voordat Sprint 4 start.
