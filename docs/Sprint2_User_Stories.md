# Sprint 2 — User Stories: Challenge Engine met Rank-tiers (Epic E)

## Sprintdoel

Een duo kan zien welke andere duo's het mag uitdagen (binnen dezelfde rating-tier), een uitdaging versturen, en de uitgedaagde partij kan accepteren of weigeren. Reageert de uitgedaagde partij niet binnen de reactietermijn, dan verloopt de challenge automatisch en volgt een forfeit-penalty.

**Afhankelijkheid:** bouwt voort op Sprint 1 (auth, multi-duo, ladder).
**Expliciet buiten Sprint 2:** score-invoer, matchbevestiging, ELO-berekening na een gespeelde wedstrijd, en de "moet ook echt gespeeld worden"-regel (`unplayed_timeout`) — die vereisen een werkende Match-registratie en volgen in **Sprint 3**. In Sprint 2 bestaat het `match_deadline`-veld al in het schema, maar de handhaving ervan wordt pas in Sprint 3 gebouwd.

---

## US-E1 — Uitdaagbare tegenstanders zien
**Als** lid van een actief duo
**wil ik** in de ladder-view alleen de duo's zien die ik daadwerkelijk mag uitdagen
**zodat** ik niet per ongeluk een ongeldige uitdaging probeer te versturen.

**Acceptatiecriteria:**
- Elk duo in de ladder toont zijn rating-tier (FR-3.5), berekend als `floor(current_rating / tier_size)` met `tier_size` uit `platform_config`.
- Duo's binnen dezelfde tier als mijn duo zijn visueel gemarkeerd als "uitdaagbaar"; andere duo's niet.
- Als mijn duo al een actieve challenge heeft (als uitdager of uitgedaagde), zijn alle "uitdagen"-knoppen uitgeschakeld met een duidelijke tooltip/melding (FR-4.1).

## US-E2 — Duo uitdagen
**Als** lid van een actief duo zonder actieve challenge
**wil ik** een ander duo binnen mijn tier uitdagen
**zodat** we een wedstrijd kunnen plannen.

**Acceptatiecriteria:**
- Uitdagen is alleen mogelijk richting een duo in dezelfde rating-tier (FR-4.2); een poging daarbuiten wordt hard geweigerd (ook als de UI-check om wat voor reden dan ook gemist wordt — server-side validatie is leidend).
- Bij aanmaak krijgt de challenge status `pending` en een `response_deadline` = nu + `challenge_response_deadline_days` uit `platform_config` (richtwaarde 5 dagen).
- Ik kan geen tweede actieve challenge starten zolang mijn duo er al één heeft (FR-4.1).
- Ik kan geen duo uitdagen dat zelf al een actieve challenge heeft (als uitdager of uitgedaagde).

## US-E3 — Uitdaging accepteren of weigeren
**Als** uitgedaagde partij
**wil ik** een challenge kunnen accepteren of weigeren
**zodat** we alleen wedstrijden spelen die beide partijen willen.

**Acceptatiecriteria:**
- Accepteren zet status op `accepted`, zet `accepted_at`, en berekent `match_deadline` = `accepted_at` + `challenge_match_deadline_days` (richtwaarde 14 dagen) — dit veld wordt in Sprint 3 daadwerkelijk gehandhaafd.
- Weigeren zet status op `declined`; beide duo's kunnen daarna weer nieuwe challenges aangaan.
- Alleen leden van het uitgedaagde duo mogen accepteren/weigeren (autorisatiecheck).
- Reeds verlopen challenges (voorbij `response_deadline`) kunnen niet meer geaccepteerd worden — toon een duidelijke melding i.p.v. een silent-fail.

## US-E4 — Automatische expiratie en forfeit-penalty bij niet reageren
**Als** systeem
**wil ik** challenges die niet tijdig beantwoord zijn automatisch laten verlopen én een penalty toepassen
**zodat** duo's niet vrijblijvend uitdagingen kunnen negeren.

**Acceptatiecriteria:**
- Een achtergrondjob (of gelijkwaardig mechanisme) zet `pending`-challenges met een verstreken `response_deadline` om naar status `expired`.
- Bij het zetten van `expired` krijgt **uitsluitend de uitgedaagde duo** een vaste rating-penalty (`forfeit_rating_penalty` uit `platform_config`, richtwaarde 10), toegepast conform ELO_Algoritme.md §8bis: geen ELO-formule, wel een `RatingHistory`-record met `is_forfeit = true` en `challenge_id` gevuld (geen `match_id`).
- Na de penalty geldt voor het uitgedaagde duo een cooldown (`forfeit_cooldown_days`) voordat het weer een challenge kan aangaan of ontvangen.
- Deze verwerking is idempotent: een job die twee keer over dezelfde verlopen challenge draait, past de penalty niet dubbel toe.

## US-E5 — Overzicht van challenges per duo
**Als** lid van een duo
**wil ik** een overzicht van actieve en afgelopen challenges van dat duo
**zodat** ik weet wat de status is en wat er van ons verwacht wordt.

**Acceptatiecriteria:**
- Overzicht toont per challenge: tegenstander, status, `response_deadline` (indien `pending`), `match_deadline` (indien `accepted`).
- Statusverandering (bijv. net geaccepteerd, net verlopen) is direct zichtbaar zonder handmatige refresh nodig te hebben (redelijke polling/interval is voldoende, geen harde realtime-eis).

---

## Sprint 2 — Review, Test & Presentatie (verplicht vóór start Sprint 3)

Zie het generieke protocol in `Claude_Code_Bouwplan.md` §8. Concreet voor deze sprint:

- [ ] Unit tests voor tier-berekening (`getTier`) en forfeit-penalty-toepassing (`applyForfeitPenalty`), los van de database.
- [ ] Test die aantoont dat een uitdaging buiten de eigen tier hard geweigerd wordt, ook al zou de UI dat toestaan.
- [ ] Test voor idempotentie van de expiratie-job (twee keer draaien = één penalty).
- [ ] Demo aan PO: laat zien dat (a) alleen tier-genoten uitdaagbaar zijn, (b) een niet-beantwoorde challenge na het verstrijken van de deadline automatisch `expired` wordt met de juiste penalty in `RatingHistory`.
- [ ] Expliciete go/no-go van de PO voordat Sprint 3 start.
