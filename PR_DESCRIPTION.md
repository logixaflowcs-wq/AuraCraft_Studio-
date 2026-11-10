# PR: Free-tier production readiness and persistence hardening

**Base:** main  
**Head:** free-tier/production-readiness-20261110

## Summary

- Add a Neon Postgres JSONB persistence adapter for character records and video render manifests. Local development/tests keep the existing JSON-file fallback.
- Store imported VRM binaries in Neon Postgres so they survive Render Free restarts. Enforce a 25MB per-file and 300MB aggregate asset cap to stay within a conservative free-tier budget.
- Require DATABASE_URL when REQUIRE_DATABASE_URL=true, preventing silent fallback to ephemeral local files in production.
- Preserve Narrativ Forge expression maps across persona-pack import/export round trips.
- Move the Render backend blueprint to the Free plan, use /tmp only for temporary files, and configure the Worker origin for the frontend.
- Remove public Telegram group/topic identifiers from source defaults and health output; use runtime environment variables instead.
- Align checked-in Wrangler backend/origin values with the existing Render hostnames.
- Configure Mypy with the backend package path so app.persistence is type-checked in CI.

## Validation

- GitHub Actions CI run #40: backend, frontend, and Worker jobs all passed.
- Backend: Ruff passed, Mypy passed, **54 pytest tests passed**.
- Frontend: ESLint passed, **12 Vitest tests passed**, production build passed.
- Worker: **9 Node tests passed**, Wrangler dry-run passed; Worker Lint run #33 passed.
- Python dependency audit passed. NPM high-severity gate passed; **9 moderate** development-toolchain findings remain, with no high/critical findings.

## Free deployment setup

- Neon Free project provisioned in AWS Singapore; tables auracraft_state and auracraft_assets initialized.
- Render blueprint uses Free plan and requires DATABASE_URL, REQUIRE_DATABASE_URL=true, exact ALLOWED_ORIGINS, and runtime Telegram variables.
- Cloudflare Worker uses the existing workers.dev endpoint; its live ALLOWED_ORIGINS and API_AUTH_TOKEN bindings still need to be aligned with the backend.
- Render workspace/service inspection, environment updates, data migration, and deployment are waiting for the user's explicit confirmation to use the available My Workspace. No production deployment or paid resource has been created.

## Remaining product limitations

- The Video Studio endpoint currently creates and stores JSON render plans; actual MP4 generation is not implemented.
- Narrativ Forge-compatible JSON persona packs are supported, including expression-map round trips, but no external Narrativ Forge API integration is configured.
- Legacy user data from the current Render service must be inspected and migrated before switching production traffic to the new Neon-backed build.
- Render Free may sleep when idle. Neon persistence keeps app data durable, but cold starts and free-tier quotas still apply.
- The frontend npm audit retains 9 moderate findings in the ESLint/TypeScript-ESLint development dependency chain; no unsafe major-version override was applied.
