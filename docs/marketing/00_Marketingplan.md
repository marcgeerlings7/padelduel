# Marketingplan PadelDuel — "Regio-lancering met hype"

| | |
|---|---|
| **Status** | Concept v0.1 (2026-11-22), ter bespreking met PO |
| **Doel** | Eén regio gaat in één keer live met een volle, levendige ladder |
| **Live app** | https://padelduel.vercel.app |

**Documenten in deze map:**
[01 Marktonderzoek](01_Marktonderzoek.md) ·
[02 Testkaarten](02_Testkaarten.md) ·
[03 Ambassadeursprogramma](03_Ambassadeursprogramma.md) ·
[04 Campagnedraaiboek](04_Campagnedraaiboek.md) ·
[05 Content](05_Content.md) ·
[06 USP](06_USP.md) ·
[07 Verdienmodel](07_Verdienmodel.md)

> **Update na het marktonderzoek (01):** 1.000 duo's is realistisch voor een verzorgingsgebied van
> ≥ 1 miljoen inwoners (bv. Eindhoven of Utrecht). Voor een regio van ~400.000 inwoners
> (bv. Zwolle) is het unlock-doel **400–500 duo's**. Positionering: *"Je KNLTB-rating zegt hoe
> goed jíj bent. PadelDuel zegt hoe goed jullie sámen zijn."*

> Let op: een aantal tactieken hieronder vraagt om **nieuwe features** (wachtlijst, teller,
> referral-tracking, deelkaarten). Die vallen buiten de vastgelegde scope en worden pas
> gebouwd na expliciet PO-akkoord (zie §8).

---

## 1. Hoeveel duo's zijn minimaal nodig?

### 1.1 De mechaniek die het bepaalt
- Uitdagen kan alleen **binnen de eigen rating-tier** (`floor(rating / tier_size)`, tier ≈ 100 punten).
- Een nieuw duo start op **1200** (of het gemiddelde van de bestaande duo's van beide spelers).
  → Op lanceerdag zit vrijwel iedereen in **dezelfde tier**. Dat is gunstig: de uitdaagpool is
  meteen maximaal. Na 4–8 weken spreiden ratings zich uit over ±6–8 tiers.
- Speelverplichting (reageren binnen 5 dagen, daarna spelen) betekent dat een duo pas
  "plezier" heeft als er **genoeg actieve tegenstanders in de eigen tier** zijn.

### 1.2 Rekensom kritische massa
| Aanname | Waarde |
|---|---|
| Duo's die in een gemiddelde week actief zijn | ~40% |
| Gewenste actieve, uitdaagbare tegenstanders per tier per week | ≥ 8–10 |
| Benutte tiers na stabilisatie | ~6–8 |

→ ~25 duo's per tier × 6–8 tiers ≈ **150–200 actieve duo's** = **ondergrens voor een ladder
die zichzelf in leven houdt**. Daaronder lopen de middelste tiers vol en blijven de
buitenste tiers leeg ("niemand om uit te dagen" → churn).

### 1.3 Advies drempels
| Niveau | Duo's | Betekenis |
|---|---|---|
| **Absolute ondergrens** | 150 | Ladder werkt, maar voelt stil in de buitentiers |
| **Gezond** | 300–500 | Altijd tegenstanders, ook na tier-spreiding |
| **Hype-doel (unlock-drempel)** | **1.000** | Lokaal "fenomeen", ladder is gespreksonderwerp op elk park |

Met multi-duo (gemiddeld ~1,5 duo per speler) zijn **1.000 duo's ≈ 1.300–1.500 unieke spelers**.

### 1.4 Is 1.000 realistisch?
- In 2025 speelden ~876.000 Nederlanders padel, gemiddeld ~350.000 per maand
  (KNLTB/EY, *Padel in cijfers 2025*). Er zijn ~3.000 banen.
- Een regio van ~400.000 inwoners (bv. Zwolle e.o., ~2,2% van NL) ≈ **~19.000 spelers,
  ~7.500 maandelijks actief**. 1.000 duo's = **~18% van de maandelijkse spelers**. Maar slechts
  ~20–30% daarvan is competitief ingesteld (zie 01 §1 en §4), dus voor een regio van deze omvang
  is **400–500** het realistische doel; 1.000 vraagt ~1 miljoen inwoners.
- **Regiokeuze:** kies een regio met veel banen op <25 min reistijd, 3+ grote padelcentra en
  een actieve WhatsApp/club-competitiecultuur.

---

## 2. Kernconcept: "De ladder gaat pas open als de regio vol is"

Het hype-mechanisme is een **gezamenlijke unlock-drempel**:

> **"Zwolle gaat live bij 1.000 duo's. Nu: 612. Schrijf je duo in en claim je plek."**

Waarom dit werkt:
1. **Ingebouwde viraliteit** — je kunt je niet alleen inschrijven; elke aanmelding brengt
   een partner mee. Met multi-duo kan één speler 3–5 partners uitnodigen.
2. **Gemeenschappelijk doel** — iedereen heeft er belang bij dat de teller vol loopt
   (anders gaat de ladder niet open). Spelers worden zelf de marketeers.
3. **Schaarste + status** — de eerste duo's krijgen het label *Founding Duo* (permanent zichtbaar).
4. **Een moment** — de lanceerdag is een event, geen "app staat online".

Boodschap in één zin: **"Weet eindelijk hoe goed jullie écht zijn — tegen iedereen in de regio."**

---

## 3. Doelgroep & boodschap

| Segment | Pijn | Belofte | Kanaal |
|---|---|---|---|
| Competitieve recreant (25–45) | Altijd dezelfde tegenstanders, geen idee van niveau | Eerlijke ranking, nieuwe tegenstanders op niveau | Instagram, WhatsApp-groepen, park |
| Vaste duo's / "vriendenkoppels" | Willen bewijzen wie de beste is | Onderling resultaat, W-L-reeks, naam op de ladder | Mond-tot-mond, deelkaarten |
| Clubs / padelcentra | Lege daluren, ledenbinding | Meer speelmomenten, beschikbaarheids-API voor baanplanning | Directe sales, demo |
| Trainers / ambassadeurs | Willen community en klanten | Zichtbaarheid, eigen "crew" op de ladder | Persoonlijk benaderen |

Toon: competitief, speels, lokaal trots ("Wie is de beste van Zwolle?"). Geen e-mailadressen
of persoonsgegevens in publieke content — alleen weergavenamen en duo-namen.

---

## 4. Campagne in 4 fasen (12 weken)

### Fase 0 — Fundament (week −12 t/m −9)
- Regio kiezen (§1.4) en **5–10 clubs** als *Founding Club* binnenhalen (gratis, ruil:
  poster/QR bij de balie, vermelding in hun nieuwsbrief/WhatsApp, availability-API-koppeling).
- **20–30 ambassadeurs** werven (trainers, bekende lokale spelers, organisatoren van
  WhatsApp-competities). Elk met een eigen uitnodigingslink.
- Pre-launch-pagina met teller + wachtlijst live (feature, zie §8).
- Contentbank: 10 korte video's (rally's, "wie is de beste duo van X?"), logo/huisstijl Court.

