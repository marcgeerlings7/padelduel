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

> Sinds de KNLTB-aanvullingen (akkoord PO 2026-09-28) wordt de K-factor bovendien geschaald met een **gamesaldo-multiplier** `M` — zie §2bis. `S` blijft 1/0.

## 2bis. Gamesaldo in de ELO-formule (KNLTB-aanvulling, akkoord PO 2026-09-28)

De KNLTB telt sinds 2025 gewonnen/verloren games mee; Playtomic weegt de marge. Een 6-0 6-0 zegt meer over het niveauverschil dan een 7-6 6-7 10-8. Daarom:

```
G_w, G_l = games van winnaar/verliezer (KNLTB-telling, zie hieronder)
m        = (G_w - G_l) / (G_w + G_l), begrensd tot [0, 1]      (genormaliseerd gamesaldo)
M        = M_min + (M_max - M_min) * m                           (lineair, monotoon stijgend)

Δ_w = +max(1, round( clamp( K_w * D * M * (1 - E_w), ±cap ) ))
Δ_l = -max(1, round( clamp( K_l * D * M * E_l,       ±cap ) ))
```

- `D` = herhaalde-tegenstander-demping (0.5 of 1, §6.2), `cap` = rating-cap (50, §6.1).
- `round` = symmetrisch afronden (half van nul af), zodat +7.5/−7.5 als +8/−8 uitkomen.
- **KNLTB-telling:** gewone sets tellen hun games; een match-tiebreak/super-tiebreak (een "set" met ≥ 10 punten, bijv. `10-8`) telt als **één gewonnen set en 1-0 in games** — de tiebreakpunten zijn geen games. Implementatie: `summarizeScore` in `src/lib/match/score.ts` (gedeeld met de statistieken).
- Een winnaar met minder games dan de verliezer (bijv. `0-6 7-6 10-8` → 8-12 games) krijgt `m = 0` → `M = M_min`: de winst telt volledig, alleen zonder margebonus.

**Parameters** (`platform_config`, met fallback-default in `src/lib/elo/gameMargin.ts` zolang de rijen nog niet via een migratie bestaan):

| Key | Default | Betekenis |
|---|---|---|
| `elo_margin_multiplier_min` | `0.75` | `M` bij de kleinste marge (m = 0). Moet > 0 zijn. |
| `elo_margin_multiplier_max` | `1.5` | `M` bij de grootste marge (m = 1, 6-0 6-0). Moet ≥ min zijn. |

Met `min = max = 1` is het gamesaldo uitgeschakeld (klassieke ELO). Een ongeldige combinatie (min ≤ 0, max < min) laat de matchverwerking falen vóór er iets geschreven wordt (liever geen verwerking dan een winnaar die punten verliest).

**Waarom deze vorm (en niet een marge-afhankelijke `S` in [0.5, 1]):**
1. **Winnaar wint altijd, verliezer verliest altijd.** Met `S_w < 1` zou een favoriet die nipt wint (bijv. `S = 0.55`, `E = 0.64`) punten *verliezen*. Met een multiplier op K blijft `(1 − E_w) > 0` en `E_l > 0`; `M > 0` verandert alleen de grootte. Een minimum van 1 punt vangt de afronding naar 0 bij extreme ratingverschillen af.
2. **Zero-sum.** Beide duo's krijgen dezelfde `M`; bij gelijke K-factor (de normale situatie binnen één tier) is `Δ_w + Δ_l = 0` exact, ook na afronding. Verschillende K-factoren (provisional vs. established) waren al niet zero-sum en blijven dat niet.
3. **Begrensd.** `M ∈ [M_min, M_max]`, en de bestaande cap van ±50 blijft gelden.
4. **Monotoon.** Meer gamesaldo geeft nooit minder winst of minder verlies.
5. **Neutraal ijkpunt.** Met de defaults geeft `6-3 6-3` (m = 1/3) exact `M = 1.0` = de oude uitkomst; een "gewone" zege verandert dus nauwelijks, alleen de uitschieters wegen zwaarder/lichter.

**Rekenvoorbeeld** (twee established duo's, K = 24, beide 1200 → `E = 0.5`):

| Uitslag | Games (KNLTB) | m | M | Δ winnaar / verliezer |
|---|---|---|---|---|
| 6-0 6-0 | 12-0 | 1 | 1.5 | 24·1.5·0.5 = 18 → **+18 / −18** |
| 6-3 6-3 | 12-6 | 0.333 | 1.0 | 12 → **+12 / −12** (klassiek) |
| 6-4 6-4 | 12-8 | 0.2 | 0.9 | 10.8 → **+11 / −11** |
| 7-6 6-7 10-8 | 14-13 | 0.037 | 0.778 | 9.33 → **+9 / −9** |

Met een ratingverschil (winnaar 1250, verliezer 1180 → `E_w ≈ 0.60`), 6-2 6-2 (m = 0.5, M = 1.125): `Δ = 24·1.125·0.40 ≈ 10.8` → +11 / −11.

`RatingHistory.k_factor` bevat de **effectief toegepaste K** (`K · D · M`, afgerond), zodat `rating_after − rating_before ≈ k_factor · (S − E)` herleidbaar blijft.

**Forfeits** (`expired`/`unplayed_timeout`) lopen hier nooit doorheen: die blijven een vaste penalty (§8bis). Een walkover/opgave die als (synthetische) score wordt vastgelegd, loopt wél door deze formule; de marge volgt dan uit die synthetische score.

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

> De pseudocode hierboven is de oorspronkelijke v1-referentie. De actuele implementatie (`src/lib/elo/applyMatchResult.ts`) schaalt K daarnaast met demping en de gamesaldo-multiplier (§2bis), past de cap toe en rondt symmetrisch af met een minimum van 1 punt.

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
- Gamesaldo (§2bis, `tests/unit/elo/gameMargin.test.ts`): zero-sum en symmetrie bij gelijke K, monotonie in de marge, 6-0 6-0 > 6-4 6-4 > 7-6 6-7 10-8, 6-3 6-3 = klassieke uitkomst, winnaar altijd ≥ +1 en verliezer ≤ −1, begrenzing door M_max en de cap, config-validatie, forfeits ongemoeid.
