# Sprint 4 — User Stories: Disputes (Epic G)

## Sprintdoel

Geschillen — zowel over een betwiste score (`match_score`) als over een onterecht opgelegde forfeit-penalty (`forfeit`) — kunnen door spelers worden aangekaart en door een admin worden beoordeeld en opgelost, met correcte doorwerking in de rating.

**Afhankelijkheid:** bouwt voort op Sprint 3 (matches en forfeit-penalty's moeten al bestaan om ze te kunnen betwisten).

---

## US-G1 — Score-dispute openen
**Als** lid van een duo betrokken bij een match met status `disputed` (zie US-F2)
**wil ik** een reden voor de betwisting kunnen vastleggen
**zodat** een admin het geschil kan beoordelen.

**Acceptatiecriteria:**
- Een `Dispute` met `subject = match_score` wordt gekoppeld aan de betreffende `match_id` (nooit aan een `challenge_id` tegelijk, zie DB-constraint).
- Status start op `open`.
- Er kan maximaal één open dispute per match bestaan (unique index in schema).
- Alleen leden van de twee betrokken duo's kunnen een dispute openen.

## US-G2 — Forfeit-dispute openen bij `unplayed_timeout`
**Als** lid van een duo dat een forfeit-penalty kreeg door `unplayed_timeout`
**wil ik** kunnen aangeven dat de andere partij in gebreke bleef (bijv. niet wilde plannen)
**zodat** de penalty eventueel eenzijdig toegewezen kan worden i.p.v. aan beide duo's (FR-4.5).

**Acceptatiecriteria:**
- Een `Dispute` met `subject = forfeit` wordt gekoppeld aan de `challenge_id` (niet aan een match).
- Dit kan alleen binnen een beperkte termijn na het ontstaan van de `unplayed_timeout`-status (richtwaarde: te bepalen, bijv. 5 dagen) — daarna is de uitkomst definitief.
- Reden/toelichting is verplicht (vrij tekstveld).

## US-G3 — Admin: dispute beoordelen en oplossen
**Als** admin
**wil ik** openstaande disputes beoordelen en een besluit vastleggen
**zodat** geschillen eerlijk en traceerbaar worden afgehandeld.

**Acceptatiecriteria:**
- Admin-overzicht toont alle `open` disputes, met onderliggende context: bij `match_score` de ingediende score + wie wat heeft ingevoerd; bij `forfeit` de challenge-historie (wie heeft wanneer gereageerd/geaccepteerd).
- Bij resolutie van een `match_score`-dispute kan de admin: de oorspronkelijke score alsnog laten gelden (`resolved_upheld`, match alsnog naar `completed` + normale ELO-verwerking), of de match ongeldig verklaren (`resolved_overturned`, match naar `voided`, geen rating-impact).
- Bij resolutie van een `forfeit`-dispute kan de admin: de bestaande penalty bij beide duo's laten staan (`resolved_upheld`), of de penalty bij één specifieke partij terugdraaien en (opnieuw) uitsluitend bij de andere partij toepassen (`resolved_overturned`) — dit gebeurt via een gecorrigeerd `RatingHistory`-record, niet door het originele record te wijzigen (auditability: de oorspronkelijke penalty blijft zichtbaar, met een duidelijk gekoppelde correctie).
- Elke resolutie wordt vastgelegd in `Dispute.resolved_by`, `resolved_at`, en in de audit log met de motivatie.

## US-G4 — Audit log voor dispute-resoluties
**Als** admin of platformbeheerder
**wil ik** kunnen zien welke disputes wanneer door wie zijn opgelost, en met welk effect op de rating
**zodat** het proces transparant en controleerbaar blijft.

**Acceptatiecriteria:**
- Elke dispute-resolutie genereert een `audit_log`-record met `action = dispute_resolved`, de betrokken entiteiten, en de eventuele rating-correctie in de `payload`.
- Audit log is alleen zichtbaar voor admins.

---

## Sprint 4 — Review, Test & Presentatie (verplicht vóór start Sprint 5)

- [ ] Unit tests voor beide dispute-paden (`match_score`, `forfeit`) inclusief de constraint dat een dispute nooit aan zowel een match als een challenge gekoppeld is.
- [ ] Test dat een rating-correctie na een `resolved_overturned` forfeit-dispute traceerbaar blijft (oorspronkelijke penalty + correctie beide zichtbaar in `RatingHistory`/audit log, niets wordt overschreven).
- [ ] Test dat niet-admins geen disputes kunnen resolven.
- [ ] Demo aan PO: doorloop beide dispute-scenario's end-to-end (openen → admin beoordeelt → rating-effect klopt).
- [ ] Expliciete go/no-go van de PO voordat Sprint 5 start.
