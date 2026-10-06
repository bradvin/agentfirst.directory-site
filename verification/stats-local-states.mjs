import assert from 'node:assert/strict';
import { getPlatformProxy } from 'wrangler';
const base=process.env.BASE_URL ?? 'http://127.0.0.1:4327';
const state=process.env.STATS_LOCAL_STATE;
if (!state || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Explicit LOCAL state and loopback BASE_URL required');
const proxy=await getPlatformProxy({ configPath:'wrangler.jsonc', remoteBindings:false, persist:{ path:`${state}/v3` } });
const db=proxy.env.DB;
const original=await db.prepare('SELECT snapshot FROM public_stats WHERE id=1').first();
const json=async () => (await fetch(`${base}/stats.json`)).json();
try {
  if (original) {
    const before=await json();
    // Wrangler emulator-only trigger. No collector credentials are passed to this server.
    assert.ok((await fetch(`${base}/cdn-cgi/handler/scheduled`)).ok);
    const after=await json();
    assert.equal(after.status, before.coverage.reportedDays ? 'stale' : 'unavailable');
    assert.deepEqual(after.totals,before.totals); assert.deepEqual(after.daily,before.daily); assert.equal(after.refreshedAt,before.refreshedAt);
    assert.match(await (await fetch(`${base}/stats`)).text(), /Stale snapshot|Statistics unavailable/);
  }
  await db.prepare('DELETE FROM public_stats WHERE id=1').run();
  assert.equal((await json()).status,'unavailable'); assert.equal((await json()).totals.visits,null);
  assert.match(await (await fetch(`${base}/stats`)).text(), /Unavailable measurements are not zero traffic/);
  await db.prepare('INSERT INTO public_stats (id,snapshot) VALUES (1,?)').bind('{"private":"must not appear"}').run();
  const invalid=await json(); assert.equal(invalid.status,'unavailable'); assert.doesNotMatch(JSON.stringify(invalid), /private|must not appear/);
  console.log('Local built Worker integration passed: scheduled failure retains last good; unavailable/corrupt storage is null, never zero; no private-field leak.');
} finally {
  await db.prepare('DELETE FROM public_stats WHERE id=1').run();
  if (original) await db.prepare('INSERT INTO public_stats (id,snapshot) VALUES (1,?)').bind(original.snapshot).run();
  await proxy.dispose();
}
