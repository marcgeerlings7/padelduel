---
name: dev-env
description: Diagnose en herstel de lokale ontwikkelomgeving in de Codespace — Postgres-container, dev-server op :3000, migraties, seed, Playwright-browser, Claude/Vercel CLI. Gebruik bij "app start niet", "database niet bereikbaar", of na een Codespace-rebuild.
---

# Dev-omgeving herstellen

Alles is idempotent geregeld in `.devcontainer/start.sh` (draait bij elke Codespace-start). Eerste stap is meestal simpelweg:

```bash
bash .devcontainer/start.sh
```

## Losse checks
- Database: `docker ps --filter name=padel-ladder-db` → zo niet: `docker start padel-ladder-db`. Readiness: `docker exec padel-ladder-db pg_isready -U padel`.
- Migraties: `npx prisma migrate status`. Toepassen op dev: `npx prisma migrate deploy`. Wijzig het schema NOOIT zonder expliciete instructie (CLAUDE.md).
- Dev-server: log in `/tmp/padel-ladder-dev.log`; herstart met `pkill -f "next dev"; nohup npm run dev > /tmp/padel-ladder-dev.log 2>&1 &`.
- Seed: `npm run db:seed` (alleen op een lege dev-db).
- Playwright-browser: `npx playwright install --with-deps chromium`.
- Tools: `claude --version`, `vercel whoami` (inloggen: `vercel login`).

- graphify: `export PATH="$HOME/.local/bin:$PATH"; graphify update .` en `graphify hook install` (git-hooks staan niet in git).
- `npm ci` afgebroken (bijv. door geheugendruk) → `node_modules` is half leeg en `npx prisma` pakt dan een verkeerde globale versie. Draai `npm ci` opnieuw en controleer `ls node_modules/.bin/prisma`.
- Let op: `pkill -f "<patroon>"` kan je eigen shell raken als het patroon in de opdracht staat; stop servers liever via poort (`ss -ltnp`) + PID.

## Productie (Vercel + Neon)
- Status/logs: `vercel ls --prod`, `vercel inspect <deployment-url> --logs` (CLI moet ingelogd + gelinkt zijn: `vercel login`, `vercel link --project padelduel`).
- Publiek domein: https://padelduel.vercel.app (team-URL's zitten achter Vercel Authentication).
- Productie-DB-opdrachten: `vercel env pull --environment=production <scratchpad-bestand>`, `DATABASE_URL=<DATABASE_URL_UNPOOLED>` meegeven, bestand daarna verwijderen. Nooit `.env.local` en nooit `scripts/seed.ts`.

Rapporteer wat er mis was en wat je hersteld hebt; reset NOOIT de dev-database (`padel_ladder_dev`) zonder toestemming — die bevat handmatige testdata van de gebruiker.
