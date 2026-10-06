import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completePeriod, projectCloudflare, decodeSnapshot, unavailableStats, readPublicStats, publicStatsResponse } from '../src/lib/public-stats.ts';
import { STATS_QUERY, statsVariables, validateSettings, refreshPublicStats } from '../src/lib/stats-collector.ts';
const now = new Date('2026-10-06T12:00:00Z');
const period = completePeriod(now);
const row = (date = '2026-10-05') => ({ dimensions: { date, requestHost: 'agentfirst.directory', siteTag: 'PRIVATE', ip: 'PRIVATE' }, pageViews: 100, sum: { visits: 0 }, avg: { sampleInterval: 100 }, referrer: 'PRIVATE' });
const raw = (rows = [row()]) => ({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: rows, accountTag: 'PRIVATE' }] } }, errors: null, token: 'PRIVATE' });
const settings = () => ({ data: { viewer: { accounts: [{ settings: { rumPageloadEventsAdaptiveGroups: { enabled: true, availableFields: ['count','sum_visits','avg_sampleInterval','dimensions_date','dimensions_requestHost'], maxDuration: 8035200, notOlderThan: 15897600, maxPageSize: 10000 } } }] } } });
function db(initial) {
  return { raw: initial, prepare(_sql) { return { bind: value => ({ run: async () => { this.raw = value; } }), first: async () => this.raw ? { snapshot: this.raw } : null, run: async () => { if (this.raw) this.raw = JSON.stringify({ ...JSON.parse(this.raw), status: 'stale' }); } }; } };
}
test('last 30 complete UTC dates, including month/year/leap boundaries', () => {
  assert.deepEqual(period, { start: '2026-09-06', end: '2026-10-05', timezone: 'UTC', days: 30 });
  assert.equal(completePeriod(new Date('2024-03-01T23:59:59Z')).end, '2024-02-29');
  assert.equal(completePeriod(new Date('2027-01-01T00:00:00Z')).end, '2026-12-31');
  assert.deepEqual(statsVariables('a'.repeat(32), now).filter, { datetime_geq: '2026-09-06T00:00:00.000Z', datetime_lt: '2026-10-06T00:00:00.000Z', requestHost: 'agentfirst.directory' });
  assert.match(STATS_QUERY, /limit: 31/); assert.doesNotMatch(STATS_QUERY, /httpRequests/);
});
test('real-shaped sampled sparse projection allowlists metrics and does not invent zero', () => {
  const s = projectCloudflare(raw(), period, now);
  assert.equal(s.status, 'fresh'); assert.equal(s.daily.length, 30);
  assert.equal(s.daily[0].visits, null); assert.equal(s.daily[29].pageViews, 100);
  assert.deepEqual(s.totals, { visits: 0, pageViews: 100, complete: false });
  assert.deepEqual(s.coverage, { reportedDays: 1, missingDays: 29, sampled: true });
  assert.doesNotMatch(JSON.stringify(s), /PRIVATE|accountTag|siteTag|referrer|token|"ip"/);
});
test('empty observations unavailable with null totals; all-date observed zeros remain measured', () => {
  assert.equal(projectCloudflare(raw([]), period, now).totals.visits, null);
  const days = unavailableStats(now).daily.map(d => ({ ...row(d.date), pageViews: 0, avg: { sampleInterval: 1 } }));
  assert.deepEqual(projectCloudflare(raw(days), period, now).totals, { visits: 0, pageViews: 0, complete: true });
});
test('reject other hosts/subdomains, incomplete/outside dates, duplicate/truncated/malformed data and API errors', () => {
  for (const change of [ { dimensions: { date: '2026-10-05', requestHost: 'other.example' } }, { dimensions: { date: '2026-10-05', requestHost: 'www.agentfirst.directory' } }, { dimensions: { date: '2026-10-06', requestHost: 'agentfirst.directory' } }, { pageViews: -1 }, { pageViews: '100' }, { pageViews: 1.2 }, { avg: { sampleInterval: 0 } }, { sum: null } ]) assert.throws(() => projectCloudflare(raw([{ ...row(), ...change }]), period, now));
  for (const body of [ null, {}, { errors: [{ message: 'PRIVATE' }] }, { errors: 'error' }, raw([row(), row()]), raw(Array(31).fill(row())) ]) assert.throws(() => projectCloudflare(body, period, now));
});
test('persisted projection is sanitized, totals recomputed, staleness/time/date validity enforced', () => {
  const s = projectCloudflare(raw(), period, now); s.token = 'PRIVATE'; s.source.caveats.push('PRIVATE'); s.totals.pageViews = 999;
  const clean = decodeSnapshot(JSON.stringify(s), now);
  assert.equal(clean.totals.pageViews, 100); assert.doesNotMatch(JSON.stringify(clean), /PRIVATE/);
  assert.equal(decodeSnapshot(JSON.stringify(s), new Date('2026-10-07T00:01:00Z')).status, 'stale');
  assert.equal(decodeSnapshot(JSON.stringify({ ...s, status: 'stale' }), now).status, 'stale');
  assert.throws(() => decodeSnapshot(JSON.stringify({ ...s, refreshedAt: 'bad' }), now));
  assert.throws(() => decodeSnapshot(JSON.stringify({ ...s, refreshedAt: '2026-10-07T00:00:00Z' }), now));
  assert.throws(() => decodeSnapshot(JSON.stringify({ ...s, period: { start: '2026-02-30', end: '2026-03-31' } }), now));
});
test('public response JSON/cache/CORS, missing/corrupt/unavailable storage honest', async () => {
  for (const store of [ db(), db('broken'), { prepare() { throw Error('PRIVATE'); } } ]) {
    const s = await readPublicStats(store, now); assert.equal(s.status, 'unavailable'); assert.equal(s.totals.pageViews, null);
  }
  const response = publicStatsResponse(projectCloudflare(raw(), period, now));
  assert.match(response.headers.get('Content-Type'), /^application\/json/); assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300'); assert.equal((await response.json()).totals.pageViews, 100);
});
test('settings require permission, fields and full-window retention/limits', () => {
  validateSettings(settings());
  for (const change of [{ enabled: false }, { maxDuration: 86400 }, { notOlderThan: 86400 }, { maxPageSize: 30 }, { availableFields: [] }]) {
    const body = settings(); Object.assign(body.data.viewer.accounts[0].settings.rumPageloadEventsAdaptiveGroups, change); assert.throws(() => validateSettings(body));
  }
});
test('collector uses two server-side fetches, saves only projection, failures preserve last good and mark stale', async () => {
  const store = db(); const requests = [];
  const env = { DB: store, STATS_CF_ACCOUNT_ID: 'a'.repeat(32), STATS_CF_API_TOKEN: 'PRIVATE' };
  const fetcher = async (_url, init) => { requests.push(JSON.parse(init.body)); return Response.json(requests.length === 1 ? settings() : raw()); };
  assert.equal(await refreshPublicStats(env, now, fetcher), true); assert.equal(requests.length, 2); assert.equal(requests[1].variables.filter.requestHost, 'agentfirst.directory'); assert.doesNotMatch(store.raw, /PRIVATE/);
  for (const fetcher of [async () => { throw Error('PRIVATE'); }, async () => new Response('bad', { status: 403 }), async () => new Response('not json'), async () => Response.json({ errors: [{}] })]) {
    assert.equal(await refreshPublicStats(env, now, fetcher), false); const s = await readPublicStats(store, now); assert.equal(s.status, 'stale'); assert.equal(s.totals.pageViews, 100);
  }
  assert.equal(await refreshPublicStats({ DB: db() }, now, fetcher), false);
});
