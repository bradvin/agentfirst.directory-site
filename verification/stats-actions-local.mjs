// LOCAL-ONLY exercise of exact emitted SQL and actual Wrangler --secrets-file dry run.
// Optional read-only source env uses the same collector; never persist raw responses.
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getPlatformProxy } from 'wrangler';
import { collectPublicStats } from '../src/lib/stats-collector.ts';
import { completePeriod, projectCloudflare } from '../src/lib/public-stats.ts';
import { createPrivateDirectory, prepareFiles, validateConfig, injectDatabase } from '../scripts/stats-deploy-helpers.mjs';
const env = { CLOUDFLARE_API_TOKEN: 'FAKE_DEPLOY_TEST_NOT_A_CREDENTIAL', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_D1_DATABASE_ID: '11111111-1111-1111-1111-111111111111', STATS_CF_API_TOKEN: 'FAKE_SOURCE_TEST_NOT_A_CREDENTIAL', STATS_CF_ACCOUNT_ID: 'a'.repeat(32) };
const directory = createPrivateDirectory(tmpdir());
const state = join(directory, 'state');
let server;
const childEnv = { ...process.env, WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false' };
for (const key of Object.keys(childEnv)) if (/TOKEN|SECRET|PASSWORD|STATS_CF|CLOUDFLARE/i.test(key)) delete childEnv[key];
const run = args => {
  const result = spawnSync('./node_modules/.bin/wrangler', args, { env: childEnv, encoding: 'utf8', timeout: 120_000, maxBuffer: 8*1024*1024 });
  if (result.status !== 0) throw Error('Local Wrangler exercise failed (diagnostics withheld)');
  return result.stdout;
};
try {
  const sourceConfig = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const builtConfig = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
  validateConfig(sourceConfig, env, { injected: false });
  validateConfig(builtConfig, env, { built: true, injected: false });
  const injected = injectDatabase(sourceConfig, env);
  const injectedBuilt = structuredClone(builtConfig);
  injectedBuilt.d1_databases[0].database_id = injected.d1_databases[0].database_id;
  validateConfig(injectedBuilt, env, { built: true });
  // These counts and UUIDs are synthetic schema fixtures, never production data.
  const now = new Date();
  const snapshot = projectCloudflare({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [{ dimensions: { date: completePeriod(now).end, requestHost: 'agentfirst.directory' }, pageViews: 42, sum: { visits: 3 }, avg: { sampleInterval: 2 } }] }] } } }, completePeriod(now), now);
  const files = prepareFiles(directory, snapshot, env, now);
  run(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state]);
  run(['d1', 'execute', 'DB', '--local', '--persist-to', state, '--file', files.sql]);
  // Reapply by the corrected database name: it must resolve to the same DB binding.
  run(['d1', 'execute', 'agentfirst', '--local', '--persist-to', state, '--file', files.sql]);
  const rows = JSON.parse(run(['d1', 'execute', 'DB', '--local', '--persist-to', state, '--command', 'SELECT id, snapshot FROM public_stats', '--json']));
  assert.equal(rows[0].results.length, 1); assert.equal(rows[0].results[0].id, 1);
  assert.equal(rows[0].results[0].snapshot, JSON.stringify(snapshot));
  assert.deepEqual(JSON.parse(rows[0].results[0].snapshot), snapshot);
  // Always fake values, including when an optional real read-only source env is provided.
  run(['deploy', '--dry-run', '--config', 'dist/server/wrangler.json', '--secrets-file', files.secrets, '--outdir', join(directory, 'dry-build')]);
  console.log('PASS: exact bootstrap SQL through local D1 twice; singleton readback; actual --secrets-file dry-run with FAKE values only.');
  let expected = snapshot;
  if (process.env.STATS_CF_API_TOKEN || process.env.STATS_CF_ACCOUNT_ID) {
    const actual = await collectPublicStats(process.env);
    const proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', remoteBindings: false, persist: { path: `${state}/v3` } });
    try {
      const { bootstrapSql, validateBootstrapSnapshot } = await import('../scripts/stats-deploy-helpers.mjs');
      validateBootstrapSnapshot(actual);
      await proxy.env.DB.exec(bootstrapSql(actual));
      const result = await proxy.env.DB.prepare('SELECT snapshot FROM public_stats WHERE id = 1').first();
      assert.deepEqual(JSON.parse(result.snapshot), actual);
      expected = actual;
      console.log('PASS: approved read-only real browser/RUM pull; shared projected SQL persisted/read back in LOCAL D1 only.');
    } finally { await proxy.dispose(); }
  }
  run(['d1', 'execute', 'DB', '--local', '--persist-to', state, '--file', 'test/fixtures/seed-classifications.sql']);
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  server = spawn('./node_modules/.bin/wrangler', ['dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', state, '--host', '127.0.0.1', '--ip', '127.0.0.1', '--port', String(port)], { env: childEnv, stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch(`${base}/`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    if (server.exitCode !== null) throw Error();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready);

  const { verifyDeployedStats } = await import('../scripts/verify-deployed-stats.mjs');
  await verifyDeployedStats(expected, { base });
  console.log('PASS: built LOCAL Worker JSON and Chromium /stats match exact bootstrap snapshot, headers, privacy, freshness and 30 dates.');
  const states = spawnSync(process.execPath, ['verification/stats-local-states.mjs'], { env: { ...childEnv, BASE_URL: base, STATS_LOCAL_STATE: state }, encoding: 'utf8', timeout: 120_000, maxBuffer: 8*1024*1024 });
  if (states.status !== 0) throw Error();
  console.log('PASS: scheduled failure retains last good; unavailable/corrupt storage remains null and private fields never leak.');
  if (process.env.STATS_VERIFY_RENDERED === '1') {
    const result = spawnSync('npm', ['run', 'verify:rendered'], { env: { ...childEnv, BASE_URL: base }, encoding: 'utf8', timeout: 300_000, maxBuffer: 8*1024*1024 });
    if (result.status !== 0) throw Error();
    console.log('PASS: all four full rendered verification scripts against the same isolated LOCAL Worker.');
  }
} catch (error) {
  const code = /^Deployed stats verification failed: [a-z-]+$/.test(error?.message ?? '') ? error.message : 'local-exercise';
  console.error(`Local stats Actions verification failed: ${code} (no private diagnostics emitted).`); process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
  rmSync(directory, { recursive: true, force: true });
}
