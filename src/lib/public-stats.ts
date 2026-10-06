export const STATS_HOST = "agentfirst.directory";
export const DAY_MS = 86400000;
export const STATS_SOURCE = {
  name: "Cloudflare Web Analytics (browser/RUM)",
  dataset: "rumPageloadEventsAdaptiveGroups",
  metrics: { visits: "sum.visits: page views initiated from another website or direct navigation; not unique users", pageViews: "count: browser-reported page views" },
  caveats: [
    "Visits are not unique users. Browser beacons do not measure all humans or AI agents, and are not HTTP edge request counts.",
    "Blocked scripts, non-browser clients and some bots are not measured. No bot filter is applied.",
    "Adaptive sampling produces extrapolated estimates; counts are not multiplied by sampleInterval again. A sampled zero does not prove no actual traffic.",
    "Absent daily groups are missing measurements, not zero. Partial totals sum only reported dates and are not full-window totals.",
    "Only the exact hostname agentfirst.directory is queried; subdomains and other sites are excluded. Complete UTC dates may still be affected by delayed beacon ingestion.",
  ],
};
export type StatsDay = { date: string; visits: number | null; pageViews: number | null; sampleInterval: number | null };
export type StatsPeriod = { start: string; end: string; timezone: "UTC"; days: 30 };
export type PublicStats = {
  schemaVersion: "1"; status: "fresh" | "stale" | "unavailable"; refreshedAt: string | null;
  period: StatsPeriod; source: typeof STATS_SOURCE;
  coverage: { reportedDays: number; missingDays: number; sampled: boolean };
  totals: { visits: number | null; pageViews: number | null; complete: boolean }; daily: StatsDay[];
};
export function completePeriod(now = new Date()): StatsPeriod {
  const endExclusive = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { start: new Date(endExclusive - 30 * DAY_MS).toISOString().slice(0, 10), end: new Date(endExclusive - DAY_MS).toISOString().slice(0, 10), timezone: "UTC", days: 30 };
}
function dates(period: StatsPeriod): string[] {
  const start = Date.parse(period.start + "T00:00:00Z");
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== period.start || new Date(start + 29 * DAY_MS).toISOString().slice(0, 10) !== period.end) throw new Error("Invalid period");
  return Array.from({ length: 30 }, (_, i) => new Date(start + i * DAY_MS).toISOString().slice(0, 10));
}
function metric(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid metric");
  return value;
}
function interval(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) throw new Error("Invalid sample interval");
  return value;
}
function snapshot(period: StatsPeriod, daily: StatsDay[], refreshedAt: string | null, failed = false, now = new Date()): PublicStats {
  const reported = daily.filter(d => d.visits !== null && d.pageViews !== null);
  const visits = reported.reduce((n, d) => n + d.visits!, 0);
  const pageViews = reported.reduce((n, d) => n + d.pageViews!, 0);
  metric(visits); metric(pageViews);
  const stale = failed || !refreshedAt || now.getTime() - Date.parse(refreshedAt) > 36 * 3600000 || period.end !== completePeriod(now).end;
  return {
    schemaVersion: "1", status: !reported.length ? "unavailable" : stale ? "stale" : "fresh", refreshedAt,
    period: { start: period.start, end: period.end, timezone: "UTC", days: 30 }, source: structuredClone(STATS_SOURCE),
    coverage: { reportedDays: reported.length, missingDays: 30 - reported.length, sampled: reported.some(d => d.sampleInterval! > 1) },
    totals: { visits: reported.length ? visits : null, pageViews: reported.length ? pageViews : null, complete: reported.length === 30 },
    daily,
  };
}
export function unavailableStats(now = new Date()): PublicStats {
  const period = completePeriod(now);
  return snapshot(period, dates(period).map(date => ({ date, visits: null, pageViews: null, sampleInterval: null })), null, false, now);
}
// Only these aggregate fields enter the public snapshot. Never spread upstream objects.
export function projectCloudflare(payload: unknown, period = completePeriod(), now = new Date()): PublicStats {
  const body = payload as any;
  if (!body || (body.errors != null && (!Array.isArray(body.errors) || body.errors.length))) throw new Error("Cloudflare API errors");
  const accounts = body.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1) throw new Error("Invalid account coverage");
  const rows = accounts[0]?.rumPageloadEventsAdaptiveGroups;
  if (!Array.isArray(rows) || rows.length >= 31) throw new Error("Invalid or truncated daily response");
  const allowed = dates(period);
  const byDate = new Map<string, StatsDay>();
  for (const row of rows) {
    const date = row?.dimensions?.date;
    if (row?.dimensions?.requestHost !== STATS_HOST || !allowed.includes(date) || byDate.has(date)) throw new Error("Invalid hostname/date scope");
    byDate.set(date, { date, visits: metric(row.sum?.visits), pageViews: metric(row.pageViews), sampleInterval: interval(row.avg?.sampleInterval) });
  }
  return snapshot(period, allowed.map(date => byDate.get(date) ?? { date, visits: null, pageViews: null, sampleInterval: null }), now.toISOString(), false, now);
}
// Re-project persisted bytes too, so even unexpected storage fields cannot leak publicly.
export function decodeSnapshot(raw: string, now = new Date()): PublicStats {
  const stored = JSON.parse(raw);
  if (stored.schemaVersion !== "1" || !["fresh", "stale", "unavailable"].includes(stored.status)) throw new Error("Invalid snapshot version/status");
  if (stored.refreshedAt !== null && (typeof stored.refreshedAt !== "string" || !Number.isFinite(Date.parse(stored.refreshedAt)) || Date.parse(stored.refreshedAt) > now.getTime())) throw new Error("Invalid refresh time");
  const allowed = dates(stored.period);
  if (stored.period.end > completePeriod(now).end || !Array.isArray(stored.daily) || stored.daily.length !== 30) throw new Error("Invalid snapshot coverage");
  const daily = allowed.map((date, i) => {
    const d = stored.daily[i];
    if (d?.date !== date) throw new Error("Invalid daily date");
    if (d.visits === null && d.pageViews === null && d.sampleInterval === null) return { date, visits: null, pageViews: null, sampleInterval: null };
    return { date, visits: metric(d.visits), pageViews: metric(d.pageViews), sampleInterval: interval(d.sampleInterval) };
  });
  if (daily.some(d => d.visits !== null) && !stored.refreshedAt) throw new Error("Missing refresh time");
  return snapshot(stored.period, daily, stored.refreshedAt, stored.status === "stale", now);
}
export async function readPublicStats(db: D1Database, now = new Date()): Promise<PublicStats> {
  try {
    const row = await db.prepare("SELECT snapshot FROM public_stats WHERE id = 1").first<{ snapshot: string }>();
    return row ? decodeSnapshot(row.snapshot, now) : unavailableStats(now);
  } catch { return unavailableStats(now); }
}
export async function savePublicStats(db: D1Database, value: PublicStats): Promise<void> {
  await db.prepare("INSERT INTO public_stats (id, snapshot) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot").bind(JSON.stringify(value)).run();
}
export function publicStatsResponse(value: PublicStats): Response {
  return Response.json(value, { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" } });
}
