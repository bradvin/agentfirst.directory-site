# Public edge traffic statistics

`/stats` and `/stats.json` publish Cloudflare zone edge metrics (`httpRequests1dGroups`), not browser/RUM metrics. Collection uses the configured zone without hostname, bot, crawler, or eyeball filters. This is all Cloudflare-proxied zone traffic, potentially including other proxied hostnames. HTTP requests include assets and other network traffic; they are not page views. Unique visitors are Cloudflare's network/IP-based metric, not identifiable humans or a count of agents.

## Source and semantics

The headline query selects **no dimensions**, once for the whole reporting window:

```graphql
query EdgeTotals($zoneTag: string, $from: Date, $to: Date) {
  viewer { zones(filter: {zoneTag: $zoneTag}) {
    totals: httpRequests1dGroups(limit: 1, filter: {date_geq: $from, date_lt: $to}) {
      sum { requests }
      uniq { uniques }
    }
  } }
}
```

A separate query selects daily `dimensions { date }`, `sum { requests }`, `uniq { uniques }`, and `avg { sampleInterval }` for exactly the same range. Daily unique visitors are not additive. Daily values are never used to calculate headline unique visitors. Counts are validated as nonnegative safe integers; the returned sampling metadata is disclosed without multiplying counts by the interval.

Cloudflare's documentation establishes IP/network-based visitors, proxy scope, and inclusion of bots/crawlers. It does **not** establish whether `httpRequests1dGroups` whole-window `uniq.uniques` deduplicates IPs across dates or aggregates daily cardinalities. We therefore publish the exact provider field and this limitation, without claiming monthly distinct-human or confirmed cross-day distinct-IP counts. Documentation consulted:

- https://developers.cloudflare.com/analytics/faq/about-analytics/
- https://developers.cloudflare.com/analytics/account-and-zone-analytics/zone-analytics/
- https://developers.cloudflare.com/analytics/graphql-api/features/filtering/
- https://developers.cloudflare.com/analytics/graphql-api/features/sorting/
- https://developers.cloudflare.com/analytics/graphql-api/limits/

The approved parent read-only query for `[2026-09-07, 2026-10-07)` returned 42,075 HTTP requests and 5,977 unique visitors, matching the Overview screenshot after rounding. That result proves source selection, not cross-day deduplication semantics or execution of this new integrated collector. No source identifiers, raw responses, or credentials belong in this public repository.

## Schema version 2

The breaking public contract has exactly these fields:

- `schemaVersion: "2"`; `status`: `fresh`, `stale`, or `unavailable`.
- `refreshedAt`: successful capture time in UTC, or null.
- `period`: inclusive `start`/`end`, `timezone: "UTC"`, `days: 30`.
- `source`: constant name, dataset, zone-wide scope, metric definitions, and caveats.
- `coverage`: `reportedDays`, `missingDays`, and `sampled` (daily metadata only, not proof of aggregate sampling state).
- `totals`: `uniqueVisitors`, `requests`, `complete`. `complete` means the whole-window API aggregate was returned, not that every daily row exists.
- `daily`: 30 ordered objects with `date`, `uniqueVisitors`, `requests`, `sampleInterval`; all measurements are null for missing dates, not invented zeros.

The reporting window is 30 completed UTC dates. Today's partial date is excluded. Refresh time is not the reporting-period end. Successful collection may have missing daily rows while retaining an independently reported aggregate. No aggregate row is unavailable, not zero. Zero counts returned by the provider are valid. Daily request sums cannot exceed the full-window aggregate; with all 30 rows, the request sum must equal it. A 31-row daily limit is a truncation sentinel above the maximum 30 groups, with duplicate/out-of-window groups rejected. Dataset settings are checked before traffic queries: enabled, four required fields, duration/retention at least 30 days, page size at least 31.

Stored version-1 browser snapshots and malformed/private unexpected fields are rejected, never relabelled or used as fallback. During sequencing they produce an explicit version-2 unavailable response. A failed refresh keeps a valid version-2 last-good snapshot marked stale. Snapshots older than 36 hours or ending before the current completed window are stale. No successful capture is claimed on failure.

The accessible page retains status metadata, responsive request chart with distinctly labelled missing dates, and the complete daily table. Both routes read the same validated D1 singleton. GET/HEAD are allowed, mutation methods are 405, JSON is CORS-readable, and public responses are cached for 300 seconds. Request handling never calls analytics and there is no public refresh endpoint.

## Deployment and credentials

The existing Worker `agentfirst-directory`, D1 database name `agentfirst`, custom domain, and daily `15 3 * * *` schedule are unchanged. The private runtime database UUID remains injected by Actions, not committed. `CLOUDFLARE_API_TOKEN` is the deployment credential; the source credential never performs writes.

Operations separately provisions exactly `STATS_CF_API_TOKEN`, `STATS_CF_ACCOUNT_ID`, and `STATS_CF_ZONE_ID` as Actions secrets. Account/zone IDs must be lowercase 32-hex values; source account must equal the unchanged deployment account. The token is never logged or passed as a command argument. The exact zone query establishes access but does not prove zone ownership under that account. Cross-account ownership remains unverified without an authoritative response from existing approved permissions; do not add Zone Read or remove existing permissions.

Normal deployment preserves the existing fail-before-remote-mutation gates: build and verify config/target account, Worker DB binding and domain, source readiness/query/projection; privately stage the projected bootstrap SQL/snapshot and three-key secret file at mode 0600 in a mode-0700 temporary directory; apply migration/bootstrap; read back the exact remote singleton; deploy via `wrangler deploy --secrets-file`; verify both rendered page and JSON against that same snapshot. Omitted unrelated runtime secrets are not included or deleted. Files are cleaned on success/failure. A missing zone secret prevents bootstrap/deploy before remote writes. Production deployment, main push, merge, remote D1 operations, and secret provisioning require separate approval and are not part of implementation verification.

## Local verification and genuine replay

Use the installed Node 24+ runtime and Wrangler:

```sh
npm ci
npm run ci
node verification/stats-worker-scheduled.mjs
STATS_VERIFY_RENDERED=1 node verification/stats-actions-local.mjs
```

The scheduled harness executes the actual built Worker in workerd with **fake** source responses and local D1. The Actions harness uses actual Wrangler local migrations, idempotent bootstrap/readback, fake-secret dry-run, built Worker route/header/status/privacy checks, old-schema migration behavior, and Chromium desktop/mobile checks. It never reads genuine credentials. Set `STATS_ARTIFACT_DIR` to an existing private external artifact directory to retain browser evidence.

For the parent to exercise the **genuine integrated collector**, pipe a securely retrieved JSON object with exactly the three `STATS_CF_*` keys into:

```sh
node verification/stats-real-local.mjs --stdin
```

Or supply those keys securely in the environment and run without `--stdin`. Do not paste values into commands, save credential files, enable shell tracing, or dump environment/upstream responses. This script makes read-only settings/aggregate/daily queries, creates a fresh isolated private local persist directory outside the repository, applies installed Wrangler migrations with `--local`, bootstraps and verifies the public-only singleton, and prints only public measurements and local artifact paths. It performs no remote writes. It emits only a generic error on failure. Source credentials are removed from subprocess environments. The retained artifact contains only the allowlisted public snapshot. Parent verification is still required before approval.
