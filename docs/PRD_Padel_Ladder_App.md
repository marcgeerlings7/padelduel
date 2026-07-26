# Product Requirements Document (PRD)
## Padel Ladder Platform — Vereniging-onafhankelijke Ranked Ladder voor Padel Duo's

| | |
|---|---|
| **Documentstatus** | Concept v1.1 |
| **Datum** | 26 juli 2026 |
| **Auteur** | Product/Engineering (opgesteld o.b.v. technische briefing) |
| **Doelgroep** | Engineering, Design, QA, Stakeholders |

---

## Wijzigingslog

| Versie | Wijziging |
|---|---|
| v1.0 | Initiële PRD op basis van technische briefing |
| v1.1 | (1) Gebruikers kunnen lid zijn van meerdere duo's tegelijk (3–5, configureerbaar) i.p.v. precies één. (2) Rank-restrictie bij uitdagen vervangen van "±3 ladderposities" naar rating-tiers (banden van configureerbare grootte, bijv. 100 punten). (3) Na een uitdaging wordt zowel het *reageren* als het *daadwerkelijk spelen* afgedwongen, met consequenties bij het uitblijven daarvan. (4) Nieuwe epic: duo's kunnen recidiverende beschikbaarheid doorgeven; een externe API ontsluit die beschikbaarheid voor clubsystemen. Dit is uitdrukkelijk **geen** baanreservering — zie herziene non-goals in §4. |

---

## 1. Samenvatting

Het Padel Ladder Platform is een web-applicatie waarmee padelspelers als duo kunnen deelnemen aan regionale ranked ladders, vergelijkbaar met ClanBase-achtige ladders uit de esportswereld. Spelers kunnen lid zijn van meerdere duo's tegelijk. Duo's dagen elkaar uit binnen hun eigen rating-tier, spelen wedstrijden en klimmen of dalen op basis van een ELO-achtig ratingsysteem. Duo's kunnen daarnaast hun terugkerende beschikbaarheid doorgeven, die via een API ontsloten wordt richting externe (club-)systemen. Het platform is vereniging-onafhankelijk: het bouwt zelf geen baanreservering.

Dit document beschrijft **wat** er gebouwd moet worden en **waarom**, als basis voor een engineeringteam om architectuur, API's, databaseontwerp en implementatie uit te werken.

---

## 2. Probleemstelling & Achtergrond

Padelspelers die serieus willen concurreren buiten clubverband hebben geen laagdrempelige, eerlijke manier om zich te meten met duo's van vergelijkbaar niveau. Bestaande oplossingen zijn vaak clubgebonden, handmatig bijgehouden (WhatsApp-groepen, spreadsheets) of ontbreken volledig. Daarnaast spelen veel spelers in wisselende samenstellingen (met verschillende vaste partners), en is het lastig om te zien wanneer een tegenstander daadwerkelijk beschikbaar is om te spelen. Er is behoefte aan:

- Een objectief, dynamisch rankingsysteem per regio, per duo-combinatie.
- Een gestructureerde manier om wedstrijden uit te dagen, te registreren én daadwerkelijk te laten plaatsvinden.
- Inzicht in beschikbaarheid, zodat clubs en spelers weten wanneer er animo is om te spelen.

## 3. Doelen (Goals)

| # | Doel | Meetbaar aan |
|---|------|--------------|
| G1 | Spelers kunnen lid zijn van meerdere duo's en deelnemen aan regionale ladders | Multi-duo-lidmaatschap end-to-end functioneel, met maximum gehandhaafd |
| G2 | Duo's kunnen elkaar op een eerlijke, geregelde manier uitdagen binnen hun rating-tier | Tier-indeling correct berekend; uitdagingen buiten tier geweigerd |
| G3 | Uitgedaagde duo's reageren én spelen daadwerkelijk, of ondervinden consequenties | 100% van challenges heeft een eindstatus (completed/expired/unplayed_timeout) met bijbehorende enforcement |
| G4 | Wedstrijdresultaten leiden tot een betrouwbare, herleidbare rating-update | 100% van matches heeft bijbehorende RatingHistory-log |
| G5 | Duo's kunnen beschikbaarheid doorgeven die extern (clubsystemen) opvraagbaar is | Werkende, geauthenticeerde API voor externe consumptie |
| G6 | Platform is geschikt voor een pilot met 1 regio en ~20 duo's zonder handmatige correcties | Pilot draait 4+ weken zonder data-inconsistenties |

