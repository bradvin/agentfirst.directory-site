export const DAY_MS = 86400000;
export const STATS_SOURCE = {
  name: "Cloudflare zone edge analytics",
  dataset: "httpRequests1dGroups",
  scope: "All Cloudflare-proxied traffic in the configured zone; no hostname, bot or eyeball filter",
  metrics: {
    uniqueVisitors: "uniq.uniques: provider unique-visitor aggregate from one no-dimensions query over the full UTC window",
    requests: "sum.requests: provider HTTP request total from the same full-window query",
  },
  caveats: [
    "Unique visitors are Cloudflare's network/IP-based metric, not identifiable unique humans. Bots and crawlers are included; shared or changing IP addresses affect this metric.",
    "The headline preserves the API's full-window uniq.uniques result. The dataset documentation does not establish distinct-IP deduplication across days; do not interpret it as confirmed monthly distinct humans or deduplicated IPs.",
    "Requests include network and asset traffic across the proxied zone, including other proxied hostnames. No bot or eyeball-only filter is applied; this is not a page-view metric.",
    "Daily unique-visitor counts are not additive. Headline totals are queried independently, never computed by summing daily unique visitors.",
    "Daily sampleInterval is provider-reported metadata. Counts are used as returned, never multiplied by this value again. Daily sampling indicators do not establish whether the full-window uniqueness aggregate is sampled.",
    "Missing daily groups are missing measurements, not invented zeros. Full-window totals remain the API aggregate even if daily detail is sparse.",
    "The window contains 30 completed UTC dates; capture time is separate. Refresh runs daily at 03:15 UTC. Completed dates can still be affected by delayed analytics ingestion.",
  ],
};
export type StatsDay = { date: string; uniqueVisitors: number | null; requests: number | null; sampleInterval: number | null };
export type StatsPeriod = { start: string; end: string; timezone: "UTC"; days: 30 };
export type PublicStats = {
  schemaVersion: "2"; status: "fresh" | "stale" | "unavailable"; refreshedAt: string | null;
  period: StatsPeriod; source: typeof STATS_SOURCE;
  coverage: { reportedDays: number; missingDays: number; sampled: boolean };
  totals: { uniqueVisitors: number | null; requests: number | null; complete: boolean }; daily: StatsDay[];
};
export function completePeriod(now = new Date()): StatsPeriod {
  const endExclusive = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { start: new Date(endExclusive - 30 * DAY_MS).toISOString().slice(0, 10), end: new Date(endExclusive - DAY_MS).toISOString().slice(0, 10), timezone: "UTC", days: 30 };
}
export function exactKeys(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !required.every(k => Object.hasOwn(value, k)) || Object.keys(value).some(k => !required.includes(k) && !optional.includes(k))) throw new Error("Invalid analytics shape");
}
function dates(period: StatsPeriod): string[] {
  exactKeys(period, ["start", "end", "timezone", "days"]);
  if (typeof period.start !== "string" || typeof period.end !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(period.start) || !/^\d{4}-\d{2}-\d{2}$/.test(period.end) || period.timezone !== "UTC" || period.days !== 30) throw new Error("Invalid period");
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
// No IDs or raw errors are selected or retained. Reject unexpected fields, not just omit them.
export function zoneResult(payload: unknown, fields: string[]): Record<string, any> {
  exactKeys(payload, ["data"], ["errors"]);
  if (payload.errors != null && (!Array.isArray(payload.errors) || payload.errors.length)) throw new Error("Analytics API errors");
  exactKeys(payload.data, ["viewer"]); exactKeys(payload.data.viewer, ["zones"]);
  const zones = payload.data.viewer.zones;
  if (!Array.isArray(zones) || zones.length !== 1) throw new Error("Invalid zone coverage");
  exactKeys(zones[0], fields);
  return zones[0];
}
function validateRequestCoverage(daily: StatsDay[], total: number) {
  const sum = daily.reduce((n, d) => n + (d.requests ?? 0), 0); metric(sum);
  if (sum > total || (daily.every(d => d.requests !== null) && sum !== total)) throw new Error("Inconsistent request coverage");
}
function snapshot(period: StatsPeriod, daily: StatsDay[], totals: PublicStats["totals"], refreshedAt: string | null, failed = false, now = new Date()): PublicStats {
  const reported = daily.filter(d => d.requests !== null);
  const stale = failed || !refreshedAt || now.getTime() - Date.parse(refreshedAt) > 36 * 3600000 || period.end !== completePeriod(now).end;
  return {
    schemaVersion: "2", status: !totals.complete ? "unavailable" : stale ? "stale" : "fresh", refreshedAt,
    period: { ...period }, source: structuredClone(STATS_SOURCE),
    coverage: { reportedDays: reported.length, missingDays: 30 - reported.length, sampled: reported.some(d => d.sampleInterval! > 1) },
    totals: { ...totals }, daily,
  };
}
export function unavailableStats(now = new Date()): PublicStats {
  const period = completePeriod(now);
  return snapshot(period, dates(period).map(date => ({ date, uniqueVisitors: null, requests: null, sampleInterval: null })), { uniqueVisitors: null, requests: null, complete: false }, null, false, now);
}
export function projectCloudflare(payload: unknown, period = completePeriod(), now = new Date()): PublicStats {
  const zone = zoneResult(payload, ["totals", "daily"]);
  if (!Array.isArray(zone.totals) || zone.totals.length !== 1) throw new Error("Missing full-window aggregate");
  const total = zone.totals[0]; exactKeys(total, ["sum", "uniq"]); exactKeys(total.sum, ["requests"]); exactKeys(total.uniq, ["uniques"]);
  const totals = { uniqueVisitors: metric(total.uniq.uniques), requests: metric(total.sum.requests), complete: true };
  const rows = zone.daily;
  // 31 is a sentinel over the maximum 30 date groups; a full page is never silently accepted.
  if (!Array.isArray(rows) || rows.length >= 31) throw new Error("Invalid or truncated daily response");
  const allowed = dates(period); const byDate = new Map<string, StatsDay>();
  for (const row of rows) {
    exactKeys(row, ["dimensions", "sum", "uniq", "avg"]); exactKeys(row.dimensions, ["date"]);
    exactKeys(row.sum, ["requests"]); exactKeys(row.uniq, ["uniques"]); exactKeys(row.avg, ["sampleInterval"]);
    const date = row.dimensions.date;
    if (!allowed.includes(date) || byDate.has(date)) throw new Error("Invalid date scope");
    byDate.set(date, { date, uniqueVisitors: metric(row.uniq.uniques), requests: metric(row.sum.requests), sampleInterval: interval(row.avg.sampleInterval) });
  }
  const daily = allowed.map(date => byDate.get(date) ?? { date, uniqueVisitors: null, requests: null, sampleInterval: null });
  validateRequestCoverage(daily, totals.requests);
  return snapshot(period, daily, totals, now.toISOString(), false, now);
}
// Breaking v1 RUM data is deliberately unavailable, never relabelled as edge measurements.
export function decodeSnapshot(raw: string, now = new Date()): PublicStats {
  if (typeof raw !== "string" || raw.length > 32768) throw new Error("Invalid snapshot size");
  const stored = JSON.parse(raw);
  exactKeys(stored, ["schemaVersion", "status", "refreshedAt", "period", "source", "coverage", "totals", "daily"]);
  if (stored.schemaVersion !== "2" || !["fresh", "stale", "unavailable"].includes(stored.status) || JSON.stringify(stored.source) !== JSON.stringify(STATS_SOURCE)) throw new Error("Invalid snapshot version/source/status");
  if (stored.refreshedAt !== null && (typeof stored.refreshedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stored.refreshedAt) || !Number.isFinite(Date.parse(stored.refreshedAt)) || new Date(stored.refreshedAt).toISOString() !== stored.refreshedAt || Date.parse(stored.refreshedAt) > now.getTime())) throw new Error("Invalid refresh time");
  const allowed = dates(stored.period);
  if (stored.period.end > completePeriod(now).end || !Array.isArray(stored.daily) || stored.daily.length !== 30) throw new Error("Invalid snapshot coverage");
  const daily = allowed.map((date, i) => {
    const d = stored.daily[i]; exactKeys(d, ["date", "uniqueVisitors", "requests", "sampleInterval"]);
    if (d.date !== date) throw new Error("Invalid daily date");
    if (d.uniqueVisitors === null && d.requests === null && d.sampleInterval === null) return { date, uniqueVisitors: null, requests: null, sampleInterval: null };
    return { date, uniqueVisitors: metric(d.uniqueVisitors), requests: metric(d.requests), sampleInterval: interval(d.sampleInterval) };
  });
  exactKeys(stored.totals, ["uniqueVisitors", "requests", "complete"]);
  const unavailable = stored.totals.complete === false && stored.totals.uniqueVisitors === null && stored.totals.requests === null;
  if (unavailable ? stored.refreshedAt !== null || daily.some(d => d.requests !== null) || stored.status !== "unavailable" : stored.totals.complete !== true || !stored.refreshedAt || stored.status === "unavailable") throw new Error("Invalid totals availability");
  const totals = unavailable ? { uniqueVisitors: null, requests: null, complete: false } : { uniqueVisitors: metric(stored.totals.uniqueVisitors), requests: metric(stored.totals.requests), complete: true };
  if (totals.requests !== null) validateRequestCoverage(daily, totals.requests);
  const projected = snapshot(stored.period, daily, totals, stored.refreshedAt, stored.status === "stale", now);
  if (JSON.stringify(stored.coverage) !== JSON.stringify(projected.coverage)) throw new Error("Invalid coverage");
  return projected;
}
export async function readPublicStats(db: D1Database, now = new Date()): Promise<PublicStats> {
  try {
    const row = await db.prepare("SELECT snapshot FROM public_stats WHERE id = 1").first<{ snapshot: string }>();
    return row ? decodeSnapshot(row.snapshot, now) : unavailableStats(now);
  } catch { return unavailableStats(now); }
}
export async function savePublicStats(db: D1Database, value: PublicStats, now = new Date()): Promise<void> {
  const safe = decodeSnapshot(JSON.stringify(value), now);
  await db.prepare("INSERT INTO public_stats (id, snapshot) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot").bind(JSON.stringify(safe)).run();
}
export function publicStatsResponse(value: PublicStats): Response {
  return Response.json(value, { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" } });
}
