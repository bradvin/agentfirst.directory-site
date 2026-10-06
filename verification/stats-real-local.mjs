import { writeFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { refreshPublicStats } from '../src/lib/stats-collector.ts';
import { readPublicStats } from '../src/lib/public-stats.ts';
// Read-only credential access; no credential values or raw responses in stdout.
const persistPath = process.env.STATS_LOCAL_STATE;
const privateDir = process.env.STATS_PRIVATE_DIR;
if (!persistPath || !privateDir) throw new Error('STATS_LOCAL_STATE and STATS_PRIVATE_DIR required');
const token = process.env.STATS_CF_API_TOKEN; const account = process.env.STATS_CF_ACCOUNT_ID;
if (!token || !account) throw new Error('Server-side read-only credential environment required');
const proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', remoteBindings: false, persist: { path: `${persistPath}/v3` } });
const pulledAt = new Date();
let index = 0;
try {
  const fetcher = async (url, init) => {
    const response = await fetch(url, init);
    const body = await response.clone().text();
    writeFileSync(`${privateDir}/stats-collector-real-${index++}.json`, body, { mode: 0o600 });
    return response;
  };
  const success = await refreshPublicStats({ DB: proxy.env.DB, STATS_CF_API_TOKEN: token, STATS_CF_ACCOUNT_ID: account }, pulledAt, fetcher);
  if (!success) throw new Error('Read-only Cloudflare collector failed');
  const snapshot = await readPublicStats(proxy.env.DB, pulledAt);
  writeFileSync(`${privateDir}/stats-real-public-snapshot.json`, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ success, pulledAt: pulledAt.toISOString(), period: snapshot.period, coverage: snapshot.coverage, totals: snapshot.totals, status: snapshot.status }));
} finally { await proxy.dispose(); }