## 4. Niet-doelen (Non-Goals / Expliciet buiten scope)

Om scope-creep te voorkomen wordt in v1 **niet** gebouwd:

- Chatfunctionaliteit tussen spelers
- Social feed / activity stream
- Club-administratie (ledenbeheer, contributie, etc.)
- **Baanreservering in de zin van: het daadwerkelijk boeken/blokkeren van een baan, betalingen, of agenda-integratie.** We bouwen wél de mogelijkheid voor duo's om terugkerende beschikbaarheid door te geven, en een API die dat voor externe (club-)systemen ontsluit — maar het reserveren zelf blijft de verantwoordelijkheid van die externe systemen (zie Epic F, §7.8).
- Advertenties / monetisatie

Deze kunnen in een latere fase heroverwogen worden, maar vallen expliciet buiten v1.

## 5. Doelgroep & Persona's

**Persona 1 — Competitieve recreant ("Mark, 34")**
Speelt met meerdere vaste partners in verschillende duo's, wil weten hoe elk van die duo's presteert t.o.v. anderen in de regio.

**Persona 2 — Regio-organisator / early adopter ("Lisa, 29")**
Wil een ladder opzetten voor haar regio, nodigt duo's uit, bewaakt (indirect) de kwaliteit van de competitie.

**Persona 3 — Beheerder/Admin**
Heeft rolgebaseerde toegang om disputes te beoordelen (inclusief forfeit-geschillen), misbruik te signaleren en regio's te beheren.

**Persona 4 — Extern clubsysteem (machine-to-machine)**
Roept de beschikbaarheids-API aan om te zien wanneer duo's in de regio willen spelen, ten behoeve van eigen baanplanning.

## 6. Aannames & Randvoorwaarden

- Start met **één regio** als pilot voordat wordt opgeschaald.
- Het maximumaantal actieve duo's per gebruiker is **configureerbaar, richtwaarde 3–5** (default voorstel: 5).
- Twee specifieke gebruikers kunnen niet tegelijk **meer dan één actief duo samen** hebben (voorkomt verwarrende dubbele registraties van hetzelfde koppel).
- Wedstrijden worden fysiek gespeeld; het platform registreert resultaten en beschikbaarheid, maar boekt zelf geen banen.

---

## 7. Functionele Requirements

### 7.1 Authenticatie & Accountbeheer
- FR-1.1: Gebruiker kan registreren met e-mail + wachtwoord.
- FR-1.2: Wachtwoorden worden gehashed opgeslagen (nooit plaintext).
- FR-1.3: Account moet geactiveerd worden voordat het duo's/challenges kan aangaan.
- FR-1.4: Een gebruiker kan lid zijn van **meerdere actieve duo's tegelijk**, tot een configureerbaar maximum (richtwaarde 3–5, default 5).
- FR-1.5: Rolgebaseerde toegang: `user` en `admin` (en machine-toegang via API-clients, zie §7.8).

### 7.2 Duo Management
- FR-2.1: Een duo bestaat uit exact twee gebruikers, een naam, een regio, een actieve status en een huidige ELO-rating **die uniek is voor die specifieke duo-combinatie**.
- FR-2.2: Duo-aanmaak vereist bevestiging van beide spelers.
- FR-2.3: Dezelfde twee gebruikers kunnen niet tegelijkertijd een tweede actief duo samen vormen.
- FR-2.4: Duo-ontbinding alleen mogelijk na cooldown; ontbonden duo blijft historisch traceerbaar.
- FR-2.5: Het aantal actieve duo's van een gebruiker mag het configureerbare maximum (FR-1.4) niet overschrijden; een poging daartoe wordt geweigerd met een duidelijke melding.

### 7.3 Ladder Systeem
- FR-3.1: Elke regio heeft een eigen ladder.
- FR-3.2: Ladder toont uitsluitend actieve duo's, gesorteerd op ELO-rating.
- FR-3.3: Ladderpositie is een **afgeleide** waarde, geen los opgeslagen veld.
- FR-3.4: Ladder is filterbaar (regio, eigen positie ±N).
- FR-3.5: De ladder toont ook een **rating-tier** per duo (zie FR-4.2) zodat direct zichtbaar is wie wie mag uitdagen.

