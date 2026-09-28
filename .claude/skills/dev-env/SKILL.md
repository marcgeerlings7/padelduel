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

Rapporteer wat er mis was en wat je hersteld hebt; reset NOOIT de dev-database (`padel_ladder_dev`) zonder toestemming — die bevat handmatige testdata van de gebruiker.
