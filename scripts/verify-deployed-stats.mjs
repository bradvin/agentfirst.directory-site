import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { completePeriod, decodeSnapshot } from '../src/lib/public-stats.ts';

// Errors contain only fixed codes, never URLs, response bodies, browser errors or credentials.
class VerificationFailure extends Error {
  constructor(code, propagation = false) {
    super(`Deployed stats verification failed: ${code}`);
    this.name = 'VerificationFailure';
    this.propagation = propagation;
  }
}
const fail = (code, propagation = false) => { throw new VerificationFailure(code, propagation); };
const check = (condition, code, propagation = false) => { if (!condition) fail(code, propagation); };
const equal = (actual, expected, code, propagation = false) => check(isDeepStrictEqual(actual, expected), code, propagation);
const format = value => value === null ? 'Not reported' : new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
const MAX_DURATION_MS = 115_000;
const REQUEST_MS = 8_000;

function canonical(value, now) {
  let decoded;
  try { decoded = decodeSnapshot(JSON.stringify(value), now); }
  catch { fail('snapshot-schema'); }
  // decodeSnapshot reprojects. Compare the ORIGINAL too: reprojection alone hides extra fields.
  equal(value, decoded, 'snapshot-allowlist');
  return decoded;
}
function fresh(value, now) {
  check(value.status === 'fresh', 'snapshot-freshness');
  const age = now.getTime() - Date.parse(value.refreshedAt);
  check(Number.isFinite(age) && age >= 0 && age <= 30 * 60_000, 'snapshot-freshness');
  equal(value.period, completePeriod(now), 'snapshot-window');
}

/** Pure response validation; body is the raw JSON string, not a pre-sanitized projection. */
export function validateStatsResponse({ status, headers, body }, expected, { now = new Date(), kind = 'json' } = {}) {
  check(kind === 'json' || kind === 'html', 'response-kind');
  if (status !== 200) fail('response-status', [404, 502, 503, 504].includes(status));
  let h;
  try { h = new Headers(headers); } catch { fail('response-headers'); }
  equal(h.get('cache-control'), 'public, max-age=300', 'response-cache');
  const mediaType = h.get('content-type')?.split(';')[0].trim().toLowerCase();
  equal(mediaType, kind === 'json' ? 'application/json' : 'text/html', 'response-type');
  if (kind === 'html') return;
  equal(h.get('access-control-allow-origin'), '*', 'response-cors');
  equal(h.get('x-content-type-options')?.toLowerCase(), 'nosniff', 'response-nosniff');
  const wanted = canonical(expected, now);
  fresh(wanted, now);
  let value;
  try { value = JSON.parse(body); } catch { fail('response-json'); }
  const actual = canonical(value, now);
  // A well-formed previous snapshot is a propagation failure, not a privacy/schema failure.
  equal(actual, wanted, 'snapshot-mismatch', true);
  fresh(actual, now);
  return actual;
}

