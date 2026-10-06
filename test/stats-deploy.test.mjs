import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCredentials, validateConfig, injectDatabase, validateRemoteDatabase, validateRemoteWorker, validateBootstrapSnapshot, bootstrapSql, prepareFiles, createPrivateDirectory } from '../scripts/stats-deploy-helpers.mjs';
import { deployStats } from '../scripts/deploy-stats.mjs';
import { collectPublicStats } from '../src/lib/stats-collector.ts';
import { projectCloudflare, completePeriod } from '../src/lib/public-stats.ts';
const env = { CLOUDFLARE_API_TOKEN: 'FAKE_DEPLOY_ONLY', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_D1_DATABASE_ID: '11111111-1111-1111-1111-111111111111', STATS_CF_API_TOKEN: 'FAKE_READ_ONLY', STATS_CF_ACCOUNT_ID: 'a'.repeat(32), GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'bradvin/agentfirst.directory-site' };
const source = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const now = new Date();
const row = { dimensions: { date: completePeriod(now).end, requestHost: 'agentfirst.directory', ip: 'PRIVATE' }, pageViews: 42, sum: { visits: 3 }, avg: { sampleInterval: 2 } };
const raw = { data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [row] }] } } };
const settings = { data: { viewer: { accounts: [{ settings: { rumPageloadEventsAdaptiveGroups: { enabled: true, availableFields: ['count', 'sum_visits', 'avg_sampleInterval', 'dimensions_date', 'dimensions_requestHost'], maxDuration: 30*86400, notOlderThan: 30*86400, maxPageSize: 31 } } }] } } };
const snapshot = () => projectCloudflare(raw, completePeriod(now), now);
const rejected = fn => assert.throws(fn);

