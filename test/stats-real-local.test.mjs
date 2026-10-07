import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('genuine local replay rejects malformed stdin and arguments without leaking private input', () => {
  const env = { ...process.env, STATS_CF_API_TOKEN: '', STATS_CF_ACCOUNT_ID: '', STATS_CF_ZONE_ID: '' };
  for (const [args, input] of [
    [['--stdin'], '{"PRIVATE_TOKEN":"DO_NOT_ECHO"}'],
    [['--stdin'], 'not JSON DO_NOT_ECHO'],
    [['--stdin'], JSON.stringify({ STATS_CF_API_TOKEN: 'DO_NOT_ECHO', STATS_CF_ACCOUNT_ID: 'invalid', STATS_CF_ZONE_ID: 'invalid' })],
    [['--unapproved-remote'], 'DO_NOT_ECHO'],
  ]) {
    const child = spawnSync(process.execPath, ['verification/stats-real-local.mjs', ...args], { env, input, encoding: 'utf8', timeout: 30000 });
    assert.equal(child.status, 1);
    assert.equal(child.stdout, '');
    assert.equal(child.stderr.trim(), 'Local genuine edge collector verification failed (private diagnostics withheld).');
    assert.doesNotMatch(child.stderr, /DO_NOT_ECHO|PRIVATE_TOKEN|invalid|\/Users\//);
  }
});