function expectedRender(s) {
  return {
    h1: ['Website traffic statistics'],
    headings: ['Fresh snapshot', 'Traffic reported in this window', `All ${s.period.days} reporting dates`, 'What these numbers mean'],
    statusMessage: 'The latest successful snapshot is current. Freshness does not mean every date has reported data.',
    metadata: [
      ['Reporting window', `${s.period.start} through ${s.period.end} (inclusive), ${s.period.days} complete dates in ${s.period.timezone}`],
      ['Last successful refresh', `${s.refreshedAt} (UTC)`],
      ['Coverage', `${s.coverage.reportedDays} reported dates; ${s.coverage.missingDays} missing dates. ${s.coverage.sampled ? 'Sampled estimates.' : 'No sampling indicated in this snapshot.'}`],
    ],
    times: [s.period.start, s.period.end, s.refreshedAt],
    totalsLabel: s.totals.complete ? 'Reporting-window estimates' : 'Observed estimates (partial coverage)',
    totals: [['Visits', format(s.totals.visits)], ['Page views', format(s.totals.pageViews)]],
    totalsMessage: s.totals.complete
      ? 'Every date has reported data. These are provider estimates, not an exact census of traffic.'
      : 'Observed estimates sum only reported dates. They are not full reporting-window totals; missing dates are not treated as zero.',
    caption: `Daily visits and page-view estimates, ${s.period.start} through ${s.period.end} (UTC)`,
    columns: ['Date (UTC)', 'Visits (estimate)', 'Page views (estimate)', 'Sample interval'],
    rows: s.daily.map(d => ({ values: [d.date, format(d.visits), format(d.pageViews), format(d.sampleInterval)], dateTime: d.date, rowScope: 'row' })),
    source: [
      ['Source', `${s.source.name}, dataset ${s.source.dataset}.`],
      ['Visits', `Provider-defined visits from ${s.source.metrics.visits}. Visits are not unique people or a count of AI agents.`],
      ['Page views', `Browser-reported page-view estimates from ${s.source.metrics.pageViews}, not a count of all HTTP requests.`],
      ['Sampling', 'The sample interval is the provider-reported sampling weight, not a percentage. Sampled values are estimates; we do not multiply them by the interval again.'],
    ],
    caveats: s.source.caveats,
    jsonLinks: ['/stats.json', '/stats.json'],
    dailyHelp: 'Dates are UTC. A reported 0 is the provider’s estimate, not proof of no actual traffic when sampled; “Not reported” means missing data, not zero. On narrow screens, focus the table region and use the arrow keys to scroll.',
    sourceMessage: 'Browser analytics may miss traffic where the analytics script does not run, including some bots, blocked scripts, and non-browser clients. These measurements cannot distinguish human visitors from AI agents.',
  };
}

/** Pure validation of text/attributes extracted from the actual browser DOM. */
export function validateRenderedStats(rendered, expected) {
  equal(rendered, expectedRender(expected), 'browser-snapshot-mismatch', true);
}

async function readRenderedStats(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.stats-shell');
    if (!root) return null;
    const text = node => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const all = selector => [...root.querySelectorAll(selector)];
    const section = id => root.querySelector(`#${id}`)?.closest('section');
    const definitions = node => [...(node?.querySelectorAll('dl > div, .stats-estimates dl') ?? [])].map(d => [text(d.querySelector('dt')), text(d.querySelector('dd'))]);
    return {
      h1: all('h1').map(text), headings: all('h2').map(text),
      statusMessage: text(section('snapshot-heading')?.querySelector('h2 + p')),
      metadata: definitions(section('snapshot-heading')),
      times: [...(section('snapshot-heading')?.querySelectorAll('time') ?? [])].map(t => t.getAttribute('datetime')),
      totalsLabel: text(section('estimates-heading')?.querySelector('.detail-overline')),
      totals: definitions(section('estimates-heading')),
      totalsMessage: text(section('estimates-heading')?.querySelector('.stats-estimates + p')),
      caption: text(root.querySelector('caption')),
      columns: all('thead th[scope="col"]').map(text),
      rows: all('tbody tr').map(row => ({ values: [...row.querySelectorAll('th,td')].map(text), dateTime: row.querySelector('time')?.getAttribute('datetime') ?? null, rowScope: row.querySelector('th')?.getAttribute('scope') ?? null })),
      source: definitions(section('methodology-heading')),
      caveats: all('.stats-caveats li').map(text),
      jsonLinks: all('a[href="/stats.json"]').map(a => a.getAttribute('href')),
      dailyHelp: text(root.querySelector('#daily-help')),
      sourceMessage: text(section('methodology-heading')?.querySelector('dl + p')),
    };
  });
}

