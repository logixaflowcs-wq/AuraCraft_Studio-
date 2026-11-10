# AuraCraft Studio Cloudflare Edge Gateway

The Worker provides two routes:

- `POST /webhook`: validates Telegram's webhook secret and a 64KB body cap, then forwards the update to the canonical FastAPI `/api/telegram/webhook` handler.
- Other `/api/*` and `/ready` requests: checks the exact `ALLOWED_ORIGINS` list, injects the server-side `API_AUTH_TOKEN`, and proxies the request to FastAPI. The token must never be placed in a Vite environment variable or browser bundle.

## Configure and deploy

From this directory:

```bash
npm ci
npm test
npm run lint
```

Set `BACKEND_API_URL` and `ALLOWED_ORIGINS` in `wrangler.toml` to your actual HTTPS backend and frontend origins. Then configure secrets:

```bash
npx wrangler secret put API_AUTH_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler deploy --dry-run
npx wrangler deploy
```

`API_AUTH_TOKEN` must match the backend Render environment variable. `TELEGRAM_WEBHOOK_SECRET` must match the backend webhook secret. Keep `TELEGRAM_BOT_TOKEN` only in the backend environment. The backend also requires `ALLOWED_ORIGINS` to match the frontend origin.

Set the Render static-site environment variable `VITE_API_URL` to the deployed Worker origin. Do not set `VITE_API_AUTH_TOKEN`.

Register Telegram's webhook to `https://<worker-host>/webhook` using the same webhook secret. Do not also register the backend as a second webhook destination; the Worker forwards each update to FastAPI.

## Optional R2 storage

A commented R2 binding is included in `wrangler.toml`. Create the bucket and uncomment the binding only when the application begins using it.
