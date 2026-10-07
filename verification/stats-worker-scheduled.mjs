// Exercise the actual built Worker scheduled handler in workerd with fake upstream only.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';
import { fakeSourceEnv, edgeRaw, edgeRow, sourceResponse } from '../test/fixtures/edge-stats.mjs';
import { completePeriod, projectCloudflare } from '../src/lib/public-stats.ts';
const now = new Date();
const raw = edgeRaw([edgeRow(completePeriod(now).end)]);
let calls = 0;
let fail = false;
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
  name: 'edge-stats-local-test',
  modules: ['entry.mjs', ...readdirSync('dist/server', { recursive: true }).filter(p => p !== 'entry.mjs' && /\.(mjs|js)$/.test(p))].map(p => ({ type: 'ESModule', path: resolve('dist/server', p), contents: readFileSync(resolve('dist/server', p), 'utf8') })),
  modulesRoot: resolve('dist/server'),
  compatibilityDate: '2026-03-17', compatibilityFlags: ['nodejs_compat'],
  bindings: fakeSourceEnv, d1Databases: ['DB'],
  assets: { directory: resolve('dist/client'), binding: 'ASSETS' },
  outboundService: async request => {
    calls++;
    assert.equal(request.url, 'https://api.cloudflare.com/client/v4/graphql');
    assert.equal(request.headers.get('Authorization'), `Bearer ${fakeSourceEnv.STATS_CF_API_TOKEN}`);
    const body = await request.json();
    assert.equal(body.variables.zoneTag, fakeSourceEnv.STATS_CF_ZONE_ID);
    if (fail) return Response.json({ errors: [{ message: 'PRIVATE upstream failure' }] });
    return Response.json(sourceResponse(calls, raw));
  },
}], log: new Log(LogLevel.ERROR) }));
try {
  const bindings = await mf.getBindings('edge-stats-local-test');
  for (const [key, value] of Object.entries(fakeSourceEnv)) assert.equal(bindings[key], value);
  const db = await mf.getD1Database('DB');
  await db.exec(readFileSync('migrations/0006_public_stats.sql','utf8').split('\n').filter(line => !line.trim().startsWith('--')).join(' '));
  const worker = await mf.getWorker();
  await worker.scheduled({ scheduledTime: now.getTime(), cron: '15 3 * * *' });
  assert.equal(calls, 3);
  const stored = JSON.parse((await db.prepare('SELECT snapshot FROM public_stats WHERE id=1').first()).snapshot);
  assert.deepEqual(stored.totals, projectCloudflare(raw, completePeriod(now), now).totals);
  assert.equal(stored.schemaVersion, '2'); assert.equal(stored.status, 'fresh');
  const json = await worker.fetch('http://localhost/stats.json', { redirect: 'manual' });
  assert.equal(json.status, 200); assert.equal(json.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(await json.json(), stored);
  fail = true;
  await worker.scheduled({ scheduledTime: now.getTime(), cron: '15 3 * * *' });
  const stale = await (await worker.fetch('http://localhost/stats.json', { redirect: 'manual' })).json();
  assert.equal(stale.status, 'stale'); assert.deepEqual(stale.totals, stored.totals);
  assert.equal(stale.refreshedAt, stored.refreshedAt);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM public_stats').first()).n, 1);
  assert.doesNotMatch(JSON.stringify(stale), /PRIVATE|FAKE|accountTag|zoneTag|token/);
  console.log('PASS: actual built workerd scheduled success uses three fake-only queries; route equals singleton; scheduled failure retains exact totals/timestamp and marks stale.');
} finally { await mf.dispose(); }