### 7.4 Challenge Rules Engine
- FR-4.1: Een duo kan maximaal **1 actieve challenge** tegelijk hebben (als uitdager of uitgedaagde).
- FR-4.2: **Rank-tier restrictie (vervangt de eerdere ±3-ladderposities-regel):** duo's zijn ingedeeld in rating-tiers — banden van een configureerbare breedte (richtwaarde: 100 ratingpunten per tier). Een duo mag alleen duo's uitdagen die zich in dezelfde tier bevinden. Tier-indeling wordt live berekend uit `current_rating` (`tier = floor(current_rating / tier_size)`), niet apart opgeslagen — analoog aan de ladderpositie (FR-3.3).
- FR-4.3: Challenge-statussen: `pending → accepted → completed`, `pending → expired` (geen reactie), of `accepted → unplayed_timeout` (geen voltooide wedstrijd binnen de speeltermijn).
- FR-4.4: **Afgedwongen reactie:** een challenge verloopt automatisch na een configureerbare termijn (richtwaarde 5 dagen) zonder reactie van de uitgedaagde. Het uitblijven van een reactie is geen vrijblijvende non-actie: de uitgedaagde duo krijgt een vaste, beperkte rating-penalty (richtwaarde −10, geen volledige ELO-berekening) en een korte cooldown voordat het opnieuw kan uitdagen of uitgedaagd worden.
- FR-4.5: **Afgedwongen speelverplichting:** na acceptatie start een speeltermijn (richtwaarde 14 dagen, configureerbaar). Is er bij het verstrijken daarvan geen bevestigde `Match`, dan krijgt de challenge status `unplayed_timeout`. Omdat schuld niet automatisch vastgesteld kan worden, krijgen **beide** duo's standaard een vaste, beperkte rating-penalty (richtwaarde −10). Een duo kan binnen een beperkte termijn een dispute openen om te stellen dat de andere partij in gebreke bleef; een admin kan de penalty dan eenzijdig toewijzen aan de in gebreke gebleven partij (zie FR-4.6 / Epic Disputes).
- FR-4.6: Cooldown na een verloren wedstrijd of een opgelegde forfeit-penalty, exacte duur configureerbaar.
- FR-4.7: Rate limiting op het aanmaken van challenges.

### 7.5 Match Registratie
- FR-5.1: Eén partij voert de score in na afloop van de wedstrijd.
- FR-5.2: De tegenstander moet de score **bevestigen** voordat deze definitief wordt.
- FR-5.3: Bij niet-bevestiging binnen een vastgestelde termijn wordt de score automatisch definitief.
- FR-5.4: Beperkte dispute-flow, ook bruikbaar voor forfeit-geschillen (FR-4.5).
- FR-5.5: Matchverwerking is idempotent.

