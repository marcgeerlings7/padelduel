# ELO Ratingalgoritme — Padel Ladder Platform

Dit document werkt het ratingalgoritme uit zoals gerefereerd in het PRD (§7.6, FR-6.1 t/m FR-6.4). Het is geschreven zodat het rechtstreeks als basis voor implementatie gebruikt kan worden.

---

## 1. Uitgangspunten

- Rating geldt per **duo**, niet per individuele speler (het duo is de rankende eenheid).
- Elke wedstrijd is 1-op-1 tussen twee duo's (geen team-van-teams, geen freeplay).
- Alleen **bevestigde** matches (status `completed`) tellen mee in de rating-berekening. Betwiste of niet-bevestigde matches worden pas verwerkt na resolutie.
- Rating-updates zijn **atomisch**: beide duo's worden in dezelfde database-transactie bijgewerkt, samen met de bijbehorende `RatingHistory`-records.

## 2. Basisformule (standaard ELO)

Verwachte score van duo A tegen duo B:

```
E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
E_B = 1 - E_A
```

Nieuwe rating na een wedstrijd:

```
R_A' = R_A + K_A * (S_A - E_A)
R_B' = R_B + K_B * (S_B - E_B)
```

Waarbij:
- `S_A` = 1 als duo A wint, 0 als duo A verliest (padel kent geen gelijkspel op wedstrijdniveau)
- `K_A`, `K_B` = de K-factor van het betreffende duo (zie §3, kan per duo verschillen)

## 3. K-factor beleid

Een vaste K-factor voor alle duo's leidt tot te trage convergentie voor nieuwe duo's en te grote schommelingen voor gevestigde duo's. Daarom een **gelaagd K-factor beleid**:

| Duo-status | K-factor | Toelichting |
|---|---|---|
| Provisional (< 10 gespeelde matches) | 40 | Snelle convergentie naar "echt" niveau |
| Established (≥ 10 matches) | 24 | Standaard gevoeligheid |
| Established + rating > drempelwaarde (bijv. top 10% van de ladder) | 16 | Stabielere top van de ladder, minder volatiliteit |

> Deze exacte drempels (10 matches, top 10%, waarden 40/24/16) zijn **aanbevolen startwaarden**, geen harde eis — expliciet gemarkeerd als configureerbaar (FR-6.2). Ze moeten instelbaar zijn via configuratie, niet hardcoded.

## 4. Startrating voor nieuwe duo's

- Elke nieuwe duo start op een vaste **basisrating (default: 1200)**.
- Alternatief (optioneel, niet in v1): startrating baseren op gemiddelde van de individuele historie van beide spelers, indien zij eerder in een ander duo actief waren. **Voor v1: niet doen** — houdt het model simpel en voorspelbaar. Elke nieuwe duo-combinatie start gelijk.

## 5. Pseudocode (implementatie-referentie)

```typescript
type Duo = {
  id: string;
  currentRating: number;
  matchesPlayed: number;
};

function getKFactor(duo: Duo, ladderPercentile: number): number {
  if (duo.matchesPlayed < 10) return 40;      // provisional
  if (ladderPercentile <= 0.10) return 16;    // top van de ladder
  return 24;                                   // established, standaard
}

function expectedScore(ratingSelf: number, ratingOpponent: number): number {
  return 1 / (1 + Math.pow(10, (ratingOpponent - ratingSelf) / 400));
}

function applyMatchResult(
  winner: Duo,
  loser: Duo,
  winnerPercentile: number,
  loserPercentile: number
): { winnerNewRating: number; loserNewRating: number } {
  const eWinner = expectedScore(winner.currentRating, loser.currentRating);
  const eLoser = 1 - eWinner;

  const kWinner = getKFactor(winner, winnerPercentile);
  const kLoser = getKFactor(loser, loserPercentile);

  const winnerNewRating = Math.round(
    winner.currentRating + kWinner * (1 - eWinner)
  );
  const loserNewRating = Math.round(
    loser.currentRating + kLoser * (0 - eLoser)
  );

  return { winnerNewRating, loserNewRating };
}
```

**Verwerkingsvolgorde bij een voltooide match (transactioneel):**

1. Lock beide duo-rijen (of gebruik optimistic locking met een `version`-kolom).
2. Bereken `expectedScore` en nieuwe ratings zoals hierboven.
3. Update `Duo.current_rating` voor beide duo's.
4. Voeg twee `RatingHistory`-records toe (één per duo): `rating_before`, `rating_after`, `k_factor`, `match_id`.
5. Zet `Match.status = completed`.
6. Commit transactie. Bij falen: volledige rollback, geen gedeeltelijke rating-update.

## 6. Bescherming tegen rating-manipulatie (FR-6.4)

Concrete maatregelen, te implementeren als business-rules naast het kale rekenmodel:

1. **Maximale rating-winst per wedstrijd**: cap op bijv. ±50 punten per match, ongeacht de formule-uitkomst. Voorkomt extreme uitschieters bij zeer scheve verwachte scores.
2. **Herhaalde tegenstander-detectie**: als duo A en duo B binnen een venster van bijv. 14 dagen meer dan 1x tegen elkaar spelen, wordt de rating-impact van de 2e+ wedstrijd gedempt (bijv. gehalveerde K-factor). Voorkomt "afspraakjes" om rating te pompen.
3. **Minimum tijd tussen matches van hetzelfde duo**: voorkomt het snel achter elkaar spelen van meerdere wedstrijden om varianties uit te buiten.
4. **Anomalie-signalering voor admins**: duo's met een ongebruikelijk patroon (bijv. >80% van matches tegen dezelfde tegenstander, of opvallend veel matches in korte tijd) worden gemarkeerd voor handmatige review — geen automatische blokkade, wel zichtbaar in het admin-dashboard.
5. **Disputes blokkeren rating-verwerking**: zolang een `Dispute` open staat op een match, wordt de rating niet aangepast.

