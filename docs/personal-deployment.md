# AniBloom personal deployment checklist

This document applies to [mvincent475/AniBloom](https://github.com/mvincent475/AniBloom), not the original [AniBloomHQ/AniBloom](https://github.com/AniBloomHQ/AniBloom). Changes in the personal repository and Vercel project must not deploy or mutate the upstream project.

## Verified configuration (2026-11-07)

- GitHub repository: public, default branch `main`. PR #1 was merged at `1dff6bb2f32917bad3b34cfee81c6cc7a31f54a3` after green PR CI and full-history secret scan. The merged commit passed main CI, history scan, and CodeQL. The ruleset still blocks deletion and non-fast-forward updates **without** requiring pull requests or passing checks.
- Vercel team: `vincentmelgo475-1530`; project: `anibloom-personal`; Git source: `mvincent475/AniBloom`.
- Production domain: `https://anibloom-personal.vercel.app`, verified in Vercel project domains.
- Production now serves the independently deployed main commit `1dff6bb2f32917bad3b34cfee81c6cc7a31f54a3` from deployment `dpl_9Pn9Q2jFBkcjPxgkUZKGhCtYHxAm` (`READY`). The original import remains as a distinct earlier deployment, for two verified personal production deployments.
- Upstash integration confirmed: the dedicated `anibloom-personal` database responded to `PING` with `PONG`. Vercel lists `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `REDIS_URL` for Production and Preview. After live catalog requests, AniBloom response-cache and incoming-limiter key families were observed in Redis. Credentials were not retrieved.
- Vercel Authentication is enabled with scope `all_except_custom_domains` (Standard Protection semantics). With account-authorized access, homepage, three manifests and representative series/movie catalogs returned HTTP 200. **Unauthenticated Nuvio access remains unverified** and must be tested independently.
- `vercel.json` specifies `git.deploymentEnabled: false`: commits do not automatically deploy, by design.

## GitHub setup

1. Enable Actions for this repository and run the PR test workflow, security scan, and main CI to establish real green checks before release.
2. Extend the existing `main` ruleset to require pull requests and passing checks. Once a run with the renamed jobs passes, choose **Pull Request Tests** and **Scan Git history for secrets** as required checks. Existing deletion/force-push prevention alone is insufficient. Keep **Main CI Tests** for post-merge validation.
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

The independently verified production state is recorded in [`ops/personal-deployment-state.json`](../ops/personal-deployment-state.json). This is a deployment record, **not a tagged personal release**; it distinguishes live deployment evidence from upstream-imported release metadata. Any new personal deployment must update this record after verification.

## Release-state migration (must precede first tagged personal release)

`ops/release-state.json` was imported from upstream and contains upstream deployment/tag/CI history. Treat those fields as **inherited historical data**, not as a verified record of personal releases. Before enabling `PERSONAL_RELEASES_ENABLED`, reconcile the baseline with verified personal Vercel deployment ID, commit, version, GitHub tags/releases and actual deployment count; review the release limit policy separately. Never fabricate personal smoke-test or CI results by copying upstream values.

## Acceptance checks

After a separately approved, CI-green production release, request these unauthenticated URLs and verify both HTTP 200 and content identity:

- `https://anibloom-personal.vercel.app/` — homepage and installation links
- `https://anibloom-personal.vercel.app/manifest.json` — addon metadata and logo URL
- `https://anibloom-personal.vercel.app/romaji/manifest.json`
- `https://anibloom-personal.vercel.app/native/manifest.json`
- `https://anibloom-personal.vercel.app/catalog/series/current_season.json`

Check preview isolation, the old public site remaining unchanged, relevant edge-case catalog requests, GitHub CI status, and personal release-state sync. A Vercel `READY` status alone is insufficient.
