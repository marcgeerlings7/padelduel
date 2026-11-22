# Uitlegvideo PadelDuel (Remotion)

Losstaand Remotion-project (eigen `package.json`, valt buiten de Next-build).
Twee versies, verticaal 1080×1920, 30 fps:
- **v2 (standaard, `PadelDuelUitlegV2`)**: 52 s, opgebouwd rond de USP-pijlers met geanimeerde uitleg per stap (duo vormen, tiers, plaatsingsperiode, tijdlijn uitdaging → rating, vergelijking) en muziek.
- v1 (`PadelDuelUitleg`): 34 s, schermafbeeldingen, zonder audio.
 Kleuren en lettertypen volgen
het Court-design system; de schermafbeeldingen in `public/shots/` komen uit de
app met de demo-accounts (regio Demo).

```bash
cd video
npm install
npm run studio   # live bewerken in de browser
npm run render   # → out/padelduel-uitleg-v2.mp4 (v1: npm run render:v1)
# Laatste renders staan in renders/ (v1 en v2).
npm run music    # muziek opnieuw genereren (python3 + numpy + scipy)
```

Teksten en scènes staan in `src/PadelDuelUitleg.tsx` (`STEPS`). Nieuwe
schermafbeeldingen: 390×844, deviceScaleFactor 2.

Licentie: Remotion is gratis voor individuen en bedrijven met maximaal 3
medewerkers; daarboven is een bedrijfslicentie nodig (zie remotion.dev/license).

## Muziek (rechtenvrij)

`public/audio/music.wav` is zelf gecomponeerd en volledig synthetisch
gegenereerd door `music/compose.py` (geen samples, geen bestaande muziek):
120 BPM, A-mineur, met padelbal-"pok" en whooshes op de scènewissels. Daardoor
zijn er geen rechten van derden en geen licentievoorwaarden. De scènes in v2
vallen op de maat (1 maat = 60 frames).
