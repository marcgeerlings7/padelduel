# Verdienmodel (voorstel, bescheiden)

**Advies in één zin:** houd de ladder zelf **altijd gratis** (het netwerkeffect is het product) en
verdien aan **clubs en regiosponsors** (B2B). Voeg pas later een klein betaald pakket voor spelers
toe, als de retentie bewezen is.

## Uitgangspunten
- Nooit betalen voor de kern: inschrijven, uitdagen, uitslagen, ladder. Elke betaaldrempel daar
  verkleint de pool tegenstanders, en die pool is waar je het voor doet.
- PRD §4: **geen advertenties**. Een naamsponsor van een regio is geen display-advertentie, maar
  vraagt wel een PO-besluit.
- Doel: kosten dekken + budget voor de lancering van de volgende regio (~€2.500–5.600, zie het marketingplan §6).

## Opties

| # | Stroom | Wat | Prijsidee | Past bij de USP? | Inspanning |
|---|---|---|---|---|---|
| 1 | **Clubpakket** | Club-pagina/club-teller, inzicht via de beschikbaarheids-API (wanneer willen duo's spelen), vermelding als partnerclub, Ladder Day op hun banen | €25–50 per locatie/maand | ✓ daluren vullen | Laag: de API bestaat al |
| 2 | **Regiosponsor** | "[Regio] Ladder, mogelijk gemaakt door [padelshop/merk]": logo op de ladderpagina, prijzen voor maandwinnaars | €500–2.000 per regio/jaar | ✓ lokaal, hype | Laag |
| 3 | **Events** | Ladder Day / "Regio Masters" (top-16 duo's, eenmalig), inschrijfgeld per duo, club host | €10–20 per duo | ✓ rivaliteit | Middel. Let op: geen seizoenen bouwen zonder PO-akkoord |
| 4 | **PadelDuel Plus** (spelers, later) | Uitgebreide statistieken (ratingverloop, scouting van tegenstanders, uitgebreid onderling resultaat), deelkaarten, profielbadge | €2,50/maand of €19/jaar | ~ (nice-to-have) | Middel–hoog: betaling + feature-gating |
| – | Affiliate (rackets, ballen) | Commissielinks | klein | ✗ voelt als advertentie | Afgeraden |

## Rekenvoorbeeld per regio (500 duo's ≈ 700 spelers), alles aannames
| Stroom | Berekening | Per jaar |
|---|---|---|
| Clubpakket | 5 clubs × €30 × 12 | €1.800 |
| Regiosponsor | 1 × €1.500 | €1.500 |
| Events | 2 × 32 duo's × €15 | €960 |
| Plus (later) | 5% van 700 spelers × €19 | €665 |
| **Totaal** | | **≈ €4.900** |

Bij 10 regio's: ~€50.000 per jaar. Niet gigantisch, maar genoeg om de kosten te dekken en
zelfstandig uit te breiden.

## Kosten om rekening mee te houden
- **Vercel Hobby is niet bedoeld voor commercieel gebruik.** Zodra er omzet is: overstappen naar Pro (~$20/maand per gebruiker; controleer de actuele prijs).
- Neon (database) en Resend (e-mail): gratis tiers zolang het volume klein is; bij meerdere regio's betaald.
- Betalingen: Mollie (iDEAL, NL) of Stripe; voor B2B is factureren in het begin genoeg (geen code nodig).

## Volgorde
1. **Nu (bij de eerste lancering):** regiosponsor + 1–2 betalende partnerclubs, handmatig gefactureerd. Geen code.
2. **Na 3 maanden live:** het clubpakket formaliseren (API-sleutel per club bestaat al).
3. **Na bewezen retentie (≥ 40% wekelijks actief):** PadelDuel Plus onderzoeken. Dit vraagt PO-akkoord + schemawijziging (abonnementen).
