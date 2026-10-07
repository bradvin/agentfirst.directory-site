Public stats implementation and approval boundary

Architecture
- Identity correction: the expected existing D1 database name is `agentfirst`; the Worker/service remains `agentfirst-directory`, the binding remains `DB`, and routes/cron are unchanged. This corrects a check/config mismatch, not a resource rename. Brad supplied the target name/UUID from the Worker DB target; that is user-supplied evidence, not a live API read or confirmation of the encrypted Actions UUID. The failed main run https://github.com/bradvin/agentfirst.directory-site/actions/runs/37532108737 stopped at remote-database HTTP 200/code none before any remote mutation.
- No production UUID is committed: Wrangler retains the zero placeholder; only `CLOUDFLARE_D1_DATABASE_ID` injects it. Preflight still checks exact source/deployment account equality, config account/UUID, the account-scoped remote D1 `uuid,name`, and the live Worker `DB` binding UUID/domain/service. A UUID mismatch is a stop, not permission to fall back to name-only targeting or change secrets.
- CLI audit: deployment migrations use binding `DB`; bootstrap and exact readback use the injected UUID. Local/CI commands use `DB`; the local harness also executes by `agentfirst` and proves it resolves to the same singleton. No migration filename/schema or publication target changes. Fixed-enum `identity-envelope`, `identity-uuid`, and `identity-name` diagnostics distinguish database identity rejection; no upstream messages/identifiers are emitted. If approved Actions preflight reports `identity-uuid` or `remote-worker-bindings`, stop for OPS inspection without bypassing gates.
- This follow-up requires Brad to approve and merge its PR before the normal main-push deployment. Local/PR validation does not establish a production-proven fix or a live stats page; only a successful approved deployment and exact live readback can do that.
- /stats and /stats.json read the same D1 public_stats singleton. Neither route calls Cloudflare upstream. JSON schemaVersion is "1"; null means not reported. Partial totals sum only reported days; totals.complete tells consumers whether all 30 dates reported.
- src/worker.ts preserves Astro's fetch handler and adds a scheduled handler. wrangler.jsonc declares 03:15 UTC daily. This schedule is code only until deployment; no external job was created.
- 0006_public_stats.sql adds one table to the existing DB binding. No separately provisioned resource. Failures atomically mark the retained last-good snapshot stale without replacing metrics; missing/corrupt storage is unavailable, not zero. Stale also means >36 hours since refresh or an older complete-date window.
- Collector checks live account dataset settings, requests exactly the prior 30 complete UTC dates, exact requestHost=agentfirst.directory, date grouping with limit 31 (maximum possible rows 30), and rechecks every returned host/date. Other sites/subdomains cannot enter the projection. Empty/sparse results remain honestly unavailable/partial; adaptive sampling is already extrapolated.
- Only dates, aggregate estimates, sampling intervals, metric definitions, reporting period and freshness enter storage/public JSON. No source responses, identifiers, referrers, paths, IPs, or credential values.

Automated main-push deployment (requires explicit Brad approval)
- Do not merge to main without production approval. deploy.yml remains main-push only, with validated tests/build required and serialized production deployments. Nothing in this follow-up merges, deploys, migrates remote D1, installs Worker secrets, or activates cron.
- OPS separately installs Actions encrypted secrets STATS_CF_API_TOKEN and STATS_CF_ACCOUNT_ID from the approved item. The source token must be Account Analytics Read scoped to the owning account, distinct from the existing CLOUDFLARE_API_TOKEN deployment credential. No new deployment credential or policies are needed. The unchanged CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_D1_DATABASE_ID Actions secrets remain the deployment identity.
- scripts/deploy-stats.mjs validates every required credential/config, source/deployment account equality, expected Worker name/domain/D1 binding/name/ID, and built config. It reads the target D1 identity using the existing deployment token, then securely queries actual browser/RUM settings and data using the same collectPublicStats source path as the scheduled Worker. Missing/failed/empty/stale/malformed data aborts before remote mutations, never installing synthetic or fallback zeros. Measured zeros remain valid; missing dates remain null.
- Only a bounded canonical public projection, its escaped singleton SQL, and a two-field Wrangler secrets JSON file are written mode 0600 in a private RUNNER_TEMP child directory (0700). Actions stores the inputs encrypted; the temporary secrets JSON is necessarily plaintext for Wrangler, never an artifact. Wrangler disk logging is disabled and privileged command/error output is withheld. Cleanup runs in finally and an always() workflow step; no private source payload is saved/uploaded.
- After all gates pass: apply the existing migrations; bootstrap/read back the exact singleton in the explicitly targeted remote D1; deploy built reviewed code once with --secrets-file (additive, preserving omitted secrets); verify /stats.json and the real Chromium /stats render against the exact initial snapshot, status/headers/privacy/current 30 dates/freshness/source definitions and null/partial metrics. No public refresh endpoint exists. The existing code schedule 03:15 UTC becomes active only with this approved main deployment, not during this follow-up.
- Failures after the first migration can leave remote changes applied; this is not a transaction spanning D1 and Worker deployment. The workflow fails closed and needs OPS inspection/retry, not a secret-only deployment or automatic rollback. No pre-merge production execution is possible locally because the deployment credential is Actions-only.

Repeatable Actions bootstrap exercise (Node 24+, Playwright Chromium installed; local writes only)
  npm ci
  npx playwright install chromium
  npm run ci
  STATS_VERIFY_RENDERED=1 node verification/stats-actions-local.mjs
This uses clearly synthetic schema fixtures (fake UUIDs and counts, never production fixture data), validates source/built identities and fake UUID injection, runs exact emitted SQL through isolated LOCAL D1 by both `DB` and `agentfirst` with exact byte readback, a real Wrangler --dry-run --secrets-file with clearly FAKE values outside the repo, strict JSON/human browser comparison, and all four rendered scripts. It removes its temporary files/server finally. CI repeats the fake SQL/dry-run/browser checks. To also exercise a new real source pull, securely inject the approved STATS_CF_API_TOKEN and STATS_CF_ACCOUNT_ID into this same process environment; it uses collectPublicStats, writes only the canonical projection to LOCAL D1 and checks the rendered build against that same pull. It never saves raw responses or credentials and never runs remote migration/deploy.

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