## 7. Edge cases

| Situatie | Gewenst gedrag |
|---|---|
| Eén duo trekt zich terug vóór bevestiging | Match krijgt status `voided`, geen rating-impact |
| Forfeit (no-show) | Optioneel: winnaar krijgt vaste kleine bonus, geen volledige ELO-berekening (voorkomt dat no-shows als "makkelijke winst" gefarmd worden) — **open ontwerpvraag, zie PRD §14** |
| Dispute wordt na resolutie alsnog bevestigd | Rating wordt op dat moment pas verwerkt, met tijdstempel van resolutie, niet van wedstrijddatum |
| Duo wordt ontbonden na een match, vóór ratingverwerking | Match wordt alsnog verwerkt; rating-historie blijft gekoppeld aan de (nu inactieve) duo voor auditdoeleinden |

## 8bis. Rating-tiers en forfeit-penalty's (toegevoegd n.a.v. PRD v1.1)

### Rating-tiers (koppeling met challenge-regels)
Duo's mogen alleen duo's binnen dezelfde **rating-tier** uitdagen (PRD FR-4.2), in plaats van de eerdere ±3-ladderposities-regel. Een tier is een band van `tier_size` ratingpunten (configureerbaar, richtwaarde 100):

```typescript
function getTier(rating: number, tierSize: number): number {
  return Math.floor(rating / tierSize);
}
```

Dit is een **afgeleide** waarde, net als de ladderpositie — niet opgeslagen, altijd herberekend uit `current_rating`. Dit heeft twee gevolgen voor het ratingmodel zelf:
- De ELO-berekening (§2–§5) verandert niet: die rekent nog steeds op basis van de daadwerkelijke ratings van beide duo's, ongeacht tiergrenzen.
- Een duo dat vlak over een tiergrens rating wint/verliest, kan van tier wisselen — dit is gewenst gedrag (het model past zich aan) en vereist geen speciale afhandeling in de rekenlogica zelf.

### Forfeit-penalty's zijn GEEN ELO-berekening
Wanneer een challenge eindigt in `expired` (geen reactie) of `unplayed_timeout` (geaccepteerd maar niet gespeeld binnen de speeltermijn), wordt er **geen** `expectedScore`/K-factor-berekening toegepast. In plaats daarvan:

```typescript
function applyForfeitPenalty(duo: Duo, penalty: number): number {
  // penalty is een vaste, configureerbare waarde (richtwaarde 10)
  return Math.max(0, duo.currentRating - penalty); // rating nooit onder 0
}
```

Redenen om dit bewust NIET via de standaard ELO-formule te laten lopen:
1. Er is geen "tegenstander-rating" om een verwachte score tegen af te zetten wanneer er nooit gespeeld is.
2. Een vaste, kleine penalty is voorspelbaar en uitlegbaar aan gebruikers ("−10 wegens niet gereageerd"), in plaats van een variabele uitkomst die aanvoelt als een echte wedstrijdnederlaag.
3. Het apart labelen (`RatingHistory.is_forfeit = true`, zie Database_Schema.sql) houdt de historische rating-lijn van een duo eerlijk leesbaar: gebruikers kunnen zien welke dip een echte nederlaag was en welke een gemiste actie.

**Verwerkingsregels:**
- `expired` (geen reactie van de uitgedaagde binnen de reactietermijn): alleen de **uitgedaagde** duo krijgt de penalty.
- `unplayed_timeout` (geaccepteerd maar niet gespeeld binnen de speeltermijn): **beide** duo's krijgen de penalty, tenzij een dispute is geopend en door een admin is toegewezen aan één specifieke partij — in dat geval wordt alleen bij de in gebreke gebleven partij de penalty (opnieuw) toegepast en bij de andere partij teruggedraaid.
- Elke forfeit-penalty triggert een cooldown (`forfeit_cooldown_days`) voordat het duo opnieuw kan uitdagen of uitgedaagd worden.

## 8. Testbaarheid

Het algoritme moet volledig **los van de database** getest kunnen worden (pure functies, zoals in de pseudocode hierboven). Vereiste unit tests:

- Verwachte score som van beide duo's = 1.
- Winnaar met lagere rating dan verliezer krijgt grotere rating-winst dan winnaar met hogere rating (upset-bonus).
- K-factor wordt correct toegepast per duo-status.
- Rating-cap wordt gehandhaafd bij extreme rating-verschillen.
- Herhaalde-tegenstander-demping wordt correct toegepast bij >1 match binnen het venster.
- `getTier` deelt correct in op basis van `tier_size`, ook rond exacte tiergrenzen (bijv. rating precies 1300 bij tier_size 100).
- `applyForfeitPenalty` verlaagt de rating met exact de geconfigureerde penalty en gaat nooit onder 0.
- Bij `expired` krijgt uitsluitend de uitgedaagde duo een penalty; de uitdager blijft ongewijzigd.
- Bij `unplayed_timeout` krijgen beide duo's dezelfde penalty, tenzij een dispute-resolutie de schuld eenzijdig toewijst.
