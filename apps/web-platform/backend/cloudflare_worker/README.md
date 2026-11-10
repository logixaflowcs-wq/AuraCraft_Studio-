# AuraCraft Studio — Cloudflare Edge Telegram Bot Worker

Zero-cost, serverless Telegram bot webhook running on Cloudflare Workers (100,000 free requests per day).

## Features
- **Bot Username**: `@AuraCraftNexusBot` (https://t.me/AuraCraftNexusBot)
- **Supergroup Scoped**: Strictly bound to chat `-1003992125718`
- **Topic 215 Enforcement**: Messages outside Topic 215 are safely ignored (fail-closed)
- **Zero Compute Cost**: Runs entirely on Cloudflare Free Tier without paid Render workers
- **Edge Performance**: Sub-50ms response latency globally

---

## 1. Bot Credentials
- **Bot Name**: AuraCraft Studio
- **Username**: `@AuraCraftNexusBot`
- **Link**: https://t.me/AuraCraftNexusBot
- **Supergroup Chat ID**: `-1003992125718`
- **Bound Topic ID**: `215`

---

## 2. Deploy Cloudflare Worker (Zero Cost)
From `D:\Project\logixaflow.cs@gmail.com\AuraCraft_Studio-\apps\web-platform\backend\cloudflare_worker`:

```bash
# 1. Login to your free Cloudflare account
npx wrangler login

# 2. Set your Telegram Bot Token
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste the current token from your private password manager.

# 3. Set your Webhook Secret Token
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# Paste a strong, private webhook secret.

# 4. Set the two authorized owner IDs
npx wrangler secret put TELEGRAM_ALLOWED_USER_IDS

# 5. Deploy worker to Cloudflare Edge
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

You are all set! AuraCraft Studio Bot will now respond inside Topic #215 at zero cost.

## Webhook gateway configuration

Set `BACKEND_API_URL` to the HTTPS origin of the FastAPI deployment. The Worker validates the Telegram webhook secret and forwards the original update to `/api/telegram/webhook`; FastAPI is the only command processor and owns the Telegram bot token. Do not register both Worker and FastAPI as separate Telegram webhook destinations.
