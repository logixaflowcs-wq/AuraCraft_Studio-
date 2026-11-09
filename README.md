# AuraCraft Studio

AuraCraft Studio is a React/Vite virtual-avatar studio with a FastAPI service, Edge-TTS audio generation, character packs, a local video-plan manifest workflow, and an optional Cloudflare Telegram bot.

## Current architecture

- Frontend: React 19, TypeScript, Vite, Three.js and @pixiv/three-vrm.
- Backend: FastAPI, Pydantic and edge-tts.
- Voice: POST /api/tts/synthesize returns MPEG audio. Voice generation requires outbound access to the Edge-TTS service.
- Characters: GET/POST /api/characters and JSON pack import/export endpoints.
- Video Studio: creates and stores a reviewable JSON render plan. It does not render an MP4/video.
- Telegram: Cloudflare Worker restricts commands to the configured supergroup, forum topic and numeric user allowlist. It calls the FastAPI backend for characters, speech and JSON downloads.
- OBS: use the browser overlay route (?obs=true) after configuring the frontend/backend URLs.

Narrativ Forge is not connected to a live remote API in this repository. The export command sends a standalone JSON file; it must not be described as a remote sync.

## Repository layout

    apps/
      mobile/                         Mobile companion placeholder
      web-platform/
        backend/
          app/main.py                 FastAPI routes and services
          data/characters.json        Curated character catalogue
          cloudflare_worker/          Telegram Cloudflare Worker
          tests/                      Backend and Telegram policy tests
        frontend/
          public/                      Static images and VRM assets
          src/                         React application
    package.json                       Root scripts
    package-lock.json                  Reproducible npm dependency lock
    render.yaml                        Render backend service blueprint
    vercel.json                        Vercel frontend build configuration

## Local development

Requirements: Node.js 20+ and Python 3.11+.

    npm ci
    python -m venv .venv
    # Windows: .venv\Scripts\activate
    # macOS/Linux: source .venv/bin/activate
    pip install -r apps/web-platform/backend/requirements.txt

Start the frontend:

    npm run dev

Start the backend in another terminal:

    npm run dev:backend

The frontend uses http://localhost:8010 for the API in development. Set VITE_API_URL to override it.

## Verification

    npm ci
    npm run build
    npm run test:backend
    npm run test:worker
    node --check apps/web-platform/backend/cloudflare_worker/index.js

The backend tests use temporary directories for generated character data and render plans so they do not modify the checked-in catalogue.

## Backend configuration

Important environment variables:

- APP_ENV=production
- CORS_ORIGINS: comma-separated exact frontend origins. Do not use wildcard origins in production.
- TELEGRAM_CHAT_ID and TELEGRAM_TOPIC_ID: backend webhook scope.
- TELEGRAM_WEBHOOK_SECRET: Telegram webhook secret for the optional FastAPI webhook route.
- TELEGRAM_ALLOWED_USER_IDS: comma-separated numeric Telegram user IDs. The backend webhook fails closed if this is empty.
- API_ADMIN_KEY: long random secret required for production character create/import/export mutation endpoints. Send it as X-AuraCraft-Admin-Key from trusted server-side tools only; do not embed it in frontend code.
- AURACRAFT_DATA_DIR: optional writable data directory. Use this only when the deployment has a persistent mounted volume.

Render currently uses a free web service. Its filesystem is ephemeral; character edits and generated plans can be lost when the service restarts or redeploys. Durable server-side character storage requires a persistent disk or database. A persistent Render disk is a paid resource and is intentionally not provisioned by this repository blueprint.

## Telegram Worker deployment

From apps/web-platform/backend/cloudflare_worker:

    npx wrangler login
    npx wrangler secret put TELEGRAM_BOT_TOKEN
    npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
    npx wrangler secret put TELEGRAM_ALLOWED_USER_IDS
    npx wrangler deploy

Set BACKEND_API_URL in wrangler.toml to the HTTPS FastAPI origin before deploying. The default value is the repository's Render service hostname; change it if your service uses another domain.

Register the Worker URL as the Telegram webhook using setWebhook and the same webhook secret. Never commit bot tokens or webhook secrets. The user allowlist is mandatory: commands are ignored when it is missing or the sender is not listed.

Supported commands in the configured topic:

- /status
- /characters
- /speak text
- /voice character_id text
- /export character_id

The Worker sends generated audio and JSON packs as Telegram attachments. It does not claim an export has reached Narrativ Forge.

## Deployment notes and limitations

- Frontend production API default: https://auracraft-backend.onrender.com. Override with VITE_API_URL if the backend has a different domain.
- The Render blueprint allows the Netlify origin shown in render.yaml. Update CORS_ORIGINS to your exact deployed frontend origin if it changes.
- Cloudflare secrets and Telegram webhook registration must be configured in the Cloudflare account; a GitHub change alone cannot provision those credentials.
- Video Studio currently produces a JSON plan only. Actual video rendering requires a separately selected render engine/provider.
- OBS browser overlay and live broadcast output must be tested against the actual browser, capture device and streaming setup before production use.
- Edge-TTS availability in the health response indicates the backend package is installed; it does not guarantee the upstream speech service is reachable at every moment.
