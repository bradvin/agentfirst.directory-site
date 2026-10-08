// Built LOCAL Worker only. Entirely synthetic measurements; no source queries or credentials.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, chmodSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'node:net';
import { getPlatformProxy } from 'wrangler';
import { chromium } from 'playwright';
import { completePeriod, projectCloudflare, unavailableStats } from '../src/lib/public-stats.ts';
import { edgeRaw, edgeRow } from '../test/fixtures/edge-stats.mjs';

const directory = mkdtempSync(join(tmpdir(), 'agentfirst-popup-'));
chmodSync(directory, 0o700);
const state = join(directory, 'state');
const artifacts = resolve(process.env.STATS_ARTIFACT_DIR ?? join(directory, 'evidence'));
assert.ok(relative(process.cwd(), artifacts).startsWith('..'), 'Evidence must be outside the public repository');
mkdirSync(artifacts, { recursive: true, mode: 0o700 });
const childEnv = { ...process.env, WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false' };
for (const key of Object.keys(childEnv)) if (/TOKEN|SECRET|PASSWORD|STATS_CF|CLOUDFLARE/i.test(key)) delete childEnv[key];
const now = new Date();
const dates = unavailableStats(now).daily.map(day => day.date);
const synthetic = (complete = false) => projectCloudflare(edgeRaw(dates.flatMap((date, i) =>
  !complete && [1, 15].includes(i) ? [] : [edgeRow(date, i === 0 ? 0 : 10000 + i * 123, i === 0 ? 0 : 1234 + i, 1)]
)), completePeriod(now), now);
const partial = synthetic();
const count = value => value === null ? 'Not reported' : value.toLocaleString('en-US');
const human = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
let server, proxy, browser, context, page, base;
const errors = [];
const evidence = { fixture: 'SYNTHETIC, not production measurements', desktop: [], mobile: [], states: [], thirdPartyRequestsBlocked: true };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const targets = () => page.locator('.stats-day-target');
const tooltip = () => page.locator('[role="tooltip"]:visible');
async function load(snapshot, { absent = false } = {}) {
  await proxy.env.DB.prepare('DELETE FROM public_stats WHERE id=1').run();
  if (!absent) await proxy.env.DB.prepare('INSERT INTO public_stats (id,snapshot) VALUES (1,?)').bind(JSON.stringify(snapshot)).run();
  await page.goto(`${base}/stats`, { waitUntil: 'networkidle' });
}
async function agreement(snapshot) {
  const actual = await (await fetch(`${base}/stats.json`)).json();
  assert.deepEqual(actual, snapshot, 'Complete JSON matches same stored snapshot, including chronological daily data');
  const rows = await page.locator('tbody tr').evaluateAll(rows => rows.map(row => ({
    date: row.querySelector('time').dateTime,
    values: [...row.querySelectorAll('td')].map(cell => cell.textContent.trim())
  })));
  assert.deepEqual(rows, [...snapshot.daily].reverse().map(day => ({ date: day.date, values: [count(day.uniqueVisitors), count(day.requests)] })));
  assert.equal(await page.locator('.stats-summary-card').count(), 3);
  assert.equal(await page.locator('.stats-shell > section').last().getAttribute('aria-labelledby'), 'snapshot-heading');
  assert.equal(await page.locator('.stats-metadata dt').filter({ hasText: /^Sampling$/ }).count(), 1);
}
async function popup(index, mode = 'hover') {
  const target = targets().nth(index);
  await target.scrollIntoViewIfNeeded();
  if (mode === 'focus') await target.focus(); else await target.hover();
  await tooltip().waitFor({ timeout: 2000 });
}
async function popupAgreement(snapshot, index) {
  const day = snapshot.daily[index];
  const tip = tooltip();
  assert.equal(await tip.count(), 1, 'Only one popup');
  assert.equal((await tip.locator('time').textContent()).trim(), human(day.date));
  assert.equal(await tip.locator('time').getAttribute('datetime'), day.date);
  assert.deepEqual(await tip.locator('dt').allTextContents(), ['Unique visitors', 'HTTP requests']);
  assert.deepEqual(await tip.locator('dd').allTextContents(), [count(day.uniqueVisitors), count(day.requests)]);
  assert.equal(await targets().nth(index).getAttribute('aria-describedby'), await tip.getAttribute('id'));
  const dateColor = await tip.locator('time').evaluate(node => {
    const probe = document.createElement('span'); probe.style.color = 'var(--accent)'; document.body.append(probe);
    const match = getComputedStyle(node).color === getComputedStyle(probe).color; probe.remove(); return match;
  });
  assert.ok(dateColor, 'Popup date uses site green accent');
  const box = await tip.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box.x >= 7 && box.y >= 7 && box.x + box.width <= viewport.width - 7 && box.y + box.height <= viewport.height - 7, 'Popup fits viewport without clipping');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
}
try {
  const migrate = spawnSync('./node_modules/.bin/wrangler', ['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], { env: childEnv, encoding: 'utf8', timeout: 120000 });
  assert.equal(migrate.status, 0, 'Local migrations succeed');
  proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', remoteBindings: false, persist: { path: `${state}/v3` } });
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn('./node_modules/.bin/wrangler', ['dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', state, '--host', '127.0.0.1', '--ip', '127.0.0.1', '--port', String(port)], { env: childEnv, stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch(`${base}/stats`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    assert.equal(server.exitCode, null, 'Worker stays running');
    await pause(250);
  }
  assert.ok(ready, 'Fresh production-built Worker ready');
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(2500);
  await load(partial);

  await test('table reverses all 30 dates and values without changing complete JSON', async () => {
    await agreement(partial);
  });
  await test('chart stays chronological; full-height focusable targets include missing and zero dates', async () => {
    assert.deepEqual(await page.locator('.stats-bar-slot').evaluateAll(slots => slots.map(slot => slot.dataset.date)), dates);
    assert.equal(await targets().count(), 30);
    for (const i of [0, 1, 15, 29]) {
      const target = targets().nth(i);
      assert.equal(await target.evaluate(node => node.closest('[aria-hidden="true"]')), null, 'No hidden focusable descendant');
      assert.equal(await target.getAttribute('aria-label'), `${human(dates[i])}: Unique visitors ${count(partial.daily[i].uniqueVisitors)}; HTTP requests ${count(partial.daily[i].requests)}`);
      const box = await target.boundingBox(); const chart = await page.locator('.stats-bars').boundingBox();
      assert.ok(box.height >= chart.height - 2, 'Full chart-height hit area');
    }
  });
  await test('hover first/middle/last, missing and measured zero; popup stays visible on pointer transit', async () => {
    for (const i of [0, 1, 15, 29]) {
      await popup(i); await popupAgreement(partial, i);
      await tooltip().hover(); await pause(250); await popupAgreement(partial, i);
      if ([0, 15, 29].includes(i)) {
        const path = join(artifacts, `popup-desktop-day-${i}.png`);
        await page.screenshot({ path, fullPage: true }); evidence.desktop.push(path);
      }
      await page.mouse.move(0, 0); await tooltip().waitFor({ state: 'hidden' });
    }
  });
  await test('focus/arrow navigation, Escape, blur and keyboard table scrolling', async () => {
    await page.mouse.move(0, 0);
    await popup(0, 'focus'); await popupAgreement(partial, 0);
    assert.ok(await targets().nth(0).evaluate(node => getComputedStyle(node).outlineStyle !== 'none'), 'Visible focus ring');
    await page.keyboard.press('ArrowRight'); await popupAgreement(partial, 1);
    await page.keyboard.press('End'); await popupAgreement(partial, 29);
    await page.keyboard.press('Home'); await popupAgreement(partial, 0);
    await page.keyboard.press('Escape'); assert.equal(await tooltip().count(), 0);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.stats-table-scroll').evaluate(node => node === document.activeElement), true, 'Tab reaches accessible table fallback');
    assert.equal(await tooltip().count(), 0);
    await popup(15, 'focus'); await page.locator('.stats-table-scroll').focus();
    await tooltip().waitFor({ state: 'hidden' });
  });
  await test('mobile touch toggles and outside/Escape dismiss; edge placement and table scroll do not overflow', async () => {
    await context.close();
    context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    page = await context.newPage(); page.setDefaultTimeout(2500);
    page.on('pageerror', error => errors.push(error.message));
    await load(partial); await agreement(partial);
    for (const i of [0, 15, 29]) {
      await targets().nth(i).tap(); await popupAgreement(partial, i);
      await tooltip().tap(); await popupAgreement(partial, i);
      const path = join(artifacts, `popup-mobile-day-${i}.png`);
      await page.screenshot({ path, fullPage: true }); evidence.mobile.push(path);
      await targets().nth(i).tap(); assert.equal(await tooltip().count(), 0, 'Second tap dismisses');
    }
    await targets().nth(0).tap(); await page.locator('#daily-heading').tap(); assert.equal(await tooltip().count(), 0, 'Outside tap dismisses');
    await targets().nth(29).tap(); await page.keyboard.press('Escape'); assert.equal(await tooltip().count(), 0);
    await page.locator('.stats-table-scroll').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.stats-table-scroll').scrollLeft > 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const path = join(artifacts, 'mobile-table-scroll.png'); await page.screenshot({ path, fullPage: true }); evidence.mobile.push(path);
    await page.setViewportSize({ width: 390, height: 844 });
    await targets().nth(29).tap(); await popupAgreement(partial, 29);
  });
  await test('complete, stale, partial and unavailable keep exact states and JSON; interactions do not fetch stats', async () => {
    for (const snapshot of [synthetic(true), { ...partial, status: 'stale' }, unavailableStats(now)]) {
      await load(snapshot); await agreement(snapshot);
      const requested = [];
      const listener = request => requested.push(request.url()); page.on('request', listener);
      await targets().nth(15).tap(); await popupAgreement(snapshot, 15);
      await page.keyboard.press('Escape'); await pause(150);
      page.off('request', listener);
      assert.deepEqual(requested, [], 'Interactions use stored rendering; no network query');
      assert.equal(await page.locator('#snapshot-heading').textContent().then(s => s.trim()), snapshot.status === 'fresh' ? 'Fresh snapshot' : snapshot.status === 'stale' ? 'Stale snapshot' : 'Statistics unavailable');
      await agreement(snapshot);
      assert.equal((await proxy.env.DB.prepare('SELECT snapshot FROM public_stats WHERE id=1').first()).snapshot, JSON.stringify(snapshot), 'Stored snapshot remains unchanged');
      evidence.states.push(snapshot.status);
    }
    assert.deepEqual(errors, [], 'No browser script errors');
  });
  writeFileSync(join(artifacts, 'popup-browser-evidence.json'), JSON.stringify(evidence, null, 2), { mode: 0o600 });
} finally {
  await browser?.close();
  await proxy?.dispose();
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
  rmSync(directory, { recursive: true, force: true });
}
