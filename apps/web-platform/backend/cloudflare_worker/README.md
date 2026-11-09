# AuraCraft Studio — Cloudflare Edge Telegram Bot Worker

Serverless Telegram bot webhook running on Cloudflare Workers. Check the current Cloudflare plan limits before deployment.

## Features
- **Bot Username**: `@AuraCraftNexusBot` (https://t.me/AuraCraftNexusBot)
- **Supergroup Scoped**: Strictly bound to chat `-1003992125718`
- **Topic 215 Enforcement**: Messages outside Topic 215 are safely ignored (fail-closed)
- **Backend integration**: `/status`, `/characters`, `/speak`, `/voice`, and `/export` call the configured FastAPI backend; audio and JSON files are sent as Telegram attachments.
- **Fail-closed access**: Missing user allowlist, chat ID, topic ID, bot token, or webhook secret cannot authorize a command.
- **Real health check**: GET /health checks the configured FastAPI backend and reports degraded status when the backend or Telegram secrets are unavailable.
- **Zero Compute Cost**: Runs on Cloudflare Workers; the FastAPI backend remains a separate service.

---

## 1. Bot Credentials
- **Bot Name**: AuraCraft Studio
- **Username**: `@AuraCraftNexusBot`
- **Link**: https://t.me/AuraCraftNexusBot
- **Supergroup Chat ID**: `-1003992125718`
- **Bound Topic ID**: `215`

---

## 2. Deploy Cloudflare Worker (Zero Cost)
From the repository directory apps/web-platform/backend/cloudflare_worker:

```bash
# 1. Login to your free Cloudflare account
npx wrangler login

# 2. Set your Telegram Bot Token
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste the current token from your private password manager.

# 3. Set your Webhook Secret Token
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# Paste a strong, private webhook secret.

npx wrangler secret put TELEGRAM_ALLOWED_USER_IDS
# Enter only authorized Telegram numeric user IDs, comma-separated.

# 4. Confirm BACKEND_API_URL in wrangler.toml points to your HTTPS backend
# 5. Deploy worker to Cloudflare
npx wrangler deploy
```

---

## 3. Register Webhook with Telegram
Once deployed, you will get a URL like `https://auracraft-studio-telegram-worker.<your-subdomain>.workers.dev`.
Register it with Telegram via browser or curl:

```bash
curl -F "url=https://auracraft-studio-telegram-worker.<your-subdomain>.workers.dev" \
     -F "secret_token=<your-private-webhook-secret>" \
     https://api.telegram.org/bot<your-private-bot-token>/setWebhook
```

Or open in browser:
```
Use Telegram's Bot API with the same two private values; do not place either credential in a browser URL or documentation.
```

After deployment, verify GET /health reports the backend as healthy. The Worker does not claim Narrativ Forge is connected: exports are downloadable standalone JSON packs until a real destination API is configured.