test('credential checks reject each absent, malformed, reused or mismatched source/deployment credential', () => {
  validateCredentials(env);
  for (const key of Object.keys(env).filter(k => /CLOUDFLARE|STATS_CF/.test(k))) {
    for (const value of ['', undefined, ' PRIVATE\n']) rejected(() => validateCredentials({ ...env, [key]: value }));
  }
  for (const change of [{ STATS_CF_ACCOUNT_ID: 'b'.repeat(32) }, { STATS_CF_API_TOKEN: env.CLOUDFLARE_API_TOKEN }, { CLOUDFLARE_D1_DATABASE_ID: '00000000-0000-0000-0000-000000000000' }, { CLOUDFLARE_D1_DATABASE_ID: "';DROP TABLE public_stats;--" }]) rejected(() => validateCredentials({ ...env, ...change }));
});
test('config injection preserves expected main identity; rejects domain/worker/D1/account/schedule overrides', () => {
  const config = injectDatabase(source, env); validateConfig(config, env);
  assert.equal(source.d1_databases[0].database_id, '00000000-0000-0000-0000-000000000000');
  for (const change of [{ name: 'other' }, { routes: [] }, { workers_dev: true }, { preview_urls: true }, { account_id: 'b'.repeat(32) }, { triggers: { crons: ['* * * * *'] } }, { env: {} }, { vars: { STATS_CF_API_TOKEN: 'PRIVATE' } }, { build: { command: 'evil' } }, { d1_databases: [{ ...config.d1_databases[0], database_id: '22222222-2222-2222-2222-222222222222' }] }, { d1_databases: [{ ...config.d1_databases[0], database_name: 'other' }] }, { d1_databases: [{ ...config.d1_databases[0], binding: 'OTHER' }] }]) rejected(() => validateConfig({ ...config, ...change }, env));
});
test('read-only identity lookup pins exact existing account+DB and rejects wrong DB names/IDs', async () => {
  const good = { success: true, result: { uuid: env.CLOUDFLARE_D1_DATABASE_ID, name: 'agentfirst-directory' } };
  await validateRemoteDatabase(env, async (url, options) => { assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.CLOUDFLARE_D1_DATABASE_ID}?fields=uuid%2Cname`); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, `Bearer ${env.CLOUDFLARE_API_TOKEN}`); return Response.json(good); });
  for (const body of [{ success: false }, { ...good, result: { ...good.result, name: 'other' } }, { ...good, result: { ...good.result, uuid: 'other' } }]) await assert.rejects(validateRemoteDatabase(env, async () => Response.json(body)));
});
test('live Worker DB binding/domain must match existing account and deployment identity before mutations', async () => {
  const binding = { name: 'DB', type: 'd1', id: env.CLOUDFLARE_D1_DATABASE_ID };
  const domain = { hostname: 'agentfirst.directory', service: 'agentfirst-directory', environment: 'production' };
  const fetcher = (bindings = [binding], domains = [domain]) => async (url, options) => {
    assert.ok(url.startsWith(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/`));
    assert.equal(options.headers.Authorization, `Bearer ${env.CLOUDFLARE_API_TOKEN}`);
    return Response.json({ success: true, result: url.includes('/settings') ? { bindings } : domains });
  };
  await validateRemoteWorker(env, fetcher());
  for (const bindings of [[], [binding, binding], [{ ...binding, id: 'wrong' }], [{ ...binding, name: 'OTHER' }]]) await assert.rejects(validateRemoteWorker(env, fetcher(bindings)));
  for (const domains of [[], [domain, domain], [{ ...domain, hostname: 'other.example' }], [{ ...domain, service: 'other-worker' }], [{ ...domain, environment: 'preview' }]]) await assert.rejects(validateRemoteWorker(env, fetcher([binding], domains)));
});
test('source collector is shared, throw-only and returns canonical public projection without a DB', async () => {
  let calls = 0;
  assert.deepEqual(await collectPublicStats(env, now, async (_url, init) => {
    assert.equal(init.headers.Authorization, `Bearer ${env.STATS_CF_API_TOKEN}`);
    if (++calls === 2) assert.equal(JSON.parse(init.body).variables.filter.requestHost, 'agentfirst.directory');
    return Response.json(calls === 1 ? settings : raw);
  }), snapshot());
  assert.equal(calls, 2);
  await assert.rejects(collectPublicStats(env, now, async () => { throw Error('PRIVATE'); }));
});
test('bootstrap bounds/allowlists source, rejects missing, stale, future, extra private fields and forged totals', () => {
  const value = snapshot(); validateBootstrapSnapshot(value, now);
  const sql = bootstrapSql(value, now);
  assert.ok(sql.startsWith('INSERT INTO public_stats (id, snapshot) VALUES (1, '));
  assert.ok(sql.endsWith('ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot;\n'));
  assert.doesNotMatch(sql, /PRIVATE|"ip"|accountTag|token/);
  for (const edit of [s => s.token = 'PRIVATE', s => s.daily[0].ip = 'PRIVATE', s => s.source.name = "';DROP TABLE public_stats;--", s => s.totals.visits = 999, s => s.status = 'stale', s => s.refreshedAt = new Date(now.getTime()-31*60_000).toISOString(), s => s.refreshedAt = new Date(now.getTime()+1000).toISOString(), s => s.daily.pop(), s => s.private = 'X'.repeat(33_000)]) {
    const changed = structuredClone(value); edit(changed); rejected(() => bootstrapSql(changed, now));
  }
  rejected(() => bootstrapSql(projectCloudflare({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [] }] } } }, completePeriod(now), now), now));
});
test('only projected SQL/snapshot and two secret values written privately outside repo, no overwrite', () => {
  const dir = createPrivateDirectory(tmpdir());
  try {
    const files = prepareFiles(dir, snapshot(), env, now);
    assert.equal(statSync(dir).mode & 0o777, 0o700);
    assert.equal(Object.keys(files).length, 3);
    for (const file of Object.values(files)) assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(readFileSync(files.secrets)), { STATS_CF_API_TOKEN: env.STATS_CF_API_TOKEN, STATS_CF_ACCOUNT_ID: env.STATS_CF_ACCOUNT_ID });
    assert.doesNotMatch(readFileSync(files.snapshot, 'utf8'), /FAKE|PRIVATE/);
    rejected(() => prepareFiles(dir, snapshot(), env, now));
    rejected(() => createPrivateDirectory(process.cwd()));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('workflow wiring main only, step-scoped secrets, no secret deploy/artifacts, always cleanup and browser setup', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /push:\n    branches:\n      - main/);
  assert.doesNotMatch(workflow, /workflow_dispatch|pull_request|upload-artifact|wrangler secret|wrangler deploy/);
  assert.match(workflow, /run: node scripts\/deploy-stats.mjs/);
  for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'STATS_CF_API_TOKEN', 'STATS_CF_ACCOUNT_ID']) assert.ok(workflow.includes(`${name}: \${{ secrets.${name} }}`));
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /cancel-in-progress: false/);
});
test('orchestration: source/config gates before mutations, exact SQL/readback/deploy order, no secrets to build, cleanup every failure', async () => {
  const previous = process.cwd();
  const root = mkdtempSync(join(tmpdir(), 'stats-orchestrator-test-'));
  mkdirSync(join(root, 'repo')); mkdirSync(join(root, 'runner'));
  const repo = join(root, 'repo');
  const testEnv = { ...env, RUNNER_TEMP: join(root, 'runner') };
  try {
    process.chdir(repo);
    for (const failure of ['credentials', 'config', 'identity', 'source', 'empty', 'build', 'migration', 'bootstrap', 'readback', 'deploy', 'verify', null]) {
      writeFileSync('wrangler.jsonc', JSON.stringify(failure === 'config' ? { ...source, name: 'other' } : source));
      const calls = []; let request = 0; let filesSnapshot;
      const fetcher = async (url, init) => {
        calls.push('fetch');
        if (url.includes('/d1/database/')) return Response.json({ success: failure !== 'identity', result: { uuid: env.CLOUDFLARE_D1_DATABASE_ID, name: 'agentfirst-directory' } });
        if (url.includes('/workers/scripts/')) return Response.json({ success: true, result: { bindings: [{ name: 'DB', type: 'd1', id: env.CLOUDFLARE_D1_DATABASE_ID }] } });
        if (url.includes('/workers/domains')) return Response.json({ success: true, result: [{ hostname: 'agentfirst.directory', service: 'agentfirst-directory', environment: 'production' }] });
        if (failure === 'source') throw Error('PRIVATE');
        assert.equal(init.headers.Authorization, `Bearer ${env.STATS_CF_API_TOKEN}`);
        return Response.json(++request === 1 ? settings : failure === 'empty' ? { data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [] }] } } } : raw);
      };
      const run = (command, args, childEnv) => {
        const phase = command === 'npm' ? 'build' : args.includes('migrations') ? 'migration' : args.includes('--file') ? 'bootstrap' : args.includes('--command') ? 'readback' : 'deploy';
        calls.push(phase);
        assert.equal(childEnv.STATS_CF_API_TOKEN, undefined);
        if (phase === 'build') {
          assert.equal(childEnv.CLOUDFLARE_API_TOKEN, undefined);
          mkdirSync('dist/server', { recursive: true });
          writeFileSync('dist/server/wrangler.json', JSON.stringify({ ...injectDatabase(source, env), main: 'entry.mjs', d1_databases: [{ ...injectDatabase(source, env).d1_databases[0], migrations_dir: '../../migrations' }] }));
        } else { assert.equal(childEnv.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_API_TOKEN); assert.equal(childEnv.WRANGLER_WRITE_LOGS, 'false'); }
        if (phase === failure) throw Error('PRIVATE');
        if (phase === 'bootstrap') {
          const file = args[args.indexOf('--file')+1];
          const dir = file.slice(0, file.lastIndexOf('/'));
          filesSnapshot = JSON.parse(readFileSync(join(dir, 'snapshot.json')));
          assert.equal(readFileSync(file, 'utf8'), bootstrapSql(filesSnapshot));
          assert.ok(args.includes(env.CLOUDFLARE_D1_DATABASE_ID));
        }
        if (phase === 'readback') return JSON.stringify([{ results: [{ snapshot: JSON.stringify(filesSnapshot) }] }]);
        if (phase === 'deploy') { assert.ok(args.includes('--secrets-file')); assert.ok(args.includes('dist/server/wrangler.json')); }
        return '';
      };
      const operation = deployStats({ env: failure === 'credentials' ? { ...testEnv, STATS_CF_API_TOKEN: '' } : testEnv, fetcher, run, verify: async value => { calls.push('verify'); assert.deepEqual(value, filesSnapshot); if (failure === 'verify') throw Error('PRIVATE'); } });
      if (failure) await assert.rejects(operation, error => /Stats deployment failed at/.test(error.message) && !error.message.includes('PRIVATE') && !error.cause);
      else { await operation; assert.deepEqual(calls, ['build', 'fetch', 'fetch', 'fetch', 'fetch', 'fetch', 'migration', 'bootstrap', 'readback', 'deploy', 'verify']); }
      if (['credentials','config','identity','source','empty','build'].includes(failure)) assert.ok(!calls.includes('migration'));
      assert.deepEqual(readdirSync(testEnv.RUNNER_TEMP), []);
    }
    for (const override of [{ GITHUB_REF: 'refs/heads/feature/public-stats' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REPOSITORY: 'other/repo' }]) {
      await assert.rejects(deployStats({ env: { ...testEnv, ...override }, run: () => assert.fail('no child process'), fetcher: () => assert.fail('no request') }));
    }
  } finally { process.chdir(previous); rmSync(root, { recursive: true, force: true }); }
});
