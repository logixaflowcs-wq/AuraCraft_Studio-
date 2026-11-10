# 🔮 AuraCraft Studio — Real-Time 3D Virtual Persona & Neural Voice Studio

> **Project:** AuraCraft Studio  
> **Directory:** `D:\Project\logixaflow.cs@gmail.com\AuraCraft_Studio-`  
> **Mission:** 100% Free, Zero-Cost Real-Time 3D VRM Virtual Persona, Edge-TTS Neural Voice & Autonomous Live Streamer Engine  
> **Telegram Integration:** The Nexus Hub (`-1003992125718`) | Topic `#215` | Bot: `@AuraCraftNexusBot`  
> **Target Platforms:** Web Browser, OBS Studio Browser Source, YouTube Live, Twitch, Kick, Narrativ Forge Video Bridge  

---

## 🌟 Architecture Overview

```mermaid
graph LR
    User["User Voice / Telegram Bot (#215)"] --> AI["Edge AI Coordinator"]
    AI --> TTS["Microsoft Edge Neural TTS (Zero Cost)"]
    TTS --> LipSync["Web Audio FFT Viseme Extractor"]
    LipSync --> VRM["Three.js / WebGL 3D VRM Avatar"]
    VRM --> Bridge["Narrativ Forge Video Pack Export"]
    VRM --> OBS["OBS Studio / Virtual Camera / Stream"]
```

---

## ⚡ Technology Stack

1. **3D Avatar & Graphics Engine:**
   * **Three.js** + **`@pixiv/three-vrm`** (Global industry standard 3D humanoid avatar format).
   * Spring bone physics for dynamic hair and clothing.
   * Procedural blendshapes: Auto-blink, breathing idle motion, emotion facial morphs (happy, sad, angry, surprised, neutral).

2. **Real-Time Lip-Sync Engine:**
   * **Web Audio API** + **Audio AnalyserNode (Fast Fourier Transform)**.
   * Maps audio frequencies directly to VRM vowel blendshapes (`A`, `I`, `U`, `E`, `O`) in real-time with zero latency.

3. **Curated Multi-Style Archetypes:**
   * 🌸 **Anime & Manga Style**: Shinji Kazama (`ja-JP-KeitaNeural`), Sakura Hoshino (`ja-JP-NanamiNeural`)
   * 🎖️ **Army & Military Tactical**: General Min Zaw (`my-MM-ThihaNeural`), Captain John Vance (`en-US-GuyNeural`)
   * 🇲🇲 **Myanmar Traditional & Cultural**: Daw Nilar (`my-MM-NilarNeural`), Min Thar Thant Zin (`my-MM-ThihaNeural`)
   * ⚡ **VTuber & Cyberpunk Streamer**: Jenny Nova (`en-US-JennyNeural`)

4. **Speech Synthesis (TTS):**
   * **Microsoft Edge Neural TTS (`edge-tts`)** for zero-cost, human-quality neural voices in Burmese (`my-MM-NilarNeural`, `my-MM-ThihaNeural`), Japanese, and English.

5. **Telegram Bot Webhook (Topic #215 Scoped):**
   * **Cloudflare Workers (Edge)**: Zero-cost serverless webhook receiver (100,000 free requests/day) running without Render paid worker limits.
   * Enforces fail-closed isolation: updates outside Topic 215 are safely ignored.

6. **Narrativ Forge Video Bridge:**
   * One-click export syncing 3D persona metadata, voice bindings, and blendshapes directly into Narrativ Forge character registry for manga panels and AI video productions.

---

## 📁 Repository Structure

```
AuraCraft_Studio-/
├── .env.production          # Production environment configurations (Git ignored)
├── .env.production.example  # Public environment template
├── .gitignore               # Comprehensive exclusion rules
├── package.json             # Root monorepo workspace & launcher scripts
├── render.yaml              # Render blueprint for FastAPI backend & static frontend
├── README.md                # Project architecture & documentation
└── apps/
    └── web-platform/
        ├── frontend/        # React 19 / Vite / Three.js 3D Viewport & Studio UI
        │   ├── public/
        │   │   ├── avatars/ # Curated photo character portraits
        │   │   └── models/  # Bundled VRM 3D humanoid avatar models
        │   └── src/
        │       ├── audio/   # Web Audio API real-time FFT lip-sync analyzer
        │       ├── components/ # Viewport3D, LivePhotoStage, VoiceSelector, Controls
        │       └── pages/   # VideoStudio, Broadcast, Characters, Settings
        └── backend/         # FastAPI Python service & Edge-TTS engine
            ├── app/
            │   └── main.py  # FastAPI endpoints, Telegram webhook & Narrativ bridge
            ├── cloudflare_worker/ # Zero-cost Telegram Edge Webhook (wrangler.toml)
            └── tests/       # Test suite for archetypes and Topic 215
```

---

## 🚀 Quick Start

### 1. Launch AuraCraft Studio Locally
From repository root:
```bash
# Install dependencies
npm install

# Start Frontend Studio
npm run dev

# Start Backend Service (in another terminal)
npm run dev:backend
```

### 2. Run Tests
```bash
# Run Backend & Telegram Topic 215 Test Suite
npm run test:backend

# Run Frontend Typecheck & Build
npm run build
```

### 3. Deploy Zero-Cost Telegram Bot to Cloudflare
```bash
cd cloudflare_worker
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler deploy
```

## Telegram webhook architecture (audit hardening)

Cloudflare Worker is the public edge gateway. It validates the Telegram webhook secret and request size, then forwards the update to the single canonical FastAPI handler at `/api/telegram/webhook`. It also proxies browser API requests with the server-side `API_AUTH_TOKEN`; the token is never embedded in Vite. Set `BACKEND_API_URL` and the exact `ALLOWED_ORIGINS`, configure the same `API_AUTH_TOKEN` in Worker secrets and backend environment, and set frontend `VITE_API_URL` to the Worker origin. Do not configure Telegram to deliver the same bot updates directly to both services; that would duplicate replies. Keep `TELEGRAM_BOT_TOKEN` only in the backend environment.

The backend `/speak` and `/voice` commands synthesize real Edge-TTS audio and deliver it with Telegram `sendAudio`; `/export` sends the generated JSON persona pack as a Telegram document. `/import` downloads either a JSON `ManualPersonaPack` or a `.aura` ZIP from hosts listed in the backend `TELEGRAM_IMPORT_ALLOWED_HOSTS` comma-separated environment variable. ZIP imports validate the strict manifest, expanded-size limits, safe character ID, and mandatory VRM SHA-256 checksum before storing the VRM under the persistent data directory.

## Persistent Render storage

The backend stores its runtime JSON and render-plan data under `AURACRAFT_DATA_DIR`. Render mounts a 1GB persistent disk at `/data` and sets `AURACRAFT_DATA_DIR=/data`; this prevents deploy/restart cycles from discarding the character store. Render persistent disks require a paid web-service plan, so the backend service is configured as Starter. Review Render's current pricing before deploying this service. The audit does not trigger a deployment or purchase.

Set the backend `API_AUTH_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in the Render environment dashboard. Set `ALLOWED_ORIGINS` to the exact frontend origin. Configure the same `API_AUTH_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` as Cloudflare Worker secrets. Set Render's frontend `VITE_API_URL` to the Worker HTTPS origin; the browser must never receive the API bearer token.