async function bounded(action, ms, code) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new VerificationFailure(code)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/** Independent deployed read/browser check. No CLI, logs, screenshots or persisted artifacts. */
export async function verifyDeployedStats(expected, { base = 'https://agentfirst.directory', fetcher = fetch, browserType = chromium } = {}) {
  let browser;
  const deadline = Date.now() + MAX_DURATION_MS;
  const budget = () => {
    const left = deadline - Date.now();
    check(left > 0, 'propagation-timeout');
    return Math.min(REQUEST_MS, left);
  };
  try {
    const wanted = canonical(expected, new Date());
    fresh(wanted, new Date());
    const origin = new URL(base);
    check(['https:', 'http:'].includes(origin.protocol) && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash, 'base-url');
    const url = path => {
      const value = new URL(path, origin);
      value.searchParams.set('__stats_verify', randomUUID());
      return value.href;
    };
    const request = async (path, method = 'GET', body = false) => {
      const controller = new AbortController();
      try {
        return await bounded(async () => {
          const response = await fetcher(url(path), { method, redirect: 'manual', cache: 'no-store', credentials: 'omit', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache', Origin: origin.origin }, signal: controller.signal });
          const result = { status: response.status, headers: response.headers };
          if (body) result.body = await response.text();
          else await response.body?.cancel();
          return result;
        }, budget(), 'request-timeout');
      } finally { controller.abort(); }
    };

    // Deliberate empty-body rejection probes; no credentials or refresh payload are sent.
    // These known paths are mechanically checked, not a claim of exhaustive route discovery.
    const refreshPaths = ['/stats/refresh', '/stats.json/refresh', '/api/stats/refresh', '/api/refresh-stats'];
    // Wrangler's emulator exposes its own scheduled handler even without --test-scheduled.
    // Never invoke that local-only mutation. The fixed production origin MUST reject it.
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) refreshPaths.push('/cdn-cgi/handler/scheduled');
    await Promise.all([
      ...refreshPaths.flatMap(path => ['GET', 'POST'].map(async method => {
        const response = await request(path, method);
        check(method === 'GET' ? response.status === 404 : [404, 405].includes(response.status), 'public-refresh-exposed');
      })),
      ...['/stats', '/stats.json'].map(async path => {
        const response = await request(path, 'POST');
        check([404, 405].includes(response.status), 'public-mutation-exposed');
      }),
    ]);

    // Browser and read timeouts share one deadline. Only propagation mismatches/transient
    // deployment statuses retry; malformed schemas, security headers and exposed writes do not.
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const [json, html] = await Promise.all([request('/stats.json', 'GET', true), request('/stats')]);
        validateStatsResponse(json, wanted);
        validateStatsResponse(html, wanted, { kind: 'html' });
        const timed = action => bounded(action, budget(), 'browser-timeout');
        if (!browser) browser = await timed(() => browserType.launch({ headless: true, timeout: budget() }));
        const context = await timed(() => browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: false, extraHTTPHeaders: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }));
        try {
          // The verifier must not run page-originated mutations or third-party analytics.
          await timed(() => context.route('**/*', route => {
            const request = route.request();
            return new URL(request.url()).origin === origin.origin && ['GET', 'HEAD'].includes(request.method()) ? route.continue() : route.abort();
          }));
          const page = await timed(() => context.newPage());
          page.setDefaultTimeout(budget());
          let pageError = false;
          page.on('pageerror', () => { pageError = true; });
          const response = await timed(() => page.goto(url('/stats'), { waitUntil: 'load', timeout: budget() }));
          check(response && new URL(response.url()).origin === origin.origin && new URL(response.url()).pathname === '/stats', 'browser-navigation');
          validateStatsResponse({ status: response.status(), headers: await timed(() => response.allHeaders()) }, wanted, { kind: 'html' });
          check(await timed(async () => await page.locator('.stats-shell h1').isVisible() && await page.locator('.stats-shell table').isVisible()), 'browser-visibility');
          validateRenderedStats(await timed(() => readRenderedStats(page)), wanted);
          check(!pageError, 'browser-page-error');
        } finally { await bounded(() => context.close(), Math.min(3_000, Math.max(1, deadline - Date.now())), 'browser-cleanup'); }
        return { passed: true };
      } catch (error) {
        if (!(error instanceof VerificationFailure) || !error.propagation) throw error;
        if (attempt === 11 || deadline - Date.now() <= 5_000) fail('propagation-timeout');
        await delay(Math.min(5_000, deadline - Date.now()));
      }
    }
    fail('propagation-timeout');
  } catch (error) {
    if (error instanceof VerificationFailure) throw error;
    fail('execution');
  } finally {
    if (browser) {
      try { await bounded(() => browser.close(), 3_000, 'browser-cleanup'); }
      catch { /* Never expose browser diagnostics, including on cleanup failure. */ }
    }
  }
}
