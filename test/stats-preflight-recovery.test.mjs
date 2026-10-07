import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRemoteDatabase, injectDatabase } from '../scripts/stats-deploy-helpers.mjs';
import { deployStats } from '../scripts/deploy-stats.mjs';
import { createPreflightReporter } from '../scripts/stats-preflight-diagnostics.mjs';

const env = { CLOUDFLARE_API_TOKEN: 'FAKE_DEPLOY_ONLY', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_D1_DATABASE_ID: '11111111-1111-1111-1111-111111111111', STATS_CF_API_TOKEN: 'FAKE_READ_ONLY', STATS_CF_ACCOUNT_ID: 'a'.repeat(32), GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'bradvin/agentfirst.directory-site' };
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const goodDB = { success: true, result: { uuid: env.CLOUDFLARE_D1_DATABASE_ID, name: 'agentfirst' } };
const goodWorker = { success: true, result: { bindings: [{ type: 'd1', name: 'DB', id: env.CLOUDFLARE_D1_DATABASE_ID }] } };
const goodDomain = { success: true, result: [{ hostname: 'agentfirst.directory', service: 'agentfirst-directory', environment: 'production' }] };
const goodSettings = { data: { viewer: { accounts: [{ settings: { rumPageloadEventsAdaptiveGroups: { enabled: true, availableFields: ['count', 'sum_visits', 'avg_sampleInterval', 'dimensions_date', 'dimensions_requestHost'], maxDuration: 30*86400, notOlderThan: 30*86400, maxPageSize: 31 } } }] } } };

test('D1 identity uses precisely Wrangler 4.128.0 uuid/name field selection without metrics reads', async () => {
  await validateRemoteDatabase(env, async url => {
    assert.equal(new URL(url).search, '?fields=uuid%2Cname');
    return Response.json(goodDB);
  });
});

test('identity diagnostic accepts only fixed reasons on the database gate and resets on the next request', async () => {
  const reporter = createPreflightReporter(async () => Response.json({ success: true }));
  reporter.identityFailure('identity-name');
  assert.equal(reporter.summary(), undefined);
  await reporter.forGate('remote-database')();
  reporter.identityFailure('PRIVATE ' + env.CLOUDFLARE_API_TOKEN);
  assert.doesNotMatch(reporter.summary(), /reason=|PRIVATE|FAKE/);
  for (const reason of ['identity-envelope', 'identity-uuid', 'identity-name']) {
    reporter.identityFailure(reason);
    assert.ok(reporter.summary().includes(`; reason=${reason}`));
  }
  await reporter.forGate('remote-worker-bindings')();
  reporter.identityFailure('identity-uuid');
  assert.doesNotMatch(reporter.summary(), /reason=/);
});

test('every source-preflight rejection identifies its safe gate and numeric status/code, never mutates or leaks', async () => {
  const previous = process.cwd();
  const root = mkdtempSync(join(tmpdir(), 'stats-recovery-test-'));
  const repo = join(root, 'repo'); const runner = join(root, 'runner');
  mkdirSync(repo); mkdirSync(runner);
  try {
    process.chdir(repo);
    for (const [gate, stage] of [['remote-database', 0], ['remote-worker-bindings', 1], ['remote-worker-domain', 2], ['source-settings', 3], ['source-query', 4]]) {
      for (const mode of ['http', 'envelope', 'shape', 'transport', 'invalid-json', 'unsafe-code', 'oversize', ...(gate === 'remote-database' ? ['old-name', 'wrong-uuid'] : [])]) {
        writeFileSync('wrangler.jsonc', JSON.stringify(config));
        let call = 0; let mutation = false;
        const fetcher = async () => {
          if (call++ !== stage) return Response.json([goodDB, goodWorker, goodDomain, goodSettings][call-1]);
          if (mode === 'transport') throw Error('PRIVATE ' + env.CLOUDFLARE_API_TOKEN);
          if (mode === 'invalid-json') return new Response('PRIVATE ' + env.STATS_CF_API_TOKEN, { status: 502 });
          if (mode === 'oversize') return new Response('PRIVATE'.repeat(20000), { status: 502 });
          if (mode === 'shape') return Response.json({ success: true, result: {}, data: {} });
          if (mode === 'old-name') return Response.json({ ...goodDB, result: { ...goodDB.result, name: 'agentfirst-directory' } });
          if (mode === 'wrong-uuid') return Response.json({ ...goodDB, result: { ...goodDB.result, uuid: '22222222-2222-2222-2222-222222222222' } });
          return Response.json({ success: false, errors: [{ code: mode === 'unsafe-code' ? env.CLOUDFLARE_API_TOKEN : 10000, message: 'PRIVATE', account: env.CLOUDFLARE_ACCOUNT_ID }], result: {} }, { status: mode === 'http' ? 403 : 200 });
        };
        const run = (command) => {
          if (command !== 'npm') { mutation = true; assert.fail('No production command allowed'); }
          mkdirSync('dist/server', { recursive: true });
          const built = injectDatabase(config, env);
          built.main = 'entry.mjs'; built.d1_databases[0].migrations_dir = '../../migrations';
          writeFileSync('dist/server/wrangler.json', JSON.stringify(built));
        };
        await assert.rejects(deployStats({ env: { ...env, RUNNER_TEMP: runner }, fetcher, run }), error => {
          const status = mode === 'transport' ? 'none' : mode === 'http' ? '403' : ['invalid-json','oversize'].includes(mode) ? '502' : '200';
          const code = ['http','envelope'].includes(mode) ? '10000' : 'none';
          const reason = gate !== 'remote-database' ? '' :
            ['envelope', 'unsafe-code'].includes(mode) ? '; reason=identity-envelope' :
            ['shape', 'wrong-uuid'].includes(mode) ? '; reason=identity-uuid' :
            mode === 'old-name' ? '; reason=identity-name' : '';
          assert.equal(error.message, `Stats deployment failed at ${gate}; HTTP status=${status}; error code=${code}${reason} (sanitized diagnostics only).`);
          assert.equal(error.cause, undefined);
          for (const secret of ['PRIVATE', env.CLOUDFLARE_API_TOKEN, env.STATS_CF_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_D1_DATABASE_ID]) assert.ok(!error.message.includes(secret));
          return true;
        });
        assert.equal(mutation, false);
        assert.deepEqual(readdirSync(runner), []);
      }
    }
  } finally { process.chdir(previous); rmSync(root, { recursive: true, force: true }); }
});
