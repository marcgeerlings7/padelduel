#!/usr/bin/env bash
# Draait automatisch bij elke Codespace-start (postStartCommand).
# Idempotent: veilig om opnieuw te draaien als alles al actief is.
set -uo pipefail
cd /workspaces/padelduel || exit 0

# --- 0. .env (gitignored) aanmaken als die ontbreekt, met verse secrets ---
if [ ! -f .env ]; then
  # JOBS_SECRET en CRON_SECRET moeten gelijk zijn (zie .env.example);
  # JWT_SECRET krijgt een eigen waarde.
  rand_hex() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  JOBS=$(rand_hex)
  sed -E -e "/^JWT_SECRET=/s/change-me-to-a-random-secret/$(rand_hex)/" \
         -e "s/change-me-to-a-random-secret/$JOBS/" .env.example > .env
  echo "[start] .env aangemaakt op basis van .env.example"
fi

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

# --- 3b. Playwright-browser (voor `npm run test:e2e`) ---
# `npm install` installeert alleen het npm-pakket, NIET de browser-binaries
# (~/.cache/ms-playwright) en de benodigde systeem-libraries. Die staan
# buiten /workspaces en zijn dus na elke rebuild weg.
if ! ls "$HOME"/.cache/ms-playwright/chromium-* >/dev/null 2>&1; then
  echo "[start] Playwright Chromium installeren..."
  npx playwright install --with-deps chromium >/dev/null 2>&1 \
    || echo "[start] Playwright-installatie mislukt — draai handmatig: npx playwright install --with-deps chromium"
fi

# --- 4. Dev-server starten (indien nog niet actief) ---
if ! pgrep -f "next dev" >/dev/null; then
  nohup npm run dev > /tmp/padel-ladder-dev.log 2>&1 &
  disown
fi

# --- 4b. Claude Code CLI (idempotent) ---
# De VS Code-extensie komt via customizations.vscode.extensions; de
# `claude`-CLI voor de terminal installeren we hier. Inloggen blijft
# een eenmalige handmatige stap (`claude` → /login), tenzij er een
# Codespaces-secret CLAUDE_CODE_OAUTH_TOKEN is ingesteld.
if ! command -v claude >/dev/null 2>&1; then
  npm install -g @anthropic-ai/claude-code >/dev/null 2>&1 \
    && echo "[start] Claude Code CLI geïnstalleerd ($(claude --version 2>/dev/null))" \
    || echo "[start] Claude Code CLI-installatie mislukt — draai: npm install -g @anthropic-ai/claude-code"
fi

# --- 4c. graphify (knowledge graph voor Claude Code, hooks in .claude/settings.json) ---
export PATH="$HOME/.local/bin:$PATH"
if ! command -v graphify >/dev/null 2>&1; then
  command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
  uv tool install "graphifyy[sql]" >/dev/null 2>&1 \
    || echo "[start] graphify-installatie mislukt — draai: uv tool install 'graphifyy[sql]'"
fi
command -v graphify >/dev/null 2>&1 && graphify update . >/dev/null 2>&1

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
