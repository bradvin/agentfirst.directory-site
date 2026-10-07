// Entirely synthetic fixtures: these identifiers and measurements are not production data.
export const fakeSourceEnv = { STATS_CF_API_TOKEN: 'FAKE_READ_ONLY_NOT_A_CREDENTIAL', STATS_CF_ACCOUNT_ID: 'a'.repeat(32), STATS_CF_ZONE_ID: 'b'.repeat(32) };
export const edgeSettings = () => ({ data: { viewer: { zones: [{ settings: { httpRequests1dGroups: { enabled: true, availableFields: ['sum_requests', 'uniq_uniques', 'dimensions_date', 'avg_sampleInterval'], maxDuration: 31539600, notOlderThan: 31539600, maxPageSize: 10000 } } }] } } });
export const edgeRow = (date, requests = 42, uniqueVisitors = 3, sampleInterval = 2) => ({ dimensions: { date }, sum: { requests }, uniq: { uniques: uniqueVisitors }, avg: { sampleInterval } });
export const edgeRaw = (rows, requests = rows.reduce((n, r) => n + r.sum.requests, 0), uniqueVisitors = 7) => ({ data: { viewer: { zones: [{ totals: [{ sum: { requests }, uniq: { uniques: uniqueVisitors } }], daily: rows }] } } });
export const aggregateResponse = raw => ({ data: { viewer: { zones: [{ totals: raw.data.viewer.zones[0].totals }] } } });
export const dailyResponse = raw => ({ data: { viewer: { zones: [{ daily: raw.data.viewer.zones[0].daily }] } } });
export const sourceResponse = (call, raw) => call === 1 ? edgeSettings() : call === 2 ? aggregateResponse(raw) : dailyResponse(raw);
