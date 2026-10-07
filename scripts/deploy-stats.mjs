import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { collectPublicStats } from '../src/lib/stats-collector.ts';
import { verifyDeployedStats } from './verify-deployed-stats.mjs';
import { createPreflightReporter } from './stats-preflight-diagnostics.mjs';
import { validateCredentials, validateConfig, injectDatabase, validateRemoteDatabase, validateRemoteWorker, validateBootstrapSnapshot, createPrivateDirectory, prepareFiles } from './stats-deploy-helpers.mjs';

// CLI has no data/path/target arguments. Only the main-push workflow may invoke it.
export async function deployStats({ env = process.env, fetcher = fetch, run = runCommand, verify = verifyDeployedStats } = {}) {
  let directory;
  let phase = 'preflight';
  const reporter = createPreflightReporter(fetcher);
  try {
    if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== 'bradvin/agentfirst.directory-site') throw Error();
    validateCredentials(env);
    const config = injectDatabase(JSON.parse(readFileSync('wrangler.jsonc', 'utf8')), env);
    directory = createPrivateDirectory(env.RUNNER_TEMP);
    // No credential material reaches npm/build processes, config, or the generated bundle.
    const childEnv = { ...env };
    for (const key of Object.keys(childEnv)) if (/TOKEN|SECRET|PASSWORD|STATS_CF|CLOUDFLARE/i.test(key)) delete childEnv[key];
    writeFileSync('wrangler.jsonc', JSON.stringify(config, null, 2) + '\n');
    phase = 'build';
    run('npm', ['run', 'build'], childEnv);
    validateConfig(JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8')), env, { built: true });
    phase = 'source-preflight';
    await validateRemoteDatabase(env, reporter.forGate('remote-database'), reporter.identityFailure);
    await validateRemoteWorker(env, (url, init) => {
      const gate = url.endsWith('/scripts/agentfirst-directory/settings') ? 'remote-worker-bindings' : 'remote-worker-domain';
      return reporter.forGate(gate)(url, init);
    });
    // Same zone settings, whole-window edge aggregate and independent daily detail as scheduled refresh.
    let sourceRequest = 0;
    const collected = await collectPublicStats(env, new Date(), (url, init) => {
      const gate = ++sourceRequest === 1 ? 'source-settings' : 'source-query';
      return reporter.forGate(gate)(url, init);
    });
    phase = 'bootstrap-snapshot';
    const snapshot = validateBootstrapSnapshot(collected);
    const files = prepareFiles(directory, snapshot, env);
    const deployEnv = { ...childEnv, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' };
    // All prerequisites above are read-only. The first production mutation is here.
    phase = 'migration';
    run('./node_modules/.bin/wrangler', ['d1', 'migrations', 'apply', 'DB', '--remote', '--config', 'wrangler.jsonc'], deployEnv);
    phase = 'bootstrap';
    validateBootstrapSnapshot(snapshot);
    validateConfig(JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8')), env, { built: true });
    run('./node_modules/.bin/wrangler', ['d1', 'execute', env.CLOUDFLARE_D1_DATABASE_ID, '--remote', '--config', 'wrangler.jsonc', '--file', files.sql], deployEnv);
    // Read back exact D1 singleton before deploying the matching reviewed code.
    const raw = run('./node_modules/.bin/wrangler', ['d1', 'execute', env.CLOUDFLARE_D1_DATABASE_ID, '--remote', '--config', 'wrangler.jsonc', '--command', 'SELECT snapshot FROM public_stats WHERE id = 1', '--json'], deployEnv);
    const result = JSON.parse(raw);
    if (result.length !== 1 || result[0].results?.length !== 1 || result[0].results[0].snapshot !== JSON.stringify(snapshot)) throw Error();
    phase = 'deploy';
    run('./node_modules/.bin/wrangler', ['deploy', '--config', 'dist/server/wrangler.json', '--secrets-file', files.secrets], deployEnv);
    phase = 'public-verification';
    await verify(snapshot);
    console.log('Deployment and public snapshot verification passed.');
  } catch {
    // Do not print upstream responses, SQL, command output, env, or exception messages.
    const diagnostic = phase === 'source-preflight' ? reporter.summary() : undefined;
    throw new Error(`Stats deployment failed at ${diagnostic ?? `${phase}; inspect reviewed workflow gates (no sensitive diagnostics emitted).`}`);
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}
function runCommand(command, args, env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0 || result.error) throw Error('Deployment command failed');
  return result.stdout;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) { console.error('Stats deployment accepts no arguments.'); process.exitCode = 1; }
  else await deployStats().catch(error => { console.error(error.message); process.exitCode = 1; });
}
