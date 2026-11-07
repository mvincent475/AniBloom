# AniBloom personal deployment checklist

This document applies to [mvincent475/AniBloom](https://github.com/mvincent475/AniBloom), not the original [AniBloomHQ/AniBloom](https://github.com/AniBloomHQ/AniBloom). Changes in the personal repository and Vercel project must not deploy or mutate the upstream project.

## Verified configuration (2026-11-07)

- GitHub repository: public, default branch `main`. The active ruleset now requires pull requests, passing PR tests, full-history secret scan, CodeQL JavaScript and Actions analyses, and branches up to date with `main`. Force pushes and branch deletion remain blocked. Verified through the ruleset API after the owner's update.
- Vercel team: `vincentmelgo475-1530`; project: `anibloom-personal`; Git source: `mvincent475/AniBloom`.
- Production domain: `https://anibloom-personal.vercel.app`, verified in Vercel project domains.
- Production now serves the independently deployed main commit `1dff6bb2f32917bad3b34cfee81c6cc7a31f54a3` from deployment `dpl_9Pn9Q2jFBkcjPxgkUZKGhCtYHxAm` (`READY`). The original import remains as a distinct earlier deployment, for two verified personal production deployments.
- Upstash integration confirmed: the dedicated `anibloom-personal` database responded to `PING` with `PONG`. Vercel lists `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `REDIS_URL` for Production and Preview. After live catalog requests, AniBloom response-cache and incoming-limiter key families were observed in Redis. Credentials were not retrieved.
- Vercel Authentication is enabled with scope `all_except_custom_domains` (Standard Protection semantics). Account-authorized checks returned HTTP 200 for homepage, three manifests and representative series/movie catalogs; the owner separately confirmed access in an incognito browser.
- `vercel.json` specifies `git.deploymentEnabled: false`: commits do not automatically deploy, by design.

## GitHub setup

1. GitHub Actions is enabled, and PR/main tests, full-history scanning and CodeQL have passed on the current personal repository.
2. Keep required branch checks **Pull Request Tests**, **Scan Git history for secrets**, **Analyze (actions)** and **Analyze (javascript-typescript)**, with strict up-to-date branches. **Main CI Tests** runs after merge.
3. Keep the original repository separate; do not reuse its GitHub App installation, release token, deployment hook, or environment secrets.
4. Automatic versioning is gated by repository variable `PERSONAL_VERSION_AUTOMATION_ENABLED=true`. Leave unset until a GitHub App scoped to this repository is installed and its `AUTOMATION_APP_CLIENT_ID` (repository variable) and `AUTOMATION_APP_PRIVATE_KEY` (repository secret) are configured securely.
5. Production release workflow is gated by repository variable `PERSONAL_RELEASES_ENABLED=true`. Leave unset until CI, release metadata, and the **personal** deployment hook are verified. Store `VERCEL_DEPLOY_HOOK_URL` only as a GitHub Actions secret and create it for the **personal Vercel project**, not for the upstream project.

## Vercel setup

1. Confirm Git integration uses `mvincent475/AniBloom`, production branch `main`, root directory `/`, and the existing `api/` functions and `vercel.json` rewrites. No custom output directory is necessary.
2. For Nuvio access, the manifest, catalog, and static asset endpoints need to be reachable anonymously. Use a deployment-protection configuration that keeps Preview protected but allows your chosen production domain; verify this with an unauthenticated client. A Vercel-authenticated webpage is not suitable for Nuvio's unauthenticated addon requests.
3. The **dedicated** Redis integration is now active, and the application's response-cache and limiter key families were observed after live requests. Keep the database separate from upstream. Vercel reports the integration-managed `UPSTASH_REDIS_REST_TOKEN` and `REDIS_URL` as `plain` with a `readable-secret` security issue. Convert them to **Secret** where the integration supports it, or follow the provider's secure reconfiguration procedure; never remove working credentials before a replacement is ready. Vercel's connector could not perform the type update. Do not reveal any credentials in Git or chat.
4. For TMDB-assisted fallback ID matching (used in the public instance), optionally set a **separate** `TMDB_API_TOKEN` in Vercel project environment variables. Without it, the resolver skips TMDB lookups; other mapping providers remain available. Store only a real token in the secure environment settings, never in Git.
5. Optionally configure `DONATION_URL` as an HTTPS URL. The application already has a default.
6. Automatic Git deployment remains disabled. One authorized manual production deployment was made after green CI. Re-enabling automatic deployment requires designing a CI deployment gate so an untested push cannot go live.

## Verified personal deployment record

The independently verified *bootstrap-time production snapshot* is in [`ops/personal-deployment-state.json`](../ops/personal-deployment-state.json). It is not a tagged release, and it is not automatically updated after later releases. The authoritative release history after the first tagged personal release is [`ops/release-state.json`](../ops/release-state.json).

## Reconciled personal release baseline

`ops/release-state.json` now identifies the verified personal production deployment `dpl_9Pn9Q2jFBkcjPxgkUZKGhCtYHxAm` (commit `1dff6bb2f32917bad3b34cfee81c6cc7a31f54a3`, version `2.15.0`). The personal project had two production deployments, both counted toward the existing ten-deployment checkpoint. The personal GitHub repository had **no release tags** at migration. The state therefore has `releaseHistoryStarted: false` and `lastDeploymentTag: null`; no upstream release/tag is copied into the personal release record.

On the first actual personal release, the workflow must create a genuine personal tag, mark `releaseHistoryStarted: true`, and generate notes from commits after the personal baseline. `ops/personal-deployment-state.json` remains a historical bootstrap snapshot; tagged-release state is recorded separately in `ops/release-state.json`.

**Automatic updates are not enabled by this reconciliation PR.** A dedicated GitHub App installed on `mvincent475/AniBloom` must be configured with minimally necessary Contents and Pull requests access. Set `AUTOMATION_APP_CLIENT_ID` as a GitHub repository variable and `AUTOMATION_APP_PRIVATE_KEY` as an Actions secret. After verification, set `PERSONAL_VERSION_AUTOMATION_ENABLED=true` to create patch-version PRs. Controlled production releases additionally require a deploy hook targeting the **personal** Vercel project and `main` branch, stored as secret `VERCEL_DEPLOY_HOOK_URL`, and an independently enabled `PERSONAL_RELEASES_ENABLED=true` flag. Do not reuse upstream credentials or hooks. The next release baseline is `2.16.0`; automated patch-version PRs do not, by themselves, tag or deploy it.

## Acceptance checks

After a separately approved, CI-green production release, request these unauthenticated URLs and verify both HTTP 200 and content identity:

- `https://anibloom-personal.vercel.app/` — homepage and installation links
- `https://anibloom-personal.vercel.app/manifest.json` — addon metadata and logo URL
- `https://anibloom-personal.vercel.app/romaji/manifest.json`
- `https://anibloom-personal.vercel.app/native/manifest.json`
- `https://anibloom-personal.vercel.app/catalog/series/current_season.json`

Check preview isolation, the old public site remaining unchanged, relevant edge-case catalog requests, GitHub CI status, and personal release-state sync. A Vercel `READY` status alone is insufficient.

## Release hook isolation

The controlled release workflow checks the Vercel deploy hook against `ops/personal-deployment-state.json` **before** sending its HTTP request. The URL must be HTTPS, hosted by `api.vercel.com`, and have the deploy-hook path for project `prj_lLLlEfAAz4htYZn4hTEg0xI4wRy9`. It must not have query parameters or fragments. Do not paste the hook URL or its token into the repository, logs, or chat. The hook is still created manually for the personal Vercel project and `main` branch, and the first production release remains gated by verified CI and release authorization.

## Safe release-credential preflight

After configuring `AUTOMATION_APP_CLIENT_ID` (repository variable), `AUTOMATION_APP_PRIVATE_KEY` (GitHub Actions secret), and `VERCEL_DEPLOY_HOOK_URL` (GitHub Actions secret), run [Personal Release Credential Preflight](https://github.com/mvincent475/AniBloom/actions/workflows/personal-release-preflight.yml) manually on `main`. It validates the Vercel hook project ID **without calling the hook**, creates a short-lived GitHub App token scoped to `mvincent475/AniBloom`, and checks that its installation token sees only this repository. It does not deploy, tag, publish, or create PRs. Do not enable `PERSONAL_VERSION_AUTOMATION_ENABLED` or `PERSONAL_RELEASES_ENABLED` until this preflight passes and a controlled release plan is approved.