### Fase 1 — Teaser & founding (week −8 t/m −5) → doel 250 duo's
- Ambassadeurs + clubs schrijven eerst in → teller start niet op 0 (social proof).
- *Founding Duo*-label voor de eerste 250 duo's.
- Posters/QR-stickers op glas van de banen ("Jullie positie in Zwolle: ???").
- Instagram/TikTok: "Top-10 duo's van Zwolle — wie verdient een plek?"-nominaties.

### Fase 2 — Viraliteit (week −4 t/m −1) → doel 1.000 duo's
- **Referral-loop:** elk duo dat 3 nieuwe duo's binnenhaalt krijgt een badge/voorrang
  (bv. als eerste uitdagen op lanceerdag).
- **Club-battle:** teller per club ("Padelcentrum A: 143 duo's, B: 121") — clubs gaan
  zelf mobiliseren.
- Lokale pers (regionale krant, RTV) met het "1.000 duo's of de ladder blijft dicht"-verhaal.
- Mijlpaal-posts bij 500 / 750 / 900 duo's; laatste 100 = countdown.
- Gerichte Meta/Instagram-ads (straal 25 km, interesse padel) alleen als de organische
  curve achterblijft — budgetindicatie €1.000–2.500, stopregel vooraf bepalen.

### Fase 3 — Lanceerdag "Ladder Day" (week 0)
- Live-event bij de grootste Founding Club: om 20:00 gaat de ladder open, eerste
  uitdagingen live op scherm, ambassadeurs spelen showmatches.
- Iedereen deelt zijn startpositie (deelkaart) → tweede golf aanmeldingen.

### Fase 4 — Vasthouden (week +1 t/m +8)
- Wekelijkse "Ladder-update" (grootste stijger, langste reeks, upset van de week).
- Activatie: duo's zonder challenge na 7 dagen krijgen een herinnering met concrete
  tegenstanders uit hun tier (bestaande e-mailherinneringen + afmeldvoorkeuren).
