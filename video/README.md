# Uitlegvideo PadelDuel (Remotion)

Losstaand Remotion-project (eigen `package.json`, valt buiten de Next-build).
Verticaal 1080×1920, 30 fps, ~34 s, zonder audio. Kleuren en lettertypen volgen
het Court-design system; de schermafbeeldingen in `public/shots/` komen uit de
app met de demo-accounts (regio Demo).

```bash
cd video
npm install
npm run studio   # live bewerken in de browser
npm run render   # → out/padelduel-uitleg.mp4
```

Teksten en scènes staan in `src/PadelDuelUitleg.tsx` (`STEPS`). Nieuwe
schermafbeeldingen: 390×844, deviceScaleFactor 2.

Licentie: Remotion is gratis voor individuen en bedrijven met maximaal 3
medewerkers; daarboven is een bedrijfslicentie nodig (zie remotion.dev/license).
