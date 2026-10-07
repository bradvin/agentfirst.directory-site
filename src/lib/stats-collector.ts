import { completePeriod, projectCloudflare, savePublicStats, zoneResult, exactKeys } from "./public-stats.ts";

export interface StatsCollectorEnv { DB: D1Database; STATS_CF_ACCOUNT_ID?: string; STATS_CF_ZONE_ID?: string; STATS_CF_API_TOKEN?: string }
export const SETTINGS_QUERY = `query EdgeSettings($zoneTag: string) {
  viewer { zones(filter: {zoneTag: $zoneTag}) { settings {
    httpRequests1dGroups { enabled availableFields maxDuration maxPageSize notOlderThan }
  } } }
}`;
// One whole-window query, no dimensions. Never sum daily unique visitors.
export const STATS_QUERY = `query EdgeTotals($zoneTag: string, $from: Date, $to: Date) {
  viewer { zones(filter: {zoneTag: $zoneTag}) {
    totals: httpRequests1dGroups(limit: 1, filter: {date_geq: $from, date_lt: $to}) {
      sum { requests } uniq { uniques }
    }
  } }
}`;
export const DAILY_QUERY = `query EdgeDaily($zoneTag: string, $from: Date, $to: Date) {
  viewer { zones(filter: {zoneTag: $zoneTag}) {
    daily: httpRequests1dGroups(limit: 31, filter: {date_geq: $from, date_lt: $to}, orderBy: [date_ASC]) {
      dimensions { date } sum { requests } uniq { uniques } avg { sampleInterval }
    }
  } }
}`;
export function statsVariables(zoneTag: string, now = new Date()) {
  const period = completePeriod(now);
  const to = new Date(Date.parse(period.end + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  return { zoneTag, from: period.start, to };
}
export function validateSettings(payload: unknown) {
  const zone = zoneResult(payload, ["settings"]); exactKeys(zone.settings, ["httpRequests1dGroups"]);
  const s = zone.settings.httpRequests1dGroups;
  exactKeys(s, ["enabled", "availableFields", "maxDuration", "notOlderThan", "maxPageSize"]);
  const fields = ["sum_requests", "uniq_uniques", "avg_sampleInterval", "dimensions_date"];
  if (s.enabled !== true || !Array.isArray(s.availableFields) || !s.availableFields.every((f: unknown) => typeof f === "string") || !fields.every(f => s.availableFields.includes(f)) ||
      !Number.isFinite(s.maxDuration) || s.maxDuration < 30 * 86400 ||
      !Number.isFinite(s.notOlderThan) || s.notOlderThan < 30 * 86400 ||
      !Number.isFinite(s.maxPageSize) || s.maxPageSize < 31) throw new Error("Required analytics coverage unavailable");
}
async function graphql(token: string, query: string, variables: unknown, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    // workerd does not support redirect:"error". Manual never forwards credentials;
    // all redirects fail the success-status gate below in Node and Workers alike.
    body: JSON.stringify({ query, variables }), redirect: "manual", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Analytics HTTP failure");
  return response.json();
}
// Analytics access alone does not prove zone ownership. Deployment separately pins source
// account equality to the unchanged Worker account; never escalate Zone Read permissions.
export async function collectPublicStats(env: Pick<StatsCollectorEnv, "STATS_CF_ACCOUNT_ID" | "STATS_CF_ZONE_ID" | "STATS_CF_API_TOKEN">, now = new Date(), fetcher: typeof fetch = fetch) {
  if (typeof env.STATS_CF_API_TOKEN !== "string" || !env.STATS_CF_API_TOKEN || /[\x00-\x20\x7f]/.test(env.STATS_CF_API_TOKEN) ||
      typeof env.STATS_CF_ACCOUNT_ID !== "string" || !/^[a-f0-9]{32}$/.test(env.STATS_CF_ACCOUNT_ID) ||
      typeof env.STATS_CF_ZONE_ID !== "string" || !/^[a-f0-9]{32}$/.test(env.STATS_CF_ZONE_ID)) throw new Error("Analytics credentials unavailable");
  validateSettings(await graphql(env.STATS_CF_API_TOKEN, SETTINGS_QUERY, { zoneTag: env.STATS_CF_ZONE_ID }, fetcher));
  const variables = statsVariables(env.STATS_CF_ZONE_ID, now);
  const aggregate = zoneResult(await graphql(env.STATS_CF_API_TOKEN, STATS_QUERY, variables, fetcher), ["totals"]);
  const detail = zoneResult(await graphql(env.STATS_CF_API_TOKEN, DAILY_QUERY, variables, fetcher), ["daily"]);
  return projectCloudflare({ data: { viewer: { zones: [{ totals: aggregate.totals, daily: detail.daily }] } } }, completePeriod(now), now);
}
export async function refreshPublicStats(env: StatsCollectorEnv, now = new Date(), fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    await savePublicStats(env.DB, await collectPublicStats(env, now, fetcher), now);
    return true;
  } catch {
    // Do not log upstream errors, tokens, variables or raw payloads. Preserve all last-good values.
    await env.DB.prepare("UPDATE public_stats SET snapshot = json_set(snapshot, '$.status', 'stale') WHERE id = 1").run().catch(() => undefined);
    console.warn("Public stats refresh failed; last successful snapshot retained if present.");
    return false;
  }
}
