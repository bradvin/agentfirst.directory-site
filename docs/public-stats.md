Public stats implementation and approval boundary

Architecture
- /stats and /stats.json read the same D1 public_stats singleton. Neither route calls Cloudflare upstream. JSON schemaVersion is "1"; null means not reported. Partial totals sum only reported days; totals.complete tells consumers whether all 30 dates reported.
- src/worker.ts preserves Astro's fetch handler and adds a scheduled handler. wrangler.jsonc declares 03:15 UTC daily. This schedule is code only until deployment; no external job was created.
- 0006_public_stats.sql adds one table to the existing DB binding. No separately provisioned resource. Failures atomically mark the retained last-good snapshot stale without replacing metrics; missing/corrupt storage is unavailable, not zero. Stale also means >36 hours since refresh or an older complete-date window.
- Collector checks live account dataset settings, requests exactly the prior 30 complete UTC dates, exact requestHost=agentfirst.directory, date grouping with limit 31 (maximum possible rows 30), and rechecks every returned host/date. Other sites/subdomains cannot enter the projection. Empty/sparse results remain honestly unavailable/partial; adaptive sampling is already extrapolated.
- Only dates, aggregate estimates, sampling intervals, metric definitions, reporting period and freshness enter storage/public JSON. No source responses, identifiers, referrers, paths, IPs, or credential values.

Credentials / deployment (requires explicit Brad approval)
- Do not merge to main without production approval: existing deploy.yml pushes main directly to production and applies remote D1 migrations.
- Production needs a dedicated secret STATS_CF_API_TOKEN with Account / Account Analytics / Read, scoped only to the owning Cloudflare account, and STATS_CF_ACCOUNT_ID (server-only; not a public variable). Do not reuse the existing deployment token for collection. Token provisioning/secret installation and activating the cron require approval. No token was rotated/created or live config changed by this slice.
- Source investigation used the established 1Password wrapper and existing authorized credential only for read-only requests. It does not establish that the existing token is least-privileged; dedicated production token remains an approval prerequisite.
- After approval, use the normal reviewed deploy workflow (migration + Worker) and verify a successful scheduled refresh and both live routes. No public refresh endpoint exists. Local Wrangler --test-scheduled adds an emulator-only /__scheduled URL; it is not deployed in application code.

Repeatable independent local verification (Node 24+; commands from repo root)
  npm ci
  npm run ci
  export STATS_LOCAL_STATE=/absolute/private/scratch/stats-local
  ./node_modules/.bin/wrangler d1 migrations apply DB --local --persist-to "$STATS_LOCAL_STATE"
  ./node_modules/.bin/wrangler d1 execute DB --local --persist-to "$STATS_LOCAL_STATE" --file=test/fixtures/seed-classifications.sql

For a new real-data local collection, securely inject STATS_CF_API_TOKEN and STATS_CF_ACCOUNT_ID into the verification process environment from approved read-only credentials, never print them. Set STATS_PRIVATE_DIR to an existing private scratch directory outside the repo, then:
  node verification/stats-real-local.mjs
This makes two read-only GraphQL POSTs and writes raw responses mode 0600 outside the repo, persisting only the allowlisted public snapshot to LOCAL D1. Wrangler getPlatformProxy requires the /v3 suffix internally; the script handles it. No credentials are required to serve/read already populated local data.

Serve built final bytes in another terminal:
  ./node_modules/.bin/wrangler dev --config dist/server/wrangler.json --local --persist-to "$STATS_LOCAL_STATE" --host 127.0.0.1 --ip 127.0.0.1 --port 4327 --test-scheduled

Verify (Chromium must be installed for Playwright):
  BASE_URL=http://127.0.0.1:4327 STATS_ARTIFACT_DIR=/absolute/private/scratch STATS_EXPECTED_SNAPSHOT=/absolute/private/scratch/stats-real-public-snapshot.json node verification/public-stats.mjs
  BASE_URL=http://127.0.0.1:4327 npm run verify:rendered
  BASE_URL=http://127.0.0.1:4327 node verification/stats-local-states.mjs
The expected snapshot argument is optional. Empty DB is truthfully unavailable. stats-local-states requires STATS_LOCAL_STATE and restores its local snapshot after testing scheduled failure/unavailable/corruption. Never pass remote flags. Raw results must never be copied into source/public directories.

Authoritative source references
https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/
https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/
https://developers.cloudflare.com/web-analytics/faq/
https://developers.cloudflare.com/analytics/graphql-api/sampling/
https://developers.cloudflare.com/analytics/graphql-api/limits/
https://developers.cloudflare.com/analytics/graphql-api/features/discovery/settings/
https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/
Actual introspection confirmed viewer.accounts.rumPageloadEventsAdaptiveGroups, count (aliased pageViews), sum.visits, dimensions.date/requestHost and avg.sampleInterval. Visits are not unique users. Sampling may yield different estimates across repeated pulls; screenshots/JSON must be compared against the same persisted pull, not independently fetched observations.

Out of scope: GSC, protected listing SEO cohort, dependency remediation. npm ci reported 10 pre-existing dependency advisories (2 moderate, 8 high); no lockfile/dependency versions changed.
