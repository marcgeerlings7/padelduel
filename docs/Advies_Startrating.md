# Advies: nieuwe (sterke) duo's beter initieel ranken

| | |
|---|---|
| **Status** | **Gebouwd** (akkoord PO 2026-11-22, lagen A–D). Zie Technical_Debt.md "Startrating & plaatsing". Verificatie gaat zonder upload: de admin vraagt de schermafbeelding per e-mail op |
| **Huidige code** | `src/lib/duo/startRating.ts`, `src/lib/elo/kFactor.ts`, `src/lib/profile/validation.ts` |

## 1. Het probleem
- Een nieuw duo zonder andere duo's start op `default_start_rating` = **1200**. De zelf opgegeven
  KNLTB-speelsterkte (1–9) wordt **bewust niet** gebruikt (niet geverifieerd).
- Uitdagen kan alleen **binnen de eigen tier** (100 punten). Een sterk duo dat eigenlijk op ~1600
  hoort, kan dus alleen tegen 1200-duo's spelen. Bij een gelijke verwachting levert een winst
  ~K/2 = **~20 punten** op (K = 40 voor de eerste 10 wedstrijden); tegen zwakkere tegenstanders
  minder, omdat de rating dat steeds beter "verwacht". **Het duurt 20+ eenzijdige wedstrijden**
  voordat ze op hun niveau zitten. Saai voor het sterke duo, frustrerend voor de rest, en het
  verstoort de ratings in de starttier.
- Bij een **regiolancering** zit iedereen in tier 12. Wie sterk is, moet zich door honderden duo's heen werken.

## 2. Kan het met een officiële KNLTB-API?
**Kort: nu niet.**
- Er is **geen publieke KNLTB-API** voor ratings. Rating en speelsterkte staan in **MijnKNLTB**,
  alleen ingelogd en per lid.
- **Scrapen van MijnKNLTB is geen optie:** achter een login, in strijd met de voorwaarden, en het
  gaat om persoonsgegevens (bondsnummer + rating), dus de AVG en ons eigen privacyprincipe.
- **Kans op termijn:** de KNLTB rolt een **KNLTB-ID met één rating voor alle spelers** uit en
  bundelt alles in Meet & Play. Partners lopen via een KNLTB-accountmanager. Het ideaal is
  "Inloggen met KNLTB-ID" (OAuth), waarbij de speler **zelf toestemming** geeft om zijn rating te
  delen. Actie: stuur de KNLTB een partnerverzoek (concept in §6). Bouw er niet op tot er een
  schriftelijk akkoord en een technische specificatie liggen.

## 3. Aanbevolen aanpak (in lagen, zonder externe afhankelijkheid)

### Laag A — Startbonus op basis van speelsterkte, alleen omhoog en begrensd
- Map de zelf opgegeven speelsterkte naar een **spelerswaarde**: speelsterkte 9 (of leeg) =
  `default_start_rating`; elke stap sterker = + `start_rating_level_step` (voorstel 50).
  Speelsterkte 1 = 1200 + 8 × 50 = 1600.
- Duo-startrating = het gemiddelde van beide spelerswaarden (net als nu), waarbij een speler met
  andere actieve duo's zijn **echte** duo-gemiddelde blijft gebruiken (gaat altijd voor).
- **Alleen omhoog:** nooit onder de default. Wie zichzelf lager inschat, wint dus niets ten opzichte
  van nu. Daarmee verdwijnt het voordeel van zandzakken via het profiel.
- **Plafond zonder verificatie:** maximaal + `start_rating_unverified_max_bonus` (voorstel 200 = 2 tiers).
  Overschatten wordt snel afgestraft (K = 40) en levert geen voordeel op.
- Configureerbaar via `platform_config` (nieuwe rijen via een datamigratie), conform CLAUDE.md.

### Laag B — Plaatsingsperiode: omhoog uitdagen mag
- Een **provisional** duo (< 10 wedstrijden) mag ook duo's tot **2 tiers hoger** uitdagen
  (`placement_challenge_tiers_up`). Omlaag blijft alleen de eigen tier.
- ELO beloont winst op een sterker duo vanzelf zwaarder: een sterk duo is na een paar wedstrijden
  op zijn niveau, en zwakke duo's verliezen weinig.
