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
assert.equal(snapshot.schemaVersion, '2'); assert.equal(snapshot.daily.length, 30);
assert.doesNotMatch(JSON.stringify(snapshot), /accountTag|siteTag|token|referrer|requestHost|"ip"/);
if (process.env.STATS_EXPECTED_SNAPSHOT) {
  const expected = JSON.parse(readFileSync(process.env.STATS_EXPECTED_SNAPSHOT, 'utf8'));
  assert.deepEqual(snapshot, expected); // Full endpoint parity, including sampling and caveats.
}
assert.notEqual((await fetch(`${base}/stats.json`, { method:'POST' })).status, 200);
assert.equal((await fetch(`${base}/stats/refresh`)).status, 404);
assert.notEqual((await fetch(`${base}/stats/refresh`, { method:'POST' })).status, 200);
const browser = await chromium.launch({ headless:true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  // No analytics, third-party requests or page-originated mutations during verification.
  await context.route('**/*', route => {
    const request = route.request();
    return new URL(request.url()).origin === new URL(base).origin && ['GET','HEAD'].includes(request.method()) ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/stats`, { waitUntil:'networkidle' });
  assert.equal(await page.locator('h1').textContent(), 'Website traffic statistics');
  const statusText = { fresh:'Fresh snapshot', stale:'Stale snapshot', unavailable:'Statistics unavailable' }[snapshot.status];
  assert.equal(await page.locator('#snapshot-heading').textContent(), statusText);
  assert.equal(await page.locator('.stats-shell > section').last().getAttribute('aria-labelledby'), 'snapshot-heading');
  const cards = page.locator('.stats-summary-card');
  assert.equal(await cards.count(), 3);
  assert.deepEqual(await cards.locator('h2').allTextContents(), ['Unique visitors','HTTP Requests','Window']);
  const format = n => n === null ? 'Not reported' : new Intl.NumberFormat('en', { maximumFractionDigits:2 }).format(n);
  const date = value => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(value));
  const total = n => snapshot.status === 'unavailable' ? 'Unavailable' : format(n);
  assert.deepEqual(await cards.locator('.stats-value').allTextContents(), [total(snapshot.totals.uniqueVisitors), total(snapshot.totals.requests), 'Last 30 days']);
  const desktopBoxes = await cards.evaluateAll(nodes => nodes.map(el => ({x:el.getBoundingClientRect().x, y:el.getBoundingClientRect().y})));
  assert.equal(new Set(desktopBoxes.map(b => b.y)).size, 1);
  assert.ok(desktopBoxes[0].x < desktopBoxes[1].x && desktopBoxes[1].x < desktopBoxes[2].x);
  const rows = page.locator('tbody tr'); assert.equal(await rows.count(), 30);
  for (let i=0; i<30; i++) {
    const d=[...snapshot.daily].reverse()[i]; const values=await rows.nth(i).locator('th,td').allTextContents();
    assert.deepEqual(values, [date(d.date), format(d.uniqueVisitors), format(d.requests)]);
    assert.equal(await rows.nth(i).locator('time').getAttribute('datetime'), d.date);
  }
  assert.equal(await page.locator('tbody th[scope=row]').count(), 30);
  assert.equal(await page.locator('thead th[scope=col]').count(), 3);
  assert.ok((await page.locator('caption').textContent()).includes('UTC'));
  assert.ok(await page.locator('footer a[href="/stats"]').isVisible());
  const copy = await page.locator('.stats-shell').innerText();
  const visible = await page.locator('body').innerText();
  const meta = await page.locator('meta[name="description"]').getAttribute('content');
  assert.doesNotMatch(visible + meta, /cloudflare|httpRequests1dGroups|uniq\.uniques|sum\.requests|sampleInterval|Sample interval|\bAPI\b|\bzone\b|\bRUM\b|dataset/i);
  assert.doesNotMatch(copy, /—|unsampled|No sampling|real.time/i);
  assert.ok(copy.includes('not an exact count of people'));
  assert.ok(copy.includes('bots and automated traffic'));
  assert.ok(copy.includes('not page views'));
  assert.ok(copy.includes('30 complete days in UTC, not including today'));
  for (const caveat of snapshot.source.caveats) assert.ok(!copy.includes(caveat));
  const sampling = page.locator('.stats-metadata div').filter({has: page.locator('dt', {hasText:/^Sampling$/})}).locator('dd');
  assert.equal(await sampling.locator('p').count(), 1);
  assert.ok((await sampling.innerText()).length < 200);
  const status = page.locator('#snapshot-heading').locator('..');
  assert.deepEqual(await status.locator('time').evaluateAll(nodes => nodes.map(el => el.getAttribute('datetime'))), [snapshot.period.start, snapshot.period.end, ...(snapshot.refreshedAt ? [snapshot.refreshedAt] : [])]);
  assert.ok((await status.innerText()).includes(`${snapshot.coverage.reportedDays} days reported; ${snapshot.coverage.missingDays} days not reported`));
  if (snapshot.status === 'stale') assert.ok((await status.innerText()).includes('may be out of date'));
  if (snapshot.status === 'unavailable') assert.ok((await status.innerText()).includes('Missing figures do not mean zero traffic'));
  assert.equal(await page.locator('.stats-bar-slot').count(), 30);
  assert.equal(await page.locator('.stats-missing').count(), snapshot.coverage.missingDays);
  await page.screenshot({ path:`${dir}/stats-desktop.png`, fullPage:true });
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const mobileBoxes = await cards.evaluateAll(nodes => nodes.map(el => ({x:el.getBoundingClientRect().x, y:el.getBoundingClientRect().y})));
  assert.equal(new Set(mobileBoxes.map(b => b.x)).size, 1);
  assert.ok(mobileBoxes[0].y < mobileBoxes[1].y && mobileBoxes[1].y < mobileBoxes[2].y);
  const scroll=page.getByRole('region', {name:'Daily traffic estimates, horizontally scrollable'});
  assert.equal(await scroll.getAttribute('aria-describedby'), 'daily-help');
  await scroll.focus(); assert.equal(await scroll.evaluate(el => el===document.activeElement), true);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.stats-table-scroll').scrollLeft > 0);
  await page.screenshot({ path:`${dir}/stats-mobile.png`, fullPage:true });
  assert.deepEqual(errors, []);
  const result={passed:true,status:snapshot.status,period:snapshot.period,coverage:snapshot.coverage,refreshedAt:snapshot.refreshedAt,browser:'Chromium',desktop:'1440x1000',mobile:'390x844',rows:30,summaryCards:3,desktopColumns:true,mobileStacking:true,snapshotLast:true,providerFreeCopy:true,samplingParagraphs:1,keyboardScroll:true,noHorizontalPageOverflow:true,jsonParity:!!process.env.STATS_EXPECTED_SNAPSHOT,thirdPartyRequestsBlocked:true};
  writeFileSync(`${dir}/stats-browser-result.json`, JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