### 7.6 Ranking Algoritme
- FR-6.1: Rating wordt berekend volgens een ELO-achtig model, **per duo-combinatie** (twee gebruikers kunnen dus, als ze in meerdere duo's zitten, elk een andere rating hebben per duo).
- FR-6.2: De K-factor is configureerbaar.
- FR-6.3: Elke voltooide wedstrijd genereert een nieuwe rating én een historische logregel.
- FR-6.4: Bescherming tegen rating-manipulatie (zie ELO_Algoritme.md).
- FR-6.5: Forfeit-penalties (FR-4.4, FR-4.5) zijn **vaste waarden**, niet de standaard ELO-formule, en worden apart gelabeld in de RatingHistory (zodat een forfeit-penalty herkenbaar blijft van een echte wedstrijduitslag).

### 7.7 UX / Kernschermen
- FR-7.1: Dashboard toont, per duo waarin de gebruiker actief is: rank, dichtstbijzijnde tegenstanders binnen de tier, actieve challenge(s).
- FR-7.2: Ladder-view met filters, inclusief tier-weergave.
- FR-7.3: Challenge-flow in maximaal 2 stappen, met duidelijke tier-indicatie (je ziet alleen uitdaagbare duo's).
- FR-7.4: Duidelijke feedback bij ratingveranderingen, met onderscheid tussen "wedstrijdresultaat" en "forfeit-penalty".
- FR-7.5: Overzicht per gebruiker van al zijn/haar actieve duo's (bij meerdere lidmaatschappen), met per duo de eigen rating en tier.

### 7.8 Beschikbaarheid & Externe Banen-API (nieuwe epic)
- FR-8.1: Een duo kan **terugkerende beschikbaarheid** doorgeven (bijv. "elke dinsdag- en donderdagavond"), bestaande uit dag van de week, tijdsblok en een vlag of het een vast terugkerend patroon is.
- FR-8.2: Beschikbaarheid is aanpasbaar en verwijderbaar door beide leden van het duo.
- FR-8.3: Er komt een **externe, geauthenticeerde API** (API-key per afnemend systeem) waarmee clubsystemen de beschikbaarheid van duo's in een regio kunnen opvragen (bijv. "welke duo's willen aankomende donderdagavond spelen").
- FR-8.4: De API ontsluit **geen** persoonlijke contactgegevens van individuele spelers — alleen duo-naam, regio en beschikbaarheidsblokken. Contact/matching tussen club en spelers is aan het externe systeem.
- FR-8.5: Dit systeem doet **niet** aan boeken, blokkeren of bevestigen van een fysieke baan — dat is en blijft de verantwoordelijkheid van het externe (club-)systeem. Zie non-goals, §4.
- FR-8.6: API-toegang is rate-limited en per API-client af te sluiten/in te trekken door een platform-admin.

---

## 8. Non-Functionele Requirements (NFR)

| Categorie | Requirement |
|---|---|
| **Betrouwbaarheid** | Matchverwerking, forfeit-penalty's en rating-updates gebeuren transactioneel; geen gedeeltelijke updates. |
| **Beveiliging** | Input-validatie op alle endpoints; rate limiting op challenge-, auth- en de externe availability-API; audit-logging bij scorewijzigingen en forfeit-beslissingen; API-keys voor externe clients apart beheerd en intrekbaar. |
| **Schaalbaarheid** | Architectuur moet meerdere regio's, duizenden duo's en meerdere duo's per gebruiker ondersteunen zonder herontwerp. |
| **Performance** | Ladder-view en dashboard laden snel genoeg voor mobiel gebruik. |
| **Toegankelijkheid** | UI voldoet aan basis toegankelijkheidsstandaarden. |
| **Beheerbaarheid** | Aparte dev/prod-omgevingen; gestructureerde logging en foutafhandeling. |
| **Auditeerbaarheid** | Elke rating-, forfeit- en scorewijziging is herleidbaar naar oorzaak. |
| **Privacy** | Externe API deelt nooit individuele persoonsgegevens (zie FR-8.4). |

---

## 9. Datamodel (Hoog niveau, bijgewerkt)

- **User** — accountgegevens, credentials, rol
- **Duo** — koppelt twee Users, naam, regio, status, huidige rating, **member_pair_key** (voorkomt dubbele actieve duo's van hetzelfde koppel)
- **DuoMembership** — koppeltabel User↔Duo; **ondersteunt nu meerdere actieve rijen per user**, met een applicatie-/trigger-gehandhaafd maximum
- **Region** — regio-definitie waarbinnen ladders bestaan
- **LadderEntry** — afgeleide weergave (RANK() over actieve duo's), inclusief afgeleide tier
- **Challenge** — uitdager, uitgedaagde, status (incl. nieuwe status `unplayed_timeout`), response-deadline, match-deadline
- **Match** — gekoppeld aan Challenge, score, bevestigingsstatus
- **RatingHistory** — logregel per match/forfeit: oude rating, nieuwe rating, K-factor of vaste penalty, `is_forfeit`-vlag
- **Dispute** — gekoppeld aan Match óf aan een `unplayed_timeout`-challenge, reden, status, admin-beslissing
- **DuoAvailability** *(nieuw)* — duo_id, dag van de week, tijdsblok, recurring-vlag
- **ApiClient** *(nieuw)* — externe systemen die de availability-API mogen aanroepen: naam, gehashte API-key, scope (regio), status

*Zie ER_Diagram.mermaid en Database_Schema.sql voor het volledige, bijgewerkte model.*

---

## 10. API-oppervlak (indicatief, bijgewerkt)

- Auth: registratie, login, activatie
- Duo's: aanmaken, bevestigen, ontbinden, opvragen (nu: lijst van *meerdere* duo's per gebruiker)
- Ladder: ophalen per regio (met tier-informatie)
- Challenges: aanmaken (met tier-validatie), accepteren, systeem-getriggerde expiratie/unplayed-timeout
- Matches: score indienen, bevestigen, betwisten
- Beschikbaarheid: duo geeft eigen beschikbaarheid door (intern, ingelogde gebruiker)
- **Externe availability-API** (`/api/v1/availability`, API-key auth): read-only, toont beschikbaarheidsblokken per regio, geen persoonsgegevens
- Admin: dispute-afhandeling (inclusief forfeit-geschillen), regio-beheer, API-clientbeheer

---

## 11. Risico's & Mitigaties

| Risico | Impact | Mitigatie |
|---|---|---|
| Rating-manipulatie via afgesproken wedstrijden | Oneerlijke ladder | Anti-abuse detectie, rate limiting, admin-review |
| Onterechte forfeit-penalty (bijv. bij overmacht) | Frustratie, oneerlijkheid | Dispute-flow specifiek voor `unplayed_timeout`, admin kan penalty terugdraaien of eenzijdig toewijzen |
| Misbruik van multi-duo lidmaatschap (bijv. "rating shoppen" door zwakke duo's te vormen) | Verstoorde ladderintegriteit | Maximum aantal actieve duo's, tier-restrictie blijft per duo gelden, monitoring door admin |
| Externe API misbruikt voor scraping van spelersdata | Privacyrisico | Geen persoonsgegevens in de payload (FR-8.4), API-key-verplichting, rate limiting, intrekbare keys |
| Eén regio trekt te weinig duo's | Lage engagement | Pilotstrategie: klein starten, actief 20 duo's werven |
| Dubbele verwerking van matchresultaten of forfeits | Corrupte ratings | Idempotente verwerking, transactionele updates |

---

## 12. Succesmetrics (v1 / Pilot)

- Aantal actieve duo's in pilotregio (streefwaarde: 20), en gemiddeld aantal duo's per gebruiker
- Aantal voltooide, bevestigde matches per week
- % challenges die tijdig geaccepteerd én daadwerkelijk gespeeld worden vs. expired/unplayed_timeout
- Aantal disputes (incl. forfeit-disputes) t.o.v. totaal aantal challenges
- Aantal aanroepen op de externe availability-API (indien al gekoppeld in pilotfase)

---

## 13. Rollout-strategie

1. **Fase 1 — Pilot (1 regio):** Platform live, ~20 uitgenodigde duo's, multi-duo-lidmaatschap vanaf dag 1 beschikbaar.
2. **Fase 2 — Stabilisatie:** Bugs en edge cases oplossen (tier-overgangen, forfeit-disputes, availability-data-kwaliteit).
3. **Fase 3 — Opschalen + externe koppelingen:** Meerdere regio's toevoegen, eerste externe club-systemen aansluiten op de availability-API.

---

## 14. Open vragen

1. Exacte breedte van een rating-tier (richtwaarde 100 punten) — vast per regio, of instelbaar per regio?
2. Exacte hoogte van de forfeit-penalty (richtwaarde −10) en de cooldown-duur die daarop volgt.
3. Exacte maximum aantal actieve duo's per gebruiker binnen de range 3–5 (default-voorstel: 5).
4. Exacte duur van de speeltermijn na acceptatie (richtwaarde 14 dagen) en de reactietermijn (richtwaarde 5 dagen).
5. Hoe wordt een `ApiClient` precies uitgegeven/beheerd — handmatig door een platform-admin, of een self-service aanvraagflow voor clubs?
6. Moet de externe availability-API ook *aggregeren* (bijv. "3 duo's beschikbaar donderdagavond") of altijd per-duo blijven tonen?
7. Taalondersteuning: alleen NL, of ook EN vanaf v1?

---

## 15. Vervolgstappen

- [x] Uitgewerkt ELO-algoritme (incl. forfeit-penalty-logica) — zie ELO_Algoritme.md
- [x] ER-diagram en volledig databaseschema — zie ER_Diagram.mermaid / Database_Schema.sql
- [x] User stories + acceptatiecriteria voor Sprint 1 t/m 5 — zie Sprint1_User_Stories.md t/m Sprint5_User_Stories.md
- [x] Claude Code bouwplan met fasering per sprint en een verplicht review/test/presentatie-protocol na elke sprint — zie Claude_Code_Bouwplan.md
- [ ] API-specificatie (endpoints, payloads, statuscodes) inclusief de externe availability-API
- [ ] Technisch architectuurdocument

---

*Einde document.*
