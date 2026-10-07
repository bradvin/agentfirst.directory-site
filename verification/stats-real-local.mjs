// LOCAL-ONLY genuine read-only edge collector replay. No source responses or secrets on disk.
// Pipe a JSON object with exactly the three STATS_CF_* keys to `--stdin`, or set them in env.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getPlatformProxy } from 'wrangler';
import { collectPublicStats } from '../src/lib/stats-collector.ts';
import { readPublicStats } from '../src/lib/public-stats.ts';
import { bootstrapSql, validateBootstrapSnapshot, createPrivateDirectory } from '../scripts/stats-deploy-helpers.mjs';
const keys = ['STATS_CF_API_TOKEN', 'STATS_CF_ACCOUNT_ID', 'STATS_CF_ZONE_ID'];
let proxy;
try {
  if (process.argv.slice(2).some(arg => arg !== '--stdin') || process.argv.length > 3) throw Error();
  let credentials;
  if (process.argv[2] === '--stdin') {
    let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 8192) throw Error(); }
    credentials = JSON.parse(input);
    if (!credentials || Object.keys(credentials).length !== 3 || !keys.every(k => Object.hasOwn(credentials, k))) throw Error();
  } else credentials = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const key of keys) delete process.env[key];
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  if (config.d1_databases?.length !== 1 || config.d1_databases[0].binding !== 'DB' || config.d1_databases[0].database_name !== 'agentfirst' || config.d1_databases[0].remote === true) throw Error();
  // Collect before any local bootstrap; readiness/format/shape errors leave no data behind.
  const now = new Date();
  const snapshot = await collectPublicStats(credentials, now);
  validateBootstrapSnapshot(snapshot, now);
  const directory = createPrivateDirectory(process.env.STATS_LOCAL_ROOT || process.env.TMPDIR);
  const state = join(directory, 'state');
  const childEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' };
  for (const key of Object.keys(childEnv)) if (/TOKEN|SECRET|PASSWORD|STATS_CF|CLOUDFLARE/i.test(key)) delete childEnv[key];
  const migration = spawnSync('./node_modules/.bin/wrangler', ['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], { env: childEnv, encoding: 'utf8', timeout: 120000, maxBuffer: 8*1024*1024 });
  if (migration.status !== 0) throw Error();
  proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', remoteBindings: false, persist: { path: `${state}/v3` } });
  await proxy.env.DB.exec(bootstrapSql(snapshot, now));
  assert.deepEqual(await readPublicStats(proxy.env.DB, now), snapshot);
  assert.equal((await proxy.env.DB.prepare('SELECT count(*) AS n FROM public_stats').first()).n, 1);
  const publicFile = join(directory, 'public-snapshot.json');
  writeFileSync(publicFile, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ success: true, source: 'genuine-read-only-edge', status: snapshot.status, period: snapshot.period, totals: snapshot.totals, coverage: snapshot.coverage, refreshedAt: snapshot.refreshedAt, zoneOwnership: 'unverified-cross-account', localState: state, publicSnapshot: publicFile }));
} catch {
  console.error('Local genuine edge collector verification failed (private diagnostics withheld).'); process.exitCode = 1;
} finally { if (proxy) await proxy.dispose(); }
