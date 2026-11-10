# AuraCraft Studio — Audit Fix Report

**Repository:** `logixaflowcs-wq/AuraCraft_Studio-`  
**Target branch:** `audit/fix-all-20261110`  
**Base branch:** `main` (not modified)  
**Review mode:** source-level changes plus local automated validation; no production deployment was performed.

| Audit ID | File(s) | Change | Test / evidence | Status |
|---|---|---|---|---|
| 1-A | `backend/cloudflare_worker/index.js` | Replaced duplicate Worker declarations/exports with one canonical edge gateway implementation. | `node --check index.js`; Wrangler dry-run. | PASS |
| 1-B | `backend/app/main.py`, Worker `index.js` | Added Bearer `require_auth`, constant-time token comparison, generic 401; protected TTS, character mutation/import/export, and avatar-video mutation routes. Worker injects the server-side token so it never enters Vite. | `test_mutating_character_endpoint_requires_bearer_token`; Worker proxy test verifies Authorization injection. | PASS |
| 1-C | `backend/app/main.py`, `backend/tests/test_audit_security.py` | Enforced `^[a-zA-Z0-9_-]{1,64}$` IDs, resolved-path containment checks, atomic temporary-file writes, and safe VRM asset paths. | Traversal regression tests for `../`, backslashes, absolute paths, and NUL IDs. | PASS |
| 1-D | `backend/app/main.py`, Worker `index.js`, `render.yaml` | Replaced wildcard CORS with explicit `ALLOWED_ORIGINS`; production startup fails when empty; Worker enforces the same explicit browser-origin allowlist. | Production CORS startup test; Worker allowed-origin and preflight tests. | PASS |
| 1-E | `backend/app/main.py`, Worker `index.js` | Added 10 requests/minute per client IP + token TTS limiter, `Retry-After`, bounded bucket cardinality, and trusted edge-forwarded client IP. | Backend test suite; Worker verifies `CF-Connecting-IP` forwarding. | PASS |
| 1-F | `backend/app/main.py` | Added generic exception responses and server-side structured exception logging; removed exception-string leakage from TTS and Telegram delivery errors. | `test_unhandled_exception_response_does_not_leak_details`. | PASS |
| 1-G | `backend/app/main.py` | Imported `html`; escaped user-supplied Telegram text in `/speak`, `/voice`, `/render`, `/export`, and `/import` responses. | Telegram HTML escaping regression test. | PASS |
| 1-H | Worker `index.js`, `backend/app/main.py` | Added constant-time webhook-secret comparison, constant-time Telegram user-ID allowlist comparison, 64KB webhook body cap, guarded JSON parsing, and generic Worker errors. | Worker secret/body/invalid-JSON tests; backend Telegram allowlist tests. | PASS |
| 1-I | `frontend/src/services/exportService.ts`, `frontend/src/types/character.ts`, backend Aura importer | Made VRM SHA-256 mandatory; strict Zod manifest schema rejects unknown keys; capped expanded ZIP at 200MB, VRM at 100MB, manifest at 256KB, and images at 5MB. Backend `.aura` importer applies equivalent checks before storing VRM assets. | `exportService.test.ts`; Aura checksum, unsafe-ID, unknown-key, path, and size regression tests. | PASS |
| 2-A | `backend/app/main.py`, `backend/requirements.txt` | Added Pydantic character-store validation, timestamped corrupt-file backup, `filelock`, atomic writes, and configurable persistent data directory. | Corrupt JSON/schema backup tests; atomic-save test. | PASS |
| 2-B | Worker `index.js`, `backend/app/main.py`, `README.md` | Worker is the single edge ingress and forwards Telegram updates to one FastAPI command handler. `/speak` and `/voice` call authenticated `POST /api/tts/synthesize` and return Telegram audio file IDs; `/export` sends the generated JSON pack as a Telegram document; `/import` downloads allowlisted JSON or `.aura` ZIP packages, validates them, and persists VRM files. Telegram Bot API responses are checked for both HTTP success and `ok`. | Worker forwarding test; authenticated TTS proxy test; Telegram voice/export tests; Aura archive import tests. | PASS |
| 2-C | `backend/app/main.py` | `/health` is liveness-only; `/ready` verifies persistent storage access and Edge-TTS voice-list reachability. | Readiness test with controlled TTS response. | PASS |
| 3-A | `frontend/src/db/database.ts`, `App.tsx`, `PhotoAvatarPage.tsx`, `SettingsPage.tsx`, `hooks/useObjectUrl.ts` | Added Dexie v2 `blobs` table; custom photo/VRM bytes are stored in IndexedDB and only IDs are persisted in localStorage; object URLs are created lazily/revoked; reset clears all Dexie tables and localStorage. | IndexedDB Blob round-trip and full-reset tests. | PASS |
| 3-B | `frontend/src/audio/lipSyncAnalyzer.ts`, `VoiceSelector.tsx`, `VoiceLabPage.tsx`, `App.tsx` | Reconnects per-element MediaElementAudioSourceNodes to a shared AudioContext, disconnects/suspends playback nodes on end, and releases resources on unmount. | AudioContext/source reconnection and disposal tests. | PASS |
| 3-C | `frontend/src/components/Viewport3D.tsx` | Scene initialization is mount-only; speaking/emotion are runtime refs; background/model changes update existing scene; Three.js URL cache is enabled and scene graph is disposed on unload. | Frontend production build and lint. | PASS |
| 3-D | `frontend/src/pages/VideoStudioPage.tsx`, `videoStudioUtils.ts`, `backend/app/main.py` | Loads character IDs from backend state, sends selected character and voice IDs, uses UUID scene IDs, and displays backend errors without fabricating a successful local render plan. Backend `voice_id` is optional for backward compatibility. | UUID uniqueness test; backend render-plan voice override test; frontend lint/build. | PASS |
| 3-E | `frontend/src/pages/VoiceLabPage.tsx`, `voiceLabUtils.ts` | Sends selected rate and pitch in Edge-TTS string format. | Positive/negative rate and pitch unit tests. | PASS |
| 3-F | `frontend/src/pages/BroadcastPage.tsx`, `broadcastUtils.ts`, `App.tsx` | Reads `bg` from OBS URL and includes selected background and resolution in the Browser Source URL. | OBS URL query-parameter unit test. | PASS |
| 3-G | `frontend/src/pages/SettingsPage.tsx`, `backend/app/main.py` | Health check uses `/ready`; Telegram test calls backend `getMe` proxy; reset clears IndexedDB and localStorage. | Telegram `getMe` proxy test; IndexedDB reset test. | PASS |
| 3-H | `frontend/src/pages/PhotoAvatarPage.tsx`, `photoAvatarUtils.ts` | Added third-party Pollinations.ai disclosure and a 1000-character cap on the prompt sent to the provider. | Prompt limit unit test. | PASS |
| 4-A | `backend/requirements-dev.txt`, `pytest.ini` | Added pinned pytest and pytest-asyncio dependencies and test configuration. | 48 backend tests pass locally. | PASS |
| 4-B | `backend/requirements.txt`, `backend/requirements-dev.txt` | Pinned all direct runtime and development dependencies with `==`. | Clean dependency install; `pip-audit --local --strict`. | PASS |
| 4-C | Worker `package.json`, `package-lock.json`, `wrangler.toml`, GitHub Actions | Pinned Wrangler; refreshed compatibility date; enabled observability; included an optional commented R2 binding; added dry-run CI. | `wrangler deploy --dry-run`; Worker CI workflow. | PASS |
| 4-D | `render.yaml`, `backend/app/main.py`, `README.md` | Added 1GB persistent disk at `/data`, `AURACRAFT_DATA_DIR=/data`, and backend/Worker/frontend environment wiring. Render service is Starter because persistent disks require a paid service. | Configuration review; no live deployment or billing action performed. | PASS — deploy pending |
| 4-E | `.github/workflows/ci.yml`, `.github/workflows/worker-lint.yml`, root `package.json` | Added backend, frontend, Worker, build, dependency-audit, and Wrangler dry-run CI; added root lint/test scripts. | All corresponding commands pass locally. GitHub Actions will run after PR creation. | PASS — CI run pending |

