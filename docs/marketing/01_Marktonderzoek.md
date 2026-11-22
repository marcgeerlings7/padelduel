# Marktonderzoek PadelDuel

| | |
|---|---|
| **Onderzoeksdatum** | 2026-11-22 (desk research, openbare bronnen) |
| **Methode** | Competitive brief (Marketing-plugin) + doelgroep- en regio-analyse |
| **Beperking** | Het rapport *Padel in cijfers 2025* (KNLTB/EY) kon niet volledig worden ingelezen; cijfers per provincie zijn deels afkomstig uit samenvattingen/nieuwsberichten. Controleer §3 tegen p. 41 van het rapport vóór de regiokeuze. |

---

## 1. Samenvatting (de 5 dingen die het plan veranderen)

1. **De markt is groot, maar het competitieve deel is klein.** ~876.000 Nederlanders speelden in
   2025 padel, gemiddeld ~350.000 per maand. Bij tennis noemt maar **~20%** competitie/toernooien
   als motief (54% gezelligheid, 45% plezier). Als padel vergelijkbaar is (aanname), is de
   échte doelgroep ~1 op de 5 spelers.
2. **1.000 duo's vraagt een verzorgingsgebied van ~1 miljoen inwoners**, niet 400.000 (§4).
   Voor een middelgrote regio is **400–500 duo's** het realistische unlock-doel.
3. **De grootste dreiging is de KNLTB zelf:** de bond rolt één officiële rating per speler uit
   (KNLTB-ID, ook voor niet-leden) en bundelt boeken, lessen en wedstrijden in *Meet & Play*;
   open matches gaan (gewogen) meetellen voor de rating.
4. **De grootste kans is wat de KNLTB níet doet:** de rating is **individueel** en club-/competitie-
   gestuurd. Niemand bezit "de ranking van jullie duo" + vrij uitdagen in je regio. Spelers
   klagen expliciet over *medespelers op niveau vinden* en *cluboverstijgend spelen* — precies
   wat PadelDuel oplost.
5. **Baanschaarste is het praktische knelpunt.** Spelers groeien harder dan banen; Noord-Holland
   heeft de meeste spelers per baan. Een ladder die tot méér wedstrijden leidt, moet clubs
   helpen hun **daluren** te vullen (availability-API) — anders wordt het een frustratie-app.

**Kernpositionering (voorstel):**
> *"Je KNLTB-rating zegt hoe goed jíj bent. PadelDuel zegt hoe goed jullie sámen zijn."*

---

## 2. Concurrentielandschap

### 2.1 Overzicht
| Speler | Wat het is | Rating/ranking | Duo-identiteit | Vrij uitdagen in regio | Boeken | Bedreiging |
|---|---|---|---|---|---|---|
| **KNLTB (rating + Meet & Play)** | Bond: competities, toernooien, officiële rating; nieuw centraal platform | Individueel, officieel, ook voor niet-leden (KNLTB-ID) | Nee | Open matches (komend), geen ladder | Ja (Meet & Play) | **Hoog** — autoriteit + bereik |
| **Playtomic** | Grootste boekingsmarktplaats, open matches | Individueel niveau 0–7 met betrouwbaarheid; club- en globale rankings | Nee | Open matches per club | Ja | Middel — gewoonte-app van spelers |
| **KNLTB-competitie (team)** | Seizoenscompetities (voorjaar/zomer/najaar/winter, poules van 6–8 teams) | Indeling op rating | Teamverband | Nee (vast schema) | n.v.t. | Laag–middel — concurreert om dezelfde avonden |
| **Kleine ladder-/rank-apps** (Padel Ladder, RNKD Padel, Padel Rankup, Clubladder/ClubMatch, Padel Games (NL)) | Losse ladders, score-trackers | Wisselend, vaak per club of individueel | Soms | Soms, zonder regionale schaal | Nee | Laag — versnipperd, geen netwerkeffect |
| **WhatsApp-competities / clubladders** | Zelfgeorganiseerd door trainers en fanatiekelingen | Excel/handmatig | Ja | Binnen de groep | Nee | **Laag als concurrent, hoog als bondgenoot** |

### 2.2 Narratief per hoofdconcurrent
| | KNLTB | Playtomic | PadelDuel (voorstel) |
|---|---|---|---|
| **Vijand** | Versnippering van apps en ratings | Gedoe met baan en medespelers vinden | Altijd dezelfde tegenstanders, nooit weten hoe goed jullie samen zijn |
| **Held** | De bond / het systeem | De speler die snel speelt | Het duo |
| **Belofte** | Eén officiële rating en één platform | Speel wanneer en waar je wilt | Een eerlijke regionale ranking, rivaliteit en nieuwe tegenstanders op niveau |
| **Toon** | Institutioneel | Lifestyle, internationaal | Competitief, speels, lokaal trots |

