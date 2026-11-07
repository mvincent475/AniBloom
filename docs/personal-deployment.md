# AniBloom personal deployment checklist

This document applies to [mvincent475/AniBloom](https://github.com/mvincent475/AniBloom), not the original [AniBloomHQ/AniBloom](https://github.com/AniBloomHQ/AniBloom). Changes in the personal repository and Vercel project must not deploy or mutate the upstream project.

## Verified configuration (2026-11-07)

- GitHub repository: public, default branch `main`. The `main` ruleset blocks deletion and non-fast-forward updates, but has no pull-request or status-check requirement. The owner enabled GitHub Actions, but no workflow run had yet appeared during recheck.
- Vercel team: `vincentmelgo475-1530`; project: `anibloom-personal`; Git source: `mvincent475/AniBloom`.
- Production domain: `https://anibloom-personal.vercel.app`, verified in Vercel project domains.
- Imported production deployment of commit `61457476cabb89d0d68e0465bed2dfde4093ee73`: status `READY`. This does **not** prove anonymous HTTP access or functional endpoints.
- Upstash integration confirmed: the dedicated `anibloom-personal` Redis database is active, and Vercel lists `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `REDIS_URL` for both Production and Preview. No credential values were read. Runtime connectivity remains untested until a new deployment uses these variables.
- Vercel Authentication was enabled with scope `all_except_custom_domains`, which must be checked against Nuvio's ability to fetch the manifest without an interactive login.
- `vercel.json` specifies `git.deploymentEnabled: false`: commits do not automatically deploy, by design.

## GitHub setup

1. Enable Actions for this repository and run the PR test workflow, security scan, and main CI to establish real green checks before release.
2. Extend the existing `main` ruleset to require pull requests and the verified passing PR/CI checks. Existing deletion/force-push prevention is insufficient as the only production gate. Do not select check names before they exist.
3. Keep the original repository separate; do not reuse its GitHub App installation, release token, deployment hook, or environment secrets.
4. Automatic versioning is gated by repository variable `PERSONAL_VERSION_AUTOMATION_ENABLED=true`. Leave unset until a GitHub App scoped to this repository is installed and its `AUTOMATION_APP_CLIENT_ID` (repository variable) and `AUTOMATION_APP_PRIVATE_KEY` (repository secret) are configured securely.
5. Production release workflow is gated by repository variable `PERSONAL_RELEASES_ENABLED=true`. Leave unset until CI, release metadata, and the **personal** deployment hook are verified. Store `VERCEL_DEPLOY_HOOK_URL` only as a GitHub Actions secret and create it for the **personal Vercel project**, not for the upstream project.

## Vercel setup

1. Confirm Git integration uses `mvincent475/AniBloom`, production branch `main`, root directory `/`, and the existing `api/` functions and `vercel.json` rewrites. No custom output directory is necessary.
2. For Nuvio access, the manifest, catalog, and static asset endpoints need to be reachable anonymously. Use a deployment-protection configuration that keeps Preview protected but allows your chosen production domain; verify this with an unauthenticated client. A Vercel-authenticated webpage is not suitable for Nuvio's unauthenticated addon requests.
3. The **dedicated** Upstash Redis database and required integration variable names are now configured in Vercel. Keep the database private and independent of upstream. The Vercel API currently reports these variables as `plain`; confirm the token is appropriately concealed in the Vercel dashboard or change its type to **Secret** using supported integration controls. Do not copy values into Git, CI logs or this document. Test actual Redis connectivity after deploying code with these variables. Without working Redis, the app uses per-instance fallback rate limiting, which cannot enforce a global budget.
4. For TMDB-assisted fallback ID matching (used in the public instance), optionally set a **separate** `TMDB_API_TOKEN` in Vercel project environment variables. Without it, the resolver skips TMDB lookups; other mapping providers remain available. Store only a real token in the secure environment settings, never in Git.
5. Optionally configure `DONATION_URL` as an HTTPS URL. The application already has a default.
6. Leave automatic Git deployment disabled while using the controlled release pipeline. Re-enabling it requires redesigning CI/deployment gating so a push cannot deploy untested code.

## Release-state migration (must precede first personal release)

`ops/release-state.json` was imported from upstream and contains upstream deployment/tag/CI history. Treat those fields as **inherited historical data**, not as a verified record of personal releases. Before enabling `PERSONAL_RELEASES_ENABLED`, reconcile the baseline with verified personal Vercel deployment ID, commit, version, GitHub tags/releases and actual deployment count; review the release limit policy separately. Never fabricate personal smoke-test or CI results by copying upstream values.

## Acceptance checks

After a separately approved, CI-green production release, request these unauthenticated URLs and verify both HTTP 200 and content identity:

- `https://anibloom-personal.vercel.app/` — homepage and installation links
- `https://anibloom-personal.vercel.app/manifest.json` — addon metadata and logo URL
- `https://anibloom-personal.vercel.app/romaji/manifest.json`
- `https://anibloom-personal.vercel.app/native/manifest.json`
- `https://anibloom-personal.vercel.app/catalog/series/current_season.json`

Check preview isolation, the old public site remaining unchanged, relevant edge-case catalog requests, GitHub CI status, and personal release-state sync. A Vercel `READY` status alone is insufficient.