## Local validation results

| Check | Result |
|---|---:|
| `ruff check apps/web-platform/backend` | PASS |
| `mypy apps/web-platform/backend/app/main.py` | PASS |
| `pytest -q apps/web-platform/backend/tests` | **48 passed** |
| `npm run lint` | PASS |
| `npm test -- --run` | **12 passed** |
| `npm run build` | PASS |
| Worker `node --check` (`index.js` and `index.test.js`) | PASS |
| Worker `npm test` | **9 passed** |
| `wrangler deploy --dry-run` | PASS |
| Frontend `npm audit --audit-level=high` | PASS — 0 high/critical; 9 moderate findings in the ESLint/TypeScript-ESLint development toolchain |
| Worker `npm audit --audit-level=high` | PASS |
| `pip-audit --local --strict` | PASS — no known vulnerabilities in installed backend/dev environment |
| `git diff --check` | PASS |

## Deployment notes and residual operational considerations

1. Configure the same strong `API_AUTH_TOKEN` in Render backend environment and Cloudflare Worker secret. Do not expose it as a `VITE_*` variable.
2. Configure the same `TELEGRAM_WEBHOOK_SECRET` in Render and Worker secrets; keep `TELEGRAM_BOT_TOKEN` only in the backend.
3. Set `VITE_API_URL` in the Render frontend dashboard to the deployed Worker origin. Set `ALLOWED_ORIGINS` to the exact frontend origin in both Render and Worker.
4. Set `TELEGRAM_IMPORT_ALLOWED_HOSTS` to the exact trusted HTTPS hostnames from which Telegram `/import` may download packages.
5. The original Render Starter + disk configuration was not deployed. A later free-tier follow-up removes the paid disk dependency and uses Neon Postgres for character and render-plan persistence.
6. Existing localStorage `blob:` URLs from before the migration cannot be reconstructed after their browser session ended; the migration sanitizes stale URLs. Newly uploaded photo/VRM data is stored in IndexedDB.
7. FastAPI's existing startup `on_event` handlers and Starlette TestClient emit deprecation warnings; they do not fail the current test suite.
8. GitHub Actions run #14 on main passed backend, frontend, and Worker jobs; Worker Lint run #6 also passed.