### 2.3 Positioneringskaart (individueel ↔ duo, club ↔ regio)
```
                 REGIO (cluboverstijgend)
                          │
     KNLTB-rating/        │        ★ PadelDuel
     Meet & Play          │        (duo + regio + uitdagen)
                          │
INDIVIDU ─────────────────┼───────────────── DUO
                          │
     Playtomic levels     │        WhatsApp-ladders,
     & club rankings      │        clubladder-apps
                          │
                    CLUB (lokaal)
```
Het kwadrant **duo × regio** is leeg. Dat is de categorie om te claimen: *"de regioladder voor duo's"*.

### 2.4 Kansen
- **Duo-identiteit** (naam, eigen rating per koppel, onderling resultaat, W-L-reeks) is uniek en
  emotioneel: rivaliteit tussen vriendenkoppels is het verhaal.
- **Cluboverstijgend** spelen: spelers vragen erom, clubs organiseren het niet.
- **Clubs als partner** i.p.v. concurrent: PadelDuel boekt niets en stuurt spelers naar hun banen;
  de availability-API helpt daluren te vullen.
- **WhatsApp-organisatoren** draaien nu handmatig ladders in Excel — PadelDuel neemt hun werk over.
  Zij zijn de natuurlijke ambassadeurs.
- **Aansluiten op de KNLTB i.p.v. ertegenin:** de optionele speelsterkte in het spelersprofiel kan
  later dienen om de startrating te bepalen (idee, vraagt PO-akkoord).

### 2.5 Bedreigingen
- KNLTB *open matches* tellen mee voor de officiële rating → spelers kunnen zeggen "ik heb al een rating".
  **Antwoord:** dat is je individuele niveau; PadelDuel gaat over jullie duo en rivaliteit in de regio.
- Playtomic is al geïnstalleerd en dagelijks in gebruik; een extra app moet zich in de eerste week bewijzen.
- Baanschaarste: als uitdagingen niet gespeeld kunnen worden → forfeits → frustratie.
- Concurrerende avonden: KNLTB-competitieseizoenen (controleer het speelschema van het voorjaar
  2027 voordat de lanceerdatum vastligt).

### 2.6 Bezwaren en antwoorden
| Speler zegt… | Antwoord |
|---|---|
| "Ik heb al een KNLTB-rating." | "Klopt, die zegt hoe goed jíj bent. Hier zie je hoe goed jullie als duo zijn, en tegen wie in de regio." |
| "Ik gebruik al Playtomic." | "Blijf daar lekker boeken. PadelDuel bepaalt tegen wie je speelt en wat het oplevert." |
| "Weer een app…" | "Het is een webapp, je hoeft niets te installeren, en je inschrijving is pas definitief als de regio vol is." |
| "Ik heb geen vaste partner." | "Je kunt in meerdere duo's spelen: schrijf je in met elke vaste partner." |

---

## 3. Doelgroep

| Segment | Aandeel (indicatie) | Motief | Rol in de lancering |
|---|---|---|---|
| **Competitieve recreant** (25–45 jaar, 1–3×/week) | ~20% van de spelers (aanname, gebaseerd op het tennismotief) | Beter worden, winnen, status | Kerngebruiker |
| **Vriendenkoppels / vaste duo's** | overlap met het segment hierboven | Bewijzen wie de beste is | Viraliteit (onderling resultaat, uitdagen) |
| **Sociale spelers** | ~50%+ | Gezelligheid | Zijlijn: volgen de ladder, spelen soms. Niet de primaire doelgroep |
| **Organisatoren / trainers** | klein | Community, minder Excel-werk | Ambassadeurs |
| **Clubs / padelcentra** | ~627 locaties in NL (eind 2024) | Daluren vullen, binding | Distributie: posters, nieuwsbrief, events |

**Taal van de doelgroep** (gebruiken in de content): "op niveau spelen", "nieuwe tegenstanders",
"wie is de beste van [stad]", "revanche", "ons duo", "baan geboekt?".

---

## 4. Kritische massa, herberekend per regiogrootte

**Formule:** haalbare duo's ≈ inwoners × 2,0% (speelt maandelijks) × 20–30% (competitief, aanname)
× 30% (bereikt en ingeschreven in 8 weken, aanname) ÷ 1,4 (spelers per duo, rekening houdend met multi-duo).

| Verzorgingsgebied | Maandelijkse spelers | Competitief (20–30%) | Ingeschreven (30%) | ≈ Duo's | Unlock-doel |
|---|---|---|---|---|---|
| 250.000 | 5.000 | 1.000–1.500 | 300–450 | 210–320 | **250** |
| 400.000 | 8.000 | 1.600–2.400 | 480–720 | 340–510 | **400–500** |
| 750.000 | 15.000 | 3.000–4.500 | 900–1.350 | 640–960 | **750** |
| 1.000.000+ | 20.000+ | 4.000–6.000 | 1.200–1.800 | 860–1.290 | **1.000** |

