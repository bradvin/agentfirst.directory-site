import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completePeriod, projectCloudflare, decodeSnapshot, unavailableStats, readPublicStats, publicStatsResponse, savePublicStats } from '../src/lib/public-stats.ts';
import { STATS_QUERY, DAILY_QUERY, statsVariables, validateSettings, refreshPublicStats, collectPublicStats } from '../src/lib/stats-collector.ts';
import { edgeRow, edgeRaw, edgeSettings, fakeSourceEnv, sourceResponse } from './fixtures/edge-stats.mjs';
const now = new Date('2026-10-07T12:00:00Z');
const period = completePeriod(now);
const raw = () => edgeRaw([edgeRow(period.start, 40, 5), edgeRow(period.end, 60, 5)], 100, 7);
function db(initial) {
  return { raw: initial, writes: 0, prepare() { return { bind: value => ({ run: async () => { this.writes++; this.raw = value; } }), first: async () => this.raw ? { snapshot: this.raw } : null, run: async () => { if (this.raw) this.raw = JSON.stringify({ ...JSON.parse(this.raw), status: 'stale' }); } }; } };
}
test('v2 completed UTC window, exact zone scope, separate no-dimension aggregate and bounded daily query', () => {
  assert.deepEqual(period, { start: '2026-09-07', end: '2026-10-06', timezone: 'UTC', days: 30 });
  assert.equal(completePeriod(new Date('2024-03-01T23:59:59Z')).end, '2024-02-29');
  assert.equal(completePeriod(new Date('2027-01-01T00:00:00Z')).end, '2026-12-31');
  assert.deepEqual(statsVariables(fakeSourceEnv.STATS_CF_ZONE_ID, now), { zoneTag: 'b'.repeat(32), from: period.start, to: '2026-10-07' });
  assert.match(STATS_QUERY, /limit: 1/); assert.doesNotMatch(STATS_QUERY, /dimensions|requestHost|requestSource|eyeball/);
  assert.match(DAILY_QUERY, /limit: 31/); assert.match(DAILY_QUERY, /date_ASC/);
});
test('full-window API uniques are NOT summed daily uniques; sparse daily coverage does not downgrade authoritative totals', () => {
  const s = projectCloudflare(raw(), period, now);
  assert.equal(s.schemaVersion, '2'); assert.equal(s.status, 'fresh'); assert.equal(s.daily.length, 30);
  assert.deepEqual(s.totals, { uniqueVisitors: 7, requests: 100, complete: true });
  assert.equal(s.daily[0].uniqueVisitors, 5); assert.equal(s.daily[29].uniqueVisitors, 5);
  assert.equal(s.daily[1].requests, null);
  assert.deepEqual(s.coverage, { reportedDays: 2, missingDays: 28, sampled: true });
  assert.match(s.source.metrics.uniqueVisitors, /uniq.uniques/); assert.match(s.source.caveats.join(' '), /deduplicat|deduplication/);
  assert.doesNotMatch(JSON.stringify(s), /accountTag|zoneTag|token|pageViews|visits/);
});
test('zero full-window totals remain measured even without daily observations; absent aggregate rejects', () => {
  assert.deepEqual(projectCloudflare(edgeRaw([], 0, 0), period, now).totals, { uniqueVisitors: 0, requests: 0, complete: true });
  const noTotal = raw(); noTotal.data.viewer.zones[0].totals = []; assert.throws(() => projectCloudflare(noTotal, period, now));
  const rows = unavailableStats(now).daily.map(d => edgeRow(d.date, 1, 1, 1));
  assert.equal(projectCloudflare(edgeRaw(rows, 30, 17), period, now).coverage.reportedDays, 30);
  assert.throws(() => projectCloudflare(edgeRaw(rows, 31, 17), period, now));
});
test('unexpected/private fields, errors, truncation, duplicates, invalid range/count/sample metadata reject', () => {
  for (const edit of [s => s.token = 'PRIVATE', s => s.data.viewer.zones[0].zoneTag = 'PRIVATE', s => s.data.viewer.zones[0].daily[0].ip = 'PRIVATE', s => s.data.viewer.zones[0].daily[0].dimensions.requestHost = 'PRIVATE', s => s.data.viewer.zones[0].daily[0].sum.requests = 1.2, s => s.data.viewer.zones[0].totals[0].uniq.uniques = -1, s => s.data.viewer.zones[0].daily[0].avg.sampleInterval = Infinity, s => s.data.viewer.zones[0].daily[0].dimensions.date = '2026-10-07', s => s.data.viewer.zones[0].daily.push(s.data.viewer.zones[0].daily[0]), s => s.data.viewer.zones[0].daily = Array(31).fill(edgeRow(period.start))]) {
    const s = raw(); edit(s); assert.throws(() => projectCloudflare(s, period, now));
  }
  for (const value of [null, {}, { errors: [{ message: 'PRIVATE' }] }, { ...raw(), errors: 'error' }]) assert.throws(() => projectCloudflare(value, period, now));
});
test('stored strict v2 allowlist and derived coverage enforced; old RUM never reinterpreted', async () => {
  const s = projectCloudflare(raw(), period, now);
  assert.deepEqual(decodeSnapshot(JSON.stringify(s), now), s);
  assert.equal(decodeSnapshot(JSON.stringify(s), new Date('2026-10-08T00:01:00Z')).status, 'stale');
  assert.equal(decodeSnapshot(JSON.stringify({ ...s, status: 'stale' }), now).status, 'stale');
  for (const edit of [v => v.schemaVersion = '1', v => v.token = 'PRIVATE', v => v.source.caveats.push('PRIVATE'), v => v.totals.visits = 10, v => v.coverage.reportedDays = 99, v => v.refreshedAt = 'bad', v => v.refreshedAt = '2026-10-08T00:00:00Z', v => v.period.timezone = 'local', v => v.daily[0].private = 'PRIVATE', v => v.totals.complete = false]) {
    const v = structuredClone(s); edit(v); assert.throws(() => decodeSnapshot(JSON.stringify(v), now));
    assert.equal((await readPublicStats(db(JSON.stringify(v)), now)).status, 'unavailable');
  }
  const old = { schemaVersion: '1', totals: { visits: 11, pageViews: 22 }, source: { dataset: 'rumPageloadEventsAdaptiveGroups' }, private: 'PRIVATE' };
  const migrated = await readPublicStats(db(JSON.stringify(old)), now);
  assert.equal(migrated.schemaVersion, '2'); assert.equal(migrated.refreshedAt, null); assert.equal(migrated.totals.uniqueVisitors, null);
  assert.doesNotMatch(JSON.stringify(migrated), /PRIVATE|pageViews|rumPageload/);
});
test('route response headers; missing/corrupt data unavailable; save rejects private fields before writing', async () => {
  for (const store of [db(), db('broken'), { prepare() { throw Error('PRIVATE'); } }]) assert.equal((await readPublicStats(store, now)).status, 'unavailable');
  const response = publicStatsResponse(projectCloudflare(raw(), period, now));
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*'); assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff'); assert.match(response.headers.get('Content-Type'), /^application\/json/);
  const store = db(); await assert.rejects(savePublicStats(store, { ...projectCloudflare(raw(), period, now), token: 'PRIVATE' }, now)); assert.equal(store.writes, 0);
});
test('readiness fields/retention/page limits checked before totals and daily fetches', async () => {
  validateSettings(edgeSettings());
  for (const change of [{ enabled: false }, { maxDuration: 86400 }, { notOlderThan: 86400 }, { maxPageSize: 30 }, { availableFields: [] }]) {
    const s = edgeSettings(); Object.assign(s.data.viewer.zones[0].settings.httpRequests1dGroups, change); assert.throws(() => validateSettings(s));
    let calls = 0; await assert.rejects(collectPublicStats(fakeSourceEnv, now, async () => { calls++; return Response.json(s); })); assert.equal(calls, 1);
  }
});
test('three server-only queries; no weighting twice; failures retain last-good, old v1 failure unavailable', async () => {
  const store = db(); const requests = []; const env = { DB: store, ...fakeSourceEnv };
  const fetcher = async (_url, init) => { requests.push(JSON.parse(init.body)); assert.equal(init.redirect, 'manual'); return Response.json(sourceResponse(requests.length, raw())); };
  assert.equal(await refreshPublicStats(env, now, fetcher), true); assert.equal(requests.length, 3);
  assert.equal(requests[1].variables.zoneTag, fakeSourceEnv.STATS_CF_ZONE_ID); assert.deepEqual(requests[1].variables, requests[2].variables);
  assert.equal(JSON.parse(store.raw).totals.requests, 100); assert.doesNotMatch(store.raw, /FAKE|accountTag|zoneTag/);
  for (const failed of [async () => { throw Error('PRIVATE'); }, async () => Response.redirect('https://example.invalid', 302), async () => new Response('PRIVATE', { status: 403 }), async () => new Response('not json'), async () => Response.json({ errors: [{}] })]) {
    assert.equal(await refreshPublicStats(env, now, failed), false); const s = await readPublicStats(store, now); assert.equal(s.status, 'stale'); assert.equal(s.totals.requests, 100);
  }
  for (const change of [{ STATS_CF_ZONE_ID: undefined }, { STATS_CF_ZONE_ID: 'PRIVATE' }, { STATS_CF_API_TOKEN: ' bad\n' }, { STATS_CF_ACCOUNT_ID: 'bad' }]) await assert.rejects(collectPublicStats({ ...env, ...change }, now, () => assert.fail('format guard before network')));
  const oldStore = db('{"schemaVersion":"1","totals":{"visits":11}}');
  assert.equal(await refreshPublicStats({ DB: oldStore }, now, fetcher), false); assert.equal((await readPublicStats(oldStore, now)).status, 'unavailable');
});