## Post-PR CI remediation (2026-11-10)

The first GitHub Actions run exposed two environment-only issues that local checks had not caught:

- Root npm workspace globs discovered both `apps/web-platform/frontend` and `apps/web-studio`, which share a package name. Removed the overlapping root workspace declaration so each app and the Worker install from its own lockfile. This does not remove either application.
- The GitHub runner's preinstalled `setuptools==79.0.1` was vulnerable according to `pip-audit`; pinned the dev environment to `setuptools==84.1.0`, the reported fixed release.

Revalidated after these changes: frontend `npm ci`, lint, 12 Vitest tests, build, and high-severity npm audit gate; Worker `npm ci`, lint, 9 Node tests, Wrangler dry-run, and high-severity npm audit gate; backend pip install, strict pip-audit, Ruff, Mypy, and 48 pytest tests. The updated commit was verified by GitHub Actions run #14: backend, frontend, and Worker jobs all passed; Worker Lint run #6 passed.


## Free-tier production-readiness follow-up (2026-11-10)

- Created a Neon Free project in AWS Singapore (aws-ap-southeast-1) and initialized the auracraft_state JSONB table.
- Added an optional Postgres persistence adapter (DATABASE_URL) for characters and video render manifests. Local development and tests retain the existing JSON-file fallback.
- Pinned psycopg[binary]==3.3.8 for Python 3.11.
- Changed the Render backend blueprint from paid Starter + persistent disk to the Free plan. The blueprint now expects DATABASE_URL as a private environment variable and uses /tmp/auracraft-data only for temporary files.
- Removed hardcoded Telegram group/topic identifiers from the public backend health response and source defaults; runtime configuration now uses TELEGRAM_GROUP_CHAT_ID and TELEGRAM_TOPIC_ID.
- Added focused tests for Postgres-backed character/render-plan persistence and custom VRM asset persistence.
- Added Neon BYTEA storage for imported VRM files, with a 25MB per-file and 300MB aggregate cap to stay within a conservative free-tier budget.
- Added Narrativ Forge expression-map preservation for persona-pack import/export round trips.
- Updated the checked-in Wrangler variables to match the existing Render backend and frontend hostnames.

### Remaining free-tier deployment gates

- The Render workspace is My Workspace; service inspection and environment updates are waiting for the user's explicit workspace confirmation.
- The Render backend still needs DATABASE_URL, API_AUTH_TOKEN, TELEGRAM_WEBHOOK_SECRET, and the Telegram runtime variables configured. No secret values are written to Git.
- The live Cloudflare Worker currently has a dashboard-managed configuration that differs from the repository. Its ALLOWED_ORIGINS and API_AUTH_TOKEN binding still need to be aligned, then the Worker must be deployed from the audited source.
- Render Free uses ephemeral local files. Character records, render manifests, and imported VRM binaries persist in Neon. Custom VRM assets are capped at 25MB each and 300MB total; the application returns a clear quota error instead of allowing unbounded storage.
- The current video endpoint produces a JSON render manifest only; actual MP4 rendering remains unimplemented. Narrativ Forge-compatible persona-pack export/import is supported, including expression-map round trips, but no external Narrativ Forge API integration is configured.
- The 9 moderate npm audit findings are caused by the minimatch advisory in the ESLint 10 / TypeScript-ESLint toolchain. Do not force an incompatible minimatch major override; the compatible dependency path needs a targeted upstream-compatible update.

- Validation on the free-tier follow-up: GitHub Actions CI run #40 passed backend, frontend, and Worker jobs; Worker Lint run #33 passed. Backend Ruff and Mypy passed, all 54 pytest tests passed, frontend lint/12 Vitest tests/build passed, and the Worker 9-test suite plus Wrangler dry-run passed.
