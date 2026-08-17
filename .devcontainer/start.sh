#!/usr/bin/env bash
# Draait automatisch bij elke Codespace-start (postStartCommand).
# Idempotent: veilig om opnieuw te draaien als alles al actief is.
set -uo pipefail
cd /workspaces/padelduel || exit 0

# --- 1. Lokale Postgres-container (dev-database) ---
if docker ps --format '{{.Names}}' | grep -qx padel-ladder-db; then
  : # draait al
elif docker ps -a --format '{{.Names}}' | grep -qx padel-ladder-db; then
  docker start padel-ladder-db >/dev/null
else
  # Verse container mét volume, zodat data een herstart/rebuild overleeft
  # (zie docs/Technical_Debt.md — dit was eerder niet het geval).
  docker run -d --name padel-ladder-db \
    -e POSTGRES_USER=padel \
    -e POSTGRES_PASSWORD=padel \
    -e POSTGRES_DB=padel_ladder_dev \
    -p 5432:5432 \
    -v padel-ladder-db-data:/var/lib/postgresql/data \
    postgres:16-alpine >/dev/null
fi

for i in $(seq 1 30); do
  docker exec padel-ladder-db pg_isready -U padel >/dev/null 2>&1 && break
  sleep 1
done

# --- 2. Aparte test-database (voor Playwright e2e, zie playwright.config.ts) ---
docker exec padel-ladder-db psql -U padel -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = 'padel_ladder_test'" | grep -q 1 \
  || docker exec padel-ladder-db psql -U padel -d postgres -c "CREATE DATABASE padel_ladder_test" >/dev/null

# --- 3. Dependencies + migraties (idempotent) ---
[ -d node_modules ] || npm install --no-audit --no-fund
npx prisma migrate deploy >/dev/null 2>&1

# Seed alleen als de dev-db nog leeg is (niet elke herstart opnieuw).
REGION_COUNT=$(docker exec padel-ladder-db psql -U padel -d padel_ladder_dev -tAc "SELECT count(*) FROM region" 2>/dev/null || echo 0)
if [ "$REGION_COUNT" = "0" ]; then
  npx tsx scripts/seed.ts >/dev/null 2>&1
fi

# --- 4. Dev-server starten (indien nog niet actief) ---
if ! pgrep -f "next dev" >/dev/null; then
  nohup npm run dev > /tmp/padel-ladder-dev.log 2>&1 &
  disown
fi

# --- 5. Vercel CLI: installeren (idempotent) + inlog-status checken ---
# `vercel login` opent een echte browser-popup/magic-link-flow en vraagt
# interactief om invoer (e-mailadres of auth-provider-keuze) — dat kan
# niet betrouwbaar automatisch/non-interactief vanuit postStartCommand
# gedaan worden (geen gekoppelde TTY). We zorgen daarom alleen dat de CLI
# er sowieso staat, en laten duidelijk zien of er nog ingelogd moet
# worden — dat login-popup-moment doet de gebruiker zelf, één keer, in
# een terminal.
if ! command -v vercel >/dev/null 2>&1; then
  npm install -g vercel >/dev/null 2>&1
fi

if command -v vercel >/dev/null 2>&1; then
  if vercel whoami >/dev/null 2>&1; then
    echo "[vercel] ingelogd als $(vercel whoami 2>/dev/null)"
  else
    echo "[vercel] nog niet ingelogd — draai 'vercel login' in een terminal om in te loggen (opent een browser-popup)."
  fi
fi
