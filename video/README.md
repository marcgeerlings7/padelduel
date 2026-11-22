# Uitlegvideo PadelDuel (Remotion)

Losstaand Remotion-project (eigen `package.json`, valt buiten de Next-build).
Versies, verticaal 1080×1920, 30 fps:
- **v3 uitleg (standaard, `PadelDuelUitlegV3`)**: 52 s, na de gap-analyse (docs/marketing/08_Videoanalyse.md): AI-voice-over, weinig tekst, balwissel (bal vliegt van rechtsonder naar linksboven en laadt het volgende scherm), voorbeeldgetallen gemarkeerd.
- **v3 social (`PadelDuelSocialV3`)**: 20 s, met ondertitels voor kijken zonder geluid.
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

## Voice-over (AI)

`voice/generate.py` maakt de voice-over met **Piper TTS** (MIT, offline) en de
Nederlandse stem **nl-rdh-medium** (dataset CC0 1.0; licht Vlaamse tongval).
De stem (63 MB) staat niet in de repo: download hem van
https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-nl-rdh-medium.tar.gz
en draai `PIPER_VOICE=/pad/nl-rdh-medium.onnx npm run voice`. Het script schrijft
`public/audio/vo/*.wav` en `src/vo-timings.json`. Teksten staan in `LINES`.
Muziek onder de stem: volume 0,38 (≈ 15 dB onder de stem).
