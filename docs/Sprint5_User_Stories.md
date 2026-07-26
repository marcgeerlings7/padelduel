# Sprint 5 — User Stories: Beschikbaarheid & Externe API (Epic H)

## Sprintdoel

Duo's kunnen hun terugkerende beschikbaarheid doorgeven. Externe (club-)systemen kunnen die beschikbaarheid via een geauthenticeerde, read-only API opvragen — zonder dat dit platform zelf iets van baanreservering doet (zie PRD §4/§7.8).

**Afhankelijkheid:** logisch onafhankelijk van Sprint 2–4; kan qua planning ook eerder ingepland worden als dat beter uitkomt, maar staat hier als laatste omdat het de kern-competitieve loop niet raakt.

---

## US-H1 — Beschikbaarheid doorgeven
**Als** lid van een actief duo
**wil ik** terugkerende tijdsblokken opgeven waarop we willen spelen (bijv. "elke dinsdag- en donderdagavond")
**zodat** anderen (via het clubsysteem) kunnen zien wanneer we beschikbaar zijn (FR-8.1).

**Acceptatiecriteria:**
- Ik kan één of meerdere `DuoAvailability`-blokken toevoegen: dag van de week, starttijd, eindtijd, en of het terugkerend is.
- `end_time` moet na `start_time` liggen (DB-constraint + validatie).
- Beide leden van het duo kunnen beschikbaarheid toevoegen/bekijken.

## US-H2 — Beschikbaarheid aanpassen of verwijderen
**Als** lid van een actief duo
**wil ik** eerder opgegeven beschikbaarheid kunnen wijzigen of verwijderen
**zodat** het overzicht klopt met de actuele situatie (FR-8.2).

**Acceptatiecriteria:**
- Beide leden kunnen elk beschikbaarheidsblok van hun duo bewerken of verwijderen.
- Wijzigingen zijn direct van kracht (geen goedkeuringsflow nodig, in tegenstelling tot duo-vorming).

## US-H3 — Admin: API-clients beheren
**Als** admin
**wil ik** API-clients (externe clubsystemen) kunnen aanmaken en intrekken
**zodat** alleen geautoriseerde systemen bij de beschikbaarheidsdata kunnen (FR-8.6).

**Acceptatiecriteria:**
- Admin kan een nieuwe `ApiClient` aanmaken met naam en optioneel een regio-scope; het systeem genereert een API-key die **eenmalig** getoond wordt (alleen de hash wordt opgeslagen).
- Admin kan een bestaande `ApiClient` intrekken (`is_active = false`, `revoked_at` gezet); een ingetrokken key werkt direct niet meer.
- Overzicht toont alle clients met status, maar nooit de key zelf na de initiële aanmaak.

## US-H4 — Externe availability-endpoint
**Als** extern clubsysteem
**wil ik** via een API-call de beschikbaarheid van duo's in een regio opvragen
**zodat** ik weet wanneer er animo is om te spelen (FR-8.3).

**Acceptatiecriteria:**
- Endpoint vereist een geldige, actieve API-key (header-based); ongeldige/ingetrokken keys geven `401`.
- Response bevat per beschikbaarheidsblok: duo-naam, regio, dag, tijdsblok — **nooit** e-mailadressen of andere persoonsgegevens van individuele leden (FR-8.4).
- Endpoint is filterbaar op regio en (optioneel) dag van de week.
- Endpoint doet geen enkele schrijfactie, boeking of bevestiging (FR-8.5) — puur read-only.

## US-H5 — Rate limiting en logging op de externe API
**Als** platformbeheerder
**wil ik** dat de externe API rate-limited en gelogd is
**zodat** misbruik (scraping, overbelasting) beheersbaar blijft (FR-8.6).

**Acceptatiecriteria:**
- Elke aanroep wordt gelogd (client, tijdstip, endpoint, statuscode) — geen payload-inhoud die tot individuele spelers herleidbaar is, om privacyredenen.
- Overschrijding van de rate limit geeft een nette `429` met duidelijke retry-informatie.
- Een `ApiClient` die herhaaldelijk de limiet overschrijdt is voor de admin zichtbaar in een overzicht (signalering, geen automatische blokkade in v1).

---

## Sprint 5 — Review, Test & Presentatie (afronding v1-scope)

- [ ] Unit tests voor validatie van beschikbaarheidsblokken (tijdsvolgorde, dag-range).
- [ ] Integratietest voor de externe API: geldige key → correcte, geanonimiseerde data; ingetrokken key → 401; rate limit → 429.
- [ ] Test dat de payload van de externe API nooit e-mailadressen of user-id's bevat.
- [ ] Demo aan PO: (a) beschikbaarheid doorgeven in de UI, (b) diezelfde data terugzien via een voorbeeld-aanroep op het externe endpoint met een testkey.
- [ ] Expliciete go/no-go van de PO — dit is tevens het moment om de volledige v1-scope (Sprint 1–5) gezamenlijk te evalueren vóór de pilot-rollout (PRD §13).