- Na 8 weken: evaluatie en besluit volgende regio (zelfde draaiboek).

---

## 5. KPI's & stopregels

| KPI | Doel | Bron |
|---|---|---|
| Ingeschreven duo's bij lancering | ≥ 1.000 (min. 500) | DB |
| Viraliteitsfactor (nieuwe duo's per ingeschreven speler) | ≥ 0,6 | referral-tracking |
| % duo's met ≥1 gespeelde match in week 1–2 | ≥ 50% | Match |
| Wekelijks actieve duo's (week 4) | ≥ 40% | Challenge/Match |
| Forfeit-ratio | < 10% | RatingHistory (`is_forfeit`) |
| Duo's per speler | ~1,5 | Duo |
| Founding Clubs | ≥ 5 | sales |

**Stopregel:** staat de teller 3 weken voor lancering onder 40% van het doel, verlaag de
drempel naar 500 en communiceer dat als "Zwolle is er klaar voor — we gaan eerder open!".

---

## 6. Budget (indicatief, eerste regio)
| Post | Bedrag |
|---|---|
| Drukwerk (posters, QR-stickers op 30+ banen) | €300–600 |
| Ambassadeur-beloning (shirts/ballen/pet) | €500–1.000 |
| Ladder Day (baanhuur, scherm, prijzen) | €750–1.500 |
| Social ads (optioneel, met stopregel) | €1.000–2.500 |
| **Totaal** | **€2.500–5.600** |

---

## 7. Risico's
| Risico | Mitigatie |
|---|---|
| Teller blijft hangen | Stopregel (§5), club-battle, ambassadeurs persoonlijk laten werven |
| Te veel duo's in één tier → onoverzichtelijk | Op lanceerdag "aanbevolen tegenstanders" tonen (dashboard toont al dichtstbijzijnde tegenstanders) |
| Veel forfeits door overenthousiaste inschrijvers | Uitleg speelverplichting vóór inschrijving; forfeit-penalty blijft buiten ELO |
| Astroturfing-imago in WhatsApp/Facebook-groepen | Alleen posten waar het mag, transparant als maker (zie skill *Community & Reddit Marketing*) |
| Privacy | Publieke content alleen met weergavenamen; availability-API deelt nooit persoonsgegevens |
| Baantekort in regio | Clubs met daluren als partner; availability-API als hun voordeel positioneren |

---

## 8. Benodigde productwijzigingen (vragen PO-akkoord)
Geen van deze is gebouwd; elk vraagt expliciet akkoord en waarschijnlijk een schemawijziging.

1. **Regio-status `pre_launch`** + publieke wachtlijst/teller per regio (en per club).
2. **Unlock-drempel** in `platform_config` (bv. `region_launch_threshold`), ladder/challenges
   dicht tot de drempel of een handmatige go-live.
3. **Referral-tracking** op duo-uitnodigingen (wie bracht wie binnen) + badges.
4. **Founding Duo-label** (afgeleid uit inschrijfvolgorde/-datum, niet los opgeslagen waar dat kan).
5. **Deelkaarten** (Open Graph-afbeelding met duo-naam, positie, tier) — alleen weergavenamen.
6. Clubkoppeling aan duo ("thuisclub") voor de club-battle — optioneel.

---

## 9. Ondersteunende Claude-skills/plugins
| Plugin | Inzet in dit plan |
|---|---|
| **Marketing** (Anthropic) | `campaign-plan`, `draft-content`, `email-sequence`, `performance-report` — fasen uitwerken, posts en mails schrijven, resultaten rapporteren |
| **Marketing Ideas & Growth Experiments** | Kiest één hoofdbet + twee goedkope tests; zet pass/stop-lijnen voor ads/referral; rekent max. kosten per duo uit |
| **Community & Reddit Marketing** | `advocate-program` (ambassadeursprogramma met disclosure-kit), `venue-rules`/`community-post-check` vóór posten in groepen |
| **Social Media Skills** | Contentkalender, captions, carrousels, korte video's, `campaign-and-launch-planning` |

---

## Bronnen
- KNLTB/EY, *Padel in cijfers 2025*: https://www.nlpadel.nl/media/xvtejmk4/eyxknltb_padel_in_cijfers-2025.pdf
- EY, nieuwsbericht maart 2026: https://www.ey.com/nl_nl/newsroom/2026/03/padelspelers-in-nederland-groei-zet-door-nieuwe-fase-in-professionalisering
- Padelgids, ~900.000 padellers: https://padelgids.nl/padelnieuws/bijna-900000-padellers-in-nederland-maar-tekort-aa/
