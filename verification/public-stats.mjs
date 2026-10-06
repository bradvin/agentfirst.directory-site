import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4327';
const dir = process.env.STATS_ARTIFACT_DIR;
if (!dir) throw Error('STATS_ARTIFACT_DIR is required (outside repository)');
const response = await fetch(`${base}/stats.json`);
assert.equal(response.status, 200);
assert.match(response.headers.get('content-type'), /^application\/json/);
assert.equal(response.headers.get('access-control-allow-origin'), '*');
assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
const snapshot = await response.json();
assert.equal(snapshot.schemaVersion, '1'); assert.equal(snapshot.daily.length, 30);
assert.doesNotMatch(JSON.stringify(snapshot), /accountTag|siteTag|token|referrer|requestHost|"ip"/);
if (process.env.STATS_EXPECTED_SNAPSHOT) {
  const expected = JSON.parse(readFileSync(process.env.STATS_EXPECTED_SNAPSHOT, 'utf8'));
  for (const key of ['totals','daily','coverage','period','refreshedAt']) assert.deepEqual(snapshot[key], expected[key]);
}
assert.notEqual((await fetch(`${base}/stats.json`, { method:'POST' })).status, 200);
assert.equal((await fetch(`${base}/stats/refresh`)).status, 404);
assert.notEqual((await fetch(`${base}/stats/refresh`, { method:'POST' })).status, 200);
const browser = await chromium.launch({ headless:true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/stats`, { waitUntil:'networkidle' });
  assert.equal(await page.locator('h1').textContent(), 'Website traffic statistics');
  const statusText = { fresh:'Fresh snapshot', stale:'Stale snapshot', unavailable:'Statistics unavailable' }[snapshot.status];
  assert.equal(await page.locator('#snapshot-heading').textContent(), statusText);
  const totals = await page.locator('.stats-estimates dd').allTextContents();
  const format = n => n === null ? 'Unavailable' : new Intl.NumberFormat('en', { maximumFractionDigits:2 }).format(n);
  assert.deepEqual(totals, [format(snapshot.totals.visits), format(snapshot.totals.pageViews)]);
  const rows = page.locator('tbody tr'); assert.equal(await rows.count(), 30);
  for (let i=0; i<30; i++) {
    const d=snapshot.daily[i]; const values=await rows.nth(i).locator('th,td').allTextContents();
    assert.deepEqual(values, [d.date, ...[d.visits,d.pageViews,d.sampleInterval].map(n => n===null ? 'Not reported' : format(n))]);
  }
  assert.equal(await page.locator('tbody th[scope=row]').count(), 30);
  assert.equal(await page.locator('thead th[scope=col]').count(), 4);
  assert.ok((await page.locator('caption').textContent()).includes('UTC'));
  assert.ok(await page.locator('footer a[href="/stats"]').isVisible());
  assert.ok((await page.textContent('main')).includes('Visits are not unique people'));
  assert.ok((await page.textContent('main')).includes('not proof of no actual traffic when sampled'));
  await page.screenshot({ path:`${dir}/stats-desktop.png`, fullPage:true });
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const scroll=page.getByRole('region', {name:'Daily traffic estimates, horizontally scrollable'});
  await scroll.focus(); assert.equal(await scroll.evaluate(el => el===document.activeElement), true);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.stats-table-scroll').scrollLeft > 0);
  await page.screenshot({ path:`${dir}/stats-mobile.png`, fullPage:true });
  assert.deepEqual(errors, []);
  const result={passed:true,status:snapshot.status,period:snapshot.period,coverage:snapshot.coverage,totals:snapshot.totals,refreshedAt:snapshot.refreshedAt,browser:'Chromium',desktop:'1440x1000',mobile:'390x844',rows:30,keyboardScroll:true,noHorizontalPageOverflow:true};
  writeFileSync(`${dir}/stats-browser-result.json`, JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
