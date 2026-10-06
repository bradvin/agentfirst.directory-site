import { completePeriod, projectCloudflare, savePublicStats } from "./public-stats.ts";

export interface StatsCollectorEnv { DB: D1Database; STATS_CF_ACCOUNT_ID?: string; STATS_CF_API_TOKEN?: string }
export const SETTINGS_QUERY = `query StatsSettings($accountTag: string) {
  viewer { accounts(filter: {accountTag: $accountTag}) { settings {
    rumPageloadEventsAdaptiveGroups { enabled availableFields maxDuration maxPageSize notOlderThan }
  } } }
}`;
export const STATS_QUERY = `query PublicStats($accountTag: string, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
  viewer { accounts(filter: {accountTag: $accountTag}) {
    rumPageloadEventsAdaptiveGroups(limit: 31, filter: $filter, orderBy: [date_ASC]) {
      dimensions { date requestHost } pageViews: count sum { visits } avg { sampleInterval }
    }
  } }
}`;
export function statsVariables(accountTag: string, now = new Date()) {
  const period = completePeriod(now);
  const end = new Date(Date.parse(period.end + "T00:00:00Z") + 86400000).toISOString();
  return { accountTag, filter: { datetime_geq: period.start + "T00:00:00.000Z", datetime_lt: end, requestHost: "agentfirst.directory" } };
}
export function validateSettings(payload: unknown) {
  const body = payload as any;
  if (!body || (body.errors != null && (!Array.isArray(body.errors) || body.errors.length))) throw new Error("Analytics settings unavailable");
  const accounts = body.data?.viewer?.accounts;
  const s = accounts?.[0]?.settings?.rumPageloadEventsAdaptiveGroups;
  const fields = ["count", "sum_visits", "avg_sampleInterval", "dimensions_date", "dimensions_requestHost"];
  if (!Array.isArray(accounts) || accounts.length !== 1 || s?.enabled !== true ||
      !Array.isArray(s.availableFields) || !fields.every(f => s.availableFields.includes(f)) ||
      !Number.isFinite(s.maxDuration) || s.maxDuration < 30 * 86400 ||
      !Number.isFinite(s.notOlderThan) || s.notOlderThan < 30 * 86400 ||
      !Number.isFinite(s.maxPageSize) || s.maxPageSize < 31) throw new Error("Required analytics coverage unavailable");
}
async function graphql(token: string, query: string, variables: unknown, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }), redirect: "error", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Analytics HTTP failure");
  return response.json();
}
// Shared read-only source path: deployment preflight must throw, never write fallback data.
export async function collectPublicStats(env: Pick<StatsCollectorEnv, "STATS_CF_ACCOUNT_ID" | "STATS_CF_API_TOKEN">, now = new Date(), fetcher: typeof fetch = fetch) {
  if (!env.STATS_CF_API_TOKEN || !env.STATS_CF_ACCOUNT_ID || !/^[a-f0-9]{32}$/.test(env.STATS_CF_ACCOUNT_ID)) throw new Error("Analytics credentials unavailable");
  validateSettings(await graphql(env.STATS_CF_API_TOKEN, SETTINGS_QUERY, { accountTag: env.STATS_CF_ACCOUNT_ID }, fetcher));
  const raw = await graphql(env.STATS_CF_API_TOKEN, STATS_QUERY, statsVariables(env.STATS_CF_ACCOUNT_ID, now), fetcher);
  return projectCloudflare(raw, completePeriod(now), now);
}
export async function refreshPublicStats(env: StatsCollectorEnv, now = new Date(), fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    await savePublicStats(env.DB, await collectPublicStats(env, now, fetcher));
    return true;
  } catch {
    // Do not log upstream errors, tokens, variables or raw payloads. Preserve all last-good values.
    await env.DB.prepare("UPDATE public_stats SET snapshot = json_set(snapshot, '$.status', 'stale') WHERE id = 1").run().catch(() => undefined);
    console.warn("Public stats refresh failed; last successful snapshot retained if present.");
    return false;
  }
}