- De uitgedaagde (hogere) duo's mogen een uitdaging van een provisional duo weigeren **zonder
  penalty** (anders worden ze gestraft voor andermans plaatsing).
- **Wijkt af van het ontwerpprincipe "alleen binnen de eigen tier":** dit vraagt expliciet PO-akkoord.

### Laag C — Geverifieerde plaatsing door een admin (voor de top)
- Speler uploadt een schermafbeelding van MijnKNLTB (speelsterkte/rating); een admin keurt goed
  → het plafond van laag A vervalt (bonus volgens de volledige mapping, bv. tot +400).
- Opslaan: alleen "geverifieerd: ja/nee + niveau + door wie/wanneer"; **de schermafbeelding en het
  bondsnummer niet bewaren** (dataminimalisatie).
- Handig bij de lancering: ambassadeurs kennen de sterke spelers en kunnen hen wijzen op verificatie.

### Laag D — Lanceer-seeding
- Voor een nieuwe regio: de startratings uit laag A/C worden toegepast vóórdat de ladder opengaat,
  zodat de tiers vanaf dag 1 gespreid zijn in plaats van 1.000 duo's in tier 12. Dit lost meteen het
  "één gigantische tier"-risico uit het marketingplan op.

## 4. Risico's en hoe ze afgedekt zijn
| Risico | Afdekking |
|---|---|
| Overschatten (ego) | Plafond +200 zonder verificatie; K = 40 corrigeert snel; overschatten levert geen voordeel op |
| Zandzakken (te laag opgeven om punten te farmen) | Bonus alleen omhoog = niet slechter dan nu; plaatsingsperiode helpt sterke duo's juist snel omhoog |
| Ratinginflatie (punten die van "te hoog geplaatste" duo's wegvloeien) | Kleine bonussen, eenmalig per nieuw duo, geen bonus bij een speler met bestaande duo's |
| Speelsterkte verouderd (eens per jaar, in november) | Alleen gebruikt voor de start; daarna bepaalt PadelDuel de rating zelf |
| Privacy | Geen bondsnummer opslaan, verificatie zonder bewaren van de schermafbeelding, niets in de externe API |

## 5. Aanbevolen volgorde
1. **Laag A + D** (klein, puur rekenwerk in `startRating.ts` + config + unit tests). Grootste winst, laag risico.
2. **Laag B** na een PO-besluit over de tier-regel.
3. **Laag C** alleen als de top-duo's bij de lancering klagen.
4. **KNLTB-partnerschap** parallel als verkenning, zonder afhankelijkheid.

## 6. Concept voor het partnerverzoek aan de KNLTB
> Beste KNLTB,
> Wij bouwen PadelDuel, een regioladder voor padelduo's (padelduel.vercel.app). Spelers vullen nu
> zelf hun speelsterkte in om een eerlijke startpositie te krijgen. We zouden dat graag
> betrouwbaarder maken door spelers — met hun eigen toestemming — hun KNLTB-rating te laten
> delen, bijvoorbeeld via inloggen met het nieuwe KNLTB-ID. We slaan geen bondsnummers op en
> delen niets met derden. Bestaat er een partnerprogramma of API voor deze toepassing, en met wie
> kunnen we daarover in gesprek?
> Met vriendelijke groet, [naam]

## Bronnen
- Padelgids, *KNLTB lanceert universele rating en centraal platform*: https://padelgids.nl/padelnieuws/knltb-lanceert-een-universele-rating-en-centraal-p/
- Padelgids, *Alles over de padelrating en ranking*: https://padelgids.nl/padelnieuws/alles-wat-je-moet-weten-over-de-padelrating-en-ran/
- KNLTB, *Competitiereglement padel* (MijnKNLTB: bondsnummer, speelsterkte, rating): https://www.knltb.nl/media/5x5hu4xd/knltb-competitiereglement-padel.pdf
- KNLTB, *DSS uitgebreide uitleg*: https://knltb.nl/media/ornjxpds/dss-uitgebreide-uitleg.pdf
- KNLTB, *Speelsterktebepaling padel*: https://www.nlpadel.nl/media/0eeipfr0/speelsterktebepaling-padel.pdf
