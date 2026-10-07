import { isDeepStrictEqual } from 'node:util';
import { mkdtempSync, writeFileSync, chmodSync, realpathSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { decodeSnapshot, completePeriod } from '../src/lib/public-stats.ts';

export const PLACEHOLDER_DB = '00000000-0000-0000-0000-000000000000';
const reject = () => { throw new Error('Stats deployment preflight rejected'); };
export function validateCredentials(env) {
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'STATS_CF_API_TOKEN', 'STATS_CF_ACCOUNT_ID']) {
    if (typeof env[key] !== 'string' || !env[key] || env[key] !== env[key].trim() || /[\x00-\x20\x7f]/.test(env[key])) reject();
  }
  if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID) || env.STATS_CF_ACCOUNT_ID !== env.CLOUDFLARE_ACCOUNT_ID ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(env.CLOUDFLARE_D1_DATABASE_ID) ||
      env.CLOUDFLARE_D1_DATABASE_ID === PLACEHOLDER_DB || env.STATS_CF_API_TOKEN === env.CLOUDFLARE_API_TOKEN) reject();
}
export function validateConfig(config, env, { built = false, injected = true } = {}) {
  validateCredentials(env);
  if (config.name !== 'agentfirst-directory' || config.workers_dev !== false || config.preview_urls !== false ||
      (config.account_id !== undefined && config.account_id !== env.CLOUDFLARE_ACCOUNT_ID) ||
      !isDeepStrictEqual(config.routes, [{ pattern: 'agentfirst.directory', custom_domain: true }]) ||
      !isDeepStrictEqual(config.triggers, { crons: ['15 3 * * *'] }) ||
      config.compatibility_date !== '2026-03-17' || !isDeepStrictEqual(config.compatibility_flags, ['nodejs_compat']) ||
      config.main !== (built ? 'entry.mjs' : './src/worker.ts') || config.env !== undefined ||
      !Array.isArray(config.d1_databases) || config.d1_databases.length !== 1) reject();
  const db = config.d1_databases[0];
  if (db.binding !== 'DB' || db.database_name !== 'agentfirst' ||
      db.database_id !== (injected ? env.CLOUDFLARE_D1_DATABASE_ID : PLACEHOLDER_DB) || db.remote === true ||
      (built && db.migrations_dir !== '../../migrations')) reject();
  if (Object.keys(config.vars ?? {}).length || (config.secrets_store_secrets ?? []).length || config.build) reject();
}
export function injectDatabase(config, env) {
  validateConfig(config, env, { injected: false });
  const result = structuredClone(config);
  result.d1_databases[0].database_id = env.CLOUDFLARE_D1_DATABASE_ID;
  validateConfig(result, env);
  return result;
}
export async function validateRemoteDatabase(env, fetcher = fetch, onIdentityFailure = () => {}) {
  validateCredentials(env);
  // Read-only lookup uses precisely the existing deployment account + DB secrets.
  // Match Wrangler's identity lookup: no unrelated size/table/region metrics.
  const fields = new URLSearchParams({ fields: 'uuid,name' });
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.CLOUDFLARE_D1_DATABASE_ID}?${fields}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) reject();
  const body = await response.json();
  const fail = reason => { onIdentityFailure(reason); reject(); };
  if (body?.success !== true) fail('identity-envelope');
  if (body.result?.uuid !== env.CLOUDFLARE_D1_DATABASE_ID) fail('identity-uuid');
  if (body.result?.name !== 'agentfirst') fail('identity-name');
}
export async function validateRemoteWorker(env, fetcher = fetch) {
  validateCredentials(env);
  const read = async path => {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/${path}`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) reject();
    const body = await response.json();
    if (body.success !== true) reject();
    return body.result;
  };
  const settings = await read('scripts/agentfirst-directory/settings');
  const bindings = settings?.bindings?.filter(binding => binding.type === 'd1' && binding.name === 'DB');
  if (bindings?.length !== 1 || bindings[0].id !== env.CLOUDFLARE_D1_DATABASE_ID) reject();
  const domains = await read('domains?hostname=agentfirst.directory');
  const domain = Array.isArray(domains) ? domains.filter(item => item.hostname === 'agentfirst.directory') : [];
  if (domain.length !== 1 || domain[0].service !== 'agentfirst-directory' || domain[0].environment !== 'production') reject();
}
export function validateBootstrapSnapshot(value, now = new Date()) {
  const bytes = JSON.stringify(value);
  if (Buffer.byteLength(bytes) > 32_768) reject();
  const projected = decodeSnapshot(bytes, now);
  // Reject unknown fields, forged totals/source definitions, stale/empty source pulls.
  if (!isDeepStrictEqual(value, projected) || projected.status !== 'fresh' ||
      !isDeepStrictEqual(projected.period, completePeriod(now)) || projected.coverage.reportedDays < 1 ||
      now.getTime() - Date.parse(projected.refreshedAt) > 30 * 60_000) reject();
  return projected;
}
export function bootstrapSql(value, now = new Date()) {
  const safe = JSON.stringify(validateBootstrapSnapshot(value, now)).replaceAll("'", "''");
  return `INSERT INTO public_stats (id, snapshot) VALUES (1, '${safe}') ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot;\n`;
}
export function createPrivateDirectory(runnerTemp, repo = process.cwd()) {
  if (!runnerTemp || !isAbsolute(runnerTemp)) reject();
  const root = realpathSync(runnerTemp);
  const inside = relative(realpathSync(repo), root);
  if (!inside || (!inside.startsWith('..' + '/') && inside !== '..' && !isAbsolute(inside))) reject();
  const directory = mkdtempSync(join(root, 'stats-deploy-'));
  chmodSync(directory, 0o700);
  return directory;
}
export function prepareFiles(directory, snapshot, env, now = new Date()) {
  validateCredentials(env);
  const sql = bootstrapSql(snapshot, now);
  const files = { snapshot: join(directory, 'snapshot.json'), sql: join(directory, 'bootstrap.sql'), secrets: join(directory, 'worker-secrets.json') };
  const values = [JSON.stringify(snapshot), sql, JSON.stringify({ STATS_CF_API_TOKEN: env.STATS_CF_API_TOKEN, STATS_CF_ACCOUNT_ID: env.STATS_CF_ACCOUNT_ID })];
  for (const [i, file] of Object.values(files).entries()) writeFileSync(file, values[i], { mode: 0o600, flag: 'wx' });
  return files;
}