Conclusie: **1.000 duo's alleen in een metropool of een sterk verbonden regio van ≥ 1 miljoen inwoners.**
De ondergrens voor een levende ladder blijft **150–200 actieve duo's** (zie het marketingplan §1.2).

---

## 5. Regiokeuze: criteria en kandidaten

| Criterium | Waarom | Weging |
|---|---|---|
| Inwoners binnen ~25 min reistijd | Bepaalt het haalbare aantal duo's (§4) | 30% |
| Banen per speler (niet te schaars) | Uitdagingen moeten gespeeld kunnen worden | 25% |
| Aantal grote centra (≥ 5 banen) die partner willen worden | Distributie + Ladder Day | 20% |
| Bestaande WhatsApp-/clubladders | Kant-en-klare ambassadeurs | 15% |
| Persoonlijk netwerk van het team | Snelle start, geloofwaardigheid | 10% |

| Kandidaat | Voor | Tegen |
|---|---|---|
| **Eindhoven e.o. (Brabant)** | Brabant had eind 2024 de meeste banen en verenigingen; stedelijk en compact | Controleren hoeveel banen er rond Eindhoven zelf zijn |
| **Utrecht e.o.** | Centraal, groot, jong publiek | Mogelijk baanschaarste |
| **Regio Zwolle** | Al in seed/e2e-data; overzichtelijke markt; nog niet verzadigd | Kleiner verzorgingsgebied: unlock-doel 400–500, niet 1.000 |
| Amsterdam / Noord-Holland | Grootste markt | Meeste spelers per baan → risico dat uitdagingen niet gespeeld worden |

**Advies:** wil je per se met 1.000 duo's starten, kies dan **Eindhoven of Utrecht**. Wil je de
eerste regio zo veilig mogelijk laten slagen, kies dan **Zwolle met een unlock-doel van 500** en
communiceer dat als "vol". Een volle ladder van 500 maakt meer hype dan een halflege van 1.000.

---

## 6. Wat nog uitgezocht moet worden (goedkope checks)
1. Banen per provincie/gemeente uit *Padel in cijfers 2025* p. 41 (handmatig, PDF).
2. 10 gesprekken met spelers in de gekozen regio: "zou je je duo inschrijven als de ladder pas
   opengaat bij 500 duo's?" (meet de echte bereidheid i.p.v. de aanname van 30%).
3. 5 clubgesprekken: wat zijn hun daluren, en willen ze een poster/QR + Ladder Day hosten?
4. De status van de KNLTB-ID en de rating voor open matches volgen (lanceerdatum, of niet-leden
   echt meedoen).

---

## Bronnen
- KNLTB/EY, *Padel in cijfers 2025*: https://www.nlpadel.nl/media/xvtejmk4/eyxknltb_padel_in_cijfers-2025.pdf
- EY, *Padelspelers in Nederland: groei zet door* (mrt 2026): https://www.ey.com/nl_nl/newsroom/2026/03/padelspelers-in-nederland-groei-zet-door-nieuwe-fase-in-professionalisering
- KNLTB, *Padel in cijfers 2024*: https://www.centrecourt.nl/media/flfpssp4/padel-in-cijfers-onderzoeksrapport-2024.pdf
- Padelgids, *KNLTB lanceert universele rating en centraal platform*: https://padelgids.nl/padelnieuws/knltb-lanceert-een-universele-rating-en-centraal-p/
- KNLTB spelerspanel *Alles in 1 digitaal platform (Next Match)* 2024: https://knltb.nl/media/ioefazbm/spelerspanel-alles-in-1-digitaal-platform-next-match-2024.pdf
- KNLTB, *Strategische doorkijk 2021–2025* (motieven, tennis): https://knltb.nl/media/dj2h1vyq/knltb-strategische-doorkijk-2021-2025.pdf
- KNLTB, *Wedstrijdbulletin padel 2026*: https://www.knltb.nl/media/lbcbqi1r/wedstrijdbulletin-2026-knltb-padel.pdf
- Playtomic, levelsysteem: https://playerhelp.playtomic.com/hc/en-gb/articles/43310980754193-How-the-Playtomic-level-system-works
- Playtomic, rankings: https://intercom.help/getplaytomic/en/articles/4261735-playtomic-rankings
- KNLTB Meet & Play (App Store): https://apps.apple.com/nl/app/knltb-meet-play/id1578437957
- Ladder-apps (App Store): Padel Ladder https://apps.apple.com/us/app/-/id6742781626 · RNKD Padel https://apps.apple.com/app/id6758425886 · Padel Rankup https://apps.apple.com/app/id6754931155 · Clubladder https://apps.apple.com/nl/app/clubladder/id979965331 · Padel Games https://apps.apple.com/be/app/padel-games/id1661138935
