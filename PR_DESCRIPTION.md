# PR: Complete AuraCraft Studio security and reliability audit fixes

**Base:** `main`  
**Head:** `audit/fix-all-20261110`

## Summary

This PR implements the requested four-phase audit remediation in phase-separated commits; Phase 2 includes a follow-up commit for the completed Aura/VRM integration:

1. **Security:** API Bearer authentication, explicit CORS allowlists, TTS rate limiting, safe path handling and atomic exports, generic error responses, Telegram HTML escaping, constant-time secret/user-ID comparisons, Worker body validation, and strict package import/export validation.
2. **Backend reliability:** validated/locked/atomic character storage with corruption backups, readiness checks, and a single Telegram command path behind the Cloudflare edge gateway. Telegram speech, import, and export now perform real backend work and deliver actual audio/document results.
3. **Frontend reliability:** IndexedDB Blob storage and reset behavior, object-URL lifecycle management, AudioContext reconnection, mount-only Three.js scene lifecycle, selected character/voice mapping, correct VoiceLab rate/pitch, OBS URL parameters, real health/Telegram tests, and Pollinations privacy disclosure.
4. **Infrastructure:** pinned Python and Wrangler dependencies, Worker configuration and dry-run CI, persistent Render disk configuration, and full GitHub Actions workflows.

See `AUDIT_FIX_REPORT.md` for the audit-ID-to-file-to-test matrix.

## Validation

- Backend: Ruff, Mypy, **48 pytest tests passed**.
- Frontend: ESLint, **12 Vitest tests passed**, production build passed.
- Worker: both JavaScript files pass `node --check`, **9 Node tests passed**, Wrangler dry-run passed.
- Dependency audits: no Python vulnerabilities reported; npm high-severity gate passes. The frontend dependency tree still reports **9 moderate** findings in the ESLint/TypeScript-ESLint development toolchain and no high/critical findings.

## Deployment configuration required

- Configure `API_AUTH_TOKEN` identically as a Render backend environment variable and Cloudflare Worker secret.
- Configure `TELEGRAM_WEBHOOK_SECRET` identically in Render and Worker secrets; keep `TELEGRAM_BOT_TOKEN` in Render backend only.
- Set exact `ALLOWED_ORIGINS` in Render and Worker, `BACKEND_API_URL` in Worker, and `VITE_API_URL` in the Render frontend to the Worker origin.
- Set `TELEGRAM_IMPORT_ALLOWED_HOSTS` to trusted HTTPS download hosts.
- The Render backend is configured as Starter with a 1GB `/data` persistent disk. This is a paid Render plan requirement; this PR does not deploy or purchase resources.

## Deferred / limitations

- R2 remains an optional commented binding because no R2 bucket is currently used by the application.
- Legacy browser `blob:` URLs already invalidated by a previous page session cannot be recovered; new uploads persist correctly in IndexedDB.
- The first GitHub Actions run exposed a duplicate npm workspace name and a vulnerable runner-preinstalled setuptools version; both were corrected in the follow-up commits. A fresh GitHub Actions run is pending.
