import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { transform } from '@astrojs/compiler-rs';
import ts from 'typescript';
import * as runtime from 'astro/runtime/server/index.js';
import { chromium } from 'playwright';
import { completePeriod, projectCloudflare, publicStatsResponse, unavailableStats } from '../src/lib/public-stats.ts';
import { validateStatsResponse, validateRenderedStats, verifyDeployedStats } from '../scripts/verify-deployed-stats.mjs';

const now = new Date('2026-10-06T12:00:00.000Z');
// Explicit synthetic fixtures, never deployment/source measurements.
function fixture(at = now, complete = false) {
  const period = completePeriod(at);
  const dates = unavailableStats(at).daily.map(d => d.date);
  const rows = (complete ? dates : [dates[0], dates.at(-1)]).map((date, i) => ({
    dimensions: { date, requestHost: 'agentfirst.directory' },
    sum: { visits: i === 0 ? 0 : 1234 }, pageViews: 5678 + i,
    avg: { sampleInterval: complete ? 1 : 100.125 },
  }));
  return projectCloudflare({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: rows }] } } }, period, at);
}
function response(value = fixture(), changes = {}) {
  return { status: 200, headers: publicStatsResponse(value).headers, body: JSON.stringify(value), ...changes };
}
const rejected = (fn, code) => assert.throws(fn, error => {
  assert.equal(error.message, `Deployed stats verification failed: ${code}`);
  assert.equal(error.cause, undefined);
  return true;
});

test('JSON verifier checks full canonical sparse/sampled and complete snapshots', () => {
  for (const value of [fixture(), fixture(now, true)]) {
    assert.deepEqual(validateStatsResponse(response(value), value, { now }), value);
    assert.equal(validateStatsResponse({ status: 200, headers: { 'cache-control': 'public, max-age=300', 'content-type': 'text/html; charset=utf-8' } }, value, { now, kind: 'html' }), undefined);
  }
});

test('status, JSON/HTML content types, CORS, exact cache and nosniff are mandatory', () => {
  const value = fixture();
  rejected(() => validateStatsResponse(response(value, { status: 201 }), value, { now }), 'response-status');
  for (const [header, bad, code] of [
    ['cache-control', 'private, max-age=300', 'response-cache'],
    ['cache-control', 'public, max-age=301', 'response-cache'],
    ['content-type', 'application/jsonp', 'response-type'],
    ['access-control-allow-origin', 'https://example.test', 'response-cors'],
    ['x-content-type-options', 'sniff', 'response-nosniff'],
  ]) {
    for (const remove of [false, true]) {
      const headers = new Headers(response().headers);
      if (remove) headers.delete(header); else headers.set(header, bad);
      rejected(() => validateStatsResponse(response(value, { headers }), value, { now }), code);
    }
  }
  rejected(() => validateStatsResponse({ status: 200, headers: { 'cache-control': 'public, max-age=300', 'content-type': 'application/json' } }, value, { now, kind: 'html' }), 'response-type');
});

test('allowlist comparison rejects extra fields at every nested level and altered derived/source fields', () => {
  const value = fixture();
  const changes = [
    s => { s.token = 'DO-NOT-PRINT'; },
    s => { s.period.secret = 'DO-NOT-PRINT'; },
    s => { s.period.timezone = 'local'; },
    s => { s.coverage.secret = 'DO-NOT-PRINT'; },
    s => { s.totals.secret = 'DO-NOT-PRINT'; },
    s => { s.daily[0].ip = 'DO-NOT-PRINT'; },
    s => { s.source.accountTag = 'DO-NOT-PRINT'; },
    s => { s.source.metrics.token = 'DO-NOT-PRINT'; },
    s => { s.source.caveats.push('DO-NOT-PRINT'); },
    s => { s.totals.pageViews++; },
    s => { s.coverage.reportedDays++; },
    s => { delete s.source.metrics.visits; },
    s => { s.schemaVersion = 1; },
  ];
  for (const change of changes) {
    const altered = structuredClone(value); change(altered);
    assert.throws(() => validateStatsResponse(response(altered), value, { now }), error => {
      assert.match(error.message, /^Deployed stats verification failed: snapshot-(allowlist|schema)$/);
      assert.doesNotMatch(error.message, /DO-NOT-PRINT/); return true;
    });
  }
  rejected(() => validateStatsResponse(response(value, { body: 'DO-NOT-PRINT' }), value, { now }), 'response-json');
  rejected(() => validateStatsResponse(response(value, { body: 'null' }), value, { now }), 'snapshot-schema');
});

test('requires current 30 complete UTC dates and refresh age at most 30 minutes, no future/stale/unavailable', () => {
  const value = fixture();
  assert.deepEqual(validateStatsResponse(response(value), value, { now: new Date(now.getTime() + 30 * 60_000) }), value);
  rejected(() => validateStatsResponse(response(value), value, { now: new Date(now.getTime() + 30 * 60_000 + 1) }), 'snapshot-freshness');
  const future = fixture(new Date(now.getTime() + 1));
  rejected(() => validateStatsResponse(response(future), future, { now }), 'snapshot-schema');
  const yesterday = fixture(new Date(now.getTime() - 86400000));
  rejected(() => validateStatsResponse(response(yesterday), yesterday, { now }), 'snapshot-allowlist');
  const stale = { ...value, status: 'stale' };
  rejected(() => validateStatsResponse(response(stale), stale, { now }), 'snapshot-freshness');
  const unavailable = unavailableStats(now);
  rejected(() => validateStatsResponse(response(unavailable), unavailable, { now }), 'snapshot-freshness');
  const missing = structuredClone(value); missing.daily.pop();
  rejected(() => validateStatsResponse(response(missing), value, { now }), 'snapshot-schema');
  const day = structuredClone(value); day.daily[0].date = day.daily[1].date;
  rejected(() => validateStatsResponse(response(day), value, { now }), 'snapshot-schema');
  const invalid = structuredClone(value); invalid.daily[0].visits = -1;
  rejected(() => validateStatsResponse(response(invalid), value, { now }), 'snapshot-schema');
});

test('valid but different complete snapshot is a retryable propagation mismatch, not successful subset comparison', () => {
  const wanted = fixture();
  const other = fixture(new Date(now.getTime() - 1000));
  assert.throws(() => validateStatsResponse(response(other), wanted, { now }), e => e.propagation === true && e.message.endsWith('snapshot-mismatch'));
  const complete = fixture(now, true);
  assert.throws(() => validateStatsResponse(response(complete), wanted, { now }), e => e.propagation === true);
  assert.throws(() => validateStatsResponse(response(wanted, { status: 503 }), wanted, { now }), e => e.propagation === true);
  assert.throws(() => validateStatsResponse(response(wanted, { status: 403 }), wanted, { now }), e => e.propagation === false);
});

// Compile the actual Astro page, replacing only database I/O and surrounding layout.
const source = readFileSync(new URL('../src/pages/stats.astro', import.meta.url), 'utf8');
const compiled = transform(source, { filename: 'src/pages/stats.astro', internalURL: 'astro/compiler-runtime', resultScopedSlot: true, resolvePath: specifier => specifier });
async function render(snapshot) {
  const module = { exports: {} };
  const layout = runtime.createComponent((_result, _props, slots) => runtime.render`${slots.default()}`);
  const require = id => {
    if (id === 'astro/compiler-runtime') return runtime;
    if (id === 'src/pages/stats.astro?astro&type=style&index=0&lang.css') return {};
    if (id === 'cloudflare:workers') return { env: { DB: {} } };
    if (id === '../layouts/BaseLayout.astro') return { __esModule: true, default: layout };
    if (id === '../lib/site') return { siteConfig: { name: 'Agent First Directory' } };
    if (id === '../lib/public-stats') return { readPublicStats: async () => snapshot };
    throw new Error('Unexpected test dependency');
  };
  const { outputText } = ts.transpileModule(compiled.code, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS } });
  new Function('require', 'module', 'exports', outputText)(require, module, module.exports);
  const result = {
    createAstro: () => ({ request: new Request('http://localhost/stats'), response: { headers: new Headers() } }),
    _metadata: { rendererSpecificHydrationScripts: new Set(), hasRenderedHead: false, renderedHead: '', extraHead: [], propagators: new Set() },
    renderers: [], styles: new Set(), scripts: new Set(), links: new Set(), componentMetadata: new Map(), clientDirectives: new Map(),
  };
  return `<!doctype html><html><body>${await runtime.renderToString(result, module.exports.default, {}, {})}</body></html>`;
}
async function serve(snapshot, fn, { propagation = false, exposed = false } = {}) {
  const html = await render(snapshot);
  const seen = [];
  let jsonReads = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    seen.push({ path: url.pathname, method: req.method, query: url.searchParams.get('__stats_verify'), cache: req.headers['cache-control'], pragma: req.headers.pragma });
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (exposed && url.pathname === '/stats/refresh') { res.writeHead(200); return res.end(); }
    if (req.method === 'POST') { res.writeHead(405); return res.end(); }
    if (url.pathname === '/stats.json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const value = propagation && jsonReads++ === 0 ? { ...snapshot, refreshedAt: new Date(Date.parse(snapshot.refreshedAt) - 1000).toISOString() } : snapshot;
      return res.end(JSON.stringify(value));
    }
    if (url.pathname === '/stats') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html); }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`, seen); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('real Chromium independently verifies real Astro-rendered partial and complete fixtures, no artifacts', { timeout: 30_000 }, async () => {
  for (const complete of [false, true]) {
    const expected = fixture(new Date(), complete);
    let rendered;
    // Observe the verifier's real DOM extraction without changing browser behavior.
    const browserType = { async launch(options) {
      const browser = await chromium.launch(options);
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async options => {
        const context = await newContext(options);
        const newPage = context.newPage.bind(context);
        context.newPage = async () => {
          const page = await newPage();
          const evaluate = page.evaluate.bind(page);
          page.evaluate = async (...args) => {
            const result = await evaluate(...args);
            if (Array.isArray(result?.rows)) rendered = result;
            return result;
          };
          return page;
        };
        return context;
      };
      return browser;
    } };
    await serve(expected, async (base, seen) => {
      assert.deepEqual(await verifyDeployedStats(expected, { base, browserType }), { passed: true });
      validateRenderedStats(rendered, expected);
      for (const change of [
        view => { view.h1[0] = 'Wrong heading'; },
        view => { view.headings[0] = 'Stale snapshot'; },
        view => { view.rows.pop(); },
        view => { view.rows[0].values[1] = '1'; },
        view => { view.rows[0].values[2] = '1'; },
        view => { view.rows[0].values[3] = '999'; },
        view => { view.rows[0].dateTime = 'Wrong date'; },
        view => { view.rows[0].rowScope = null; },
        view => { view.metadata[0][1] = 'Wrong reporting window'; },
        view => { view.metadata[1][1] = 'Wrong refresh time'; },
        view => { view.metadata[2][1] = 'Wrong coverage'; },
        view => { view.times[2] = null; },
        view => { view.source[0][1] = 'Wrong source'; },
        view => { view.source[1][1] = 'Wrong metric definition'; },
        view => { view.caveats.pop(); },
        view => { view.caveats.reverse(); },
        view => { view.totals[0][1] = '999'; },
        view => { view.totalsLabel = 'Incorrect full totals claim'; },
        view => { view.totalsMessage = 'Wrong completeness claim'; },
        view => { view.columns.pop(); },
        view => { view.caption = 'Wrong dates'; },
        view => { view.dailyHelp = 'Missing limitations'; },
        view => { view.jsonLinks.pop(); },
      ]) {
        const altered = structuredClone(rendered); change(altered);
        rejected(() => validateRenderedStats(altered, expected), 'browser-snapshot-mismatch');
      }
      assert.ok(seen.some(r => r.method === 'POST' && r.path === '/stats.json'));
      assert.ok(seen.some(r => r.method === 'POST' && r.path === '/stats'));
      assert.ok(!seen.some(r => r.path === '/cdn-cgi/handler/scheduled'));
      for (const req of seen.filter(r => r.path !== '/favicon.ico')) {
        assert.ok(req.query, 'every verifier read/probe cache-busts');
        assert.equal(req.cache, 'no-cache'); assert.equal(req.pragma, 'no-cache');
      }
      assert.equal(new Set(seen.map(r => r.query).filter(Boolean)).size, seen.filter(r => r.query).length);
    });
  }
});

test('bounded propagation retry replaces older canonical JSON, then verifies browser', { timeout: 20_000 }, async () => {
  const expected = fixture(new Date());
  await serve(expected, async (base, seen) => {
    assert.deepEqual(await verifyDeployedStats(expected, { base }), { passed: true });
    assert.equal(seen.filter(r => r.path === '/stats.json' && r.method === 'GET').length, 2);
  }, { propagation: true });
});

test('exposed refresh route fails before browser launch', async () => {
  const expected = fixture(new Date());
  await serve(expected, async base => {
    let launched = false;
    await assert.rejects(verifyDeployedStats(expected, { base, browserType: { launch() { launched = true; } } }), /public-refresh-exposed$/);
    assert.equal(launched, false);
  }, { exposed: true });
});

test('all injected operational errors and invalid base URLs are sanitized, expected validation precedes requests', async () => {
  const expected = fixture(new Date());
  await assert.rejects(verifyDeployedStats(expected, { fetcher: async () => { throw new Error('RAW-CREDENTIAL-PAYLOAD'); } }), error => error.message === 'Deployed stats verification failed: execution' && !error.cause);
  await assert.rejects(verifyDeployedStats(expected, { base: 'https://USER:RAW-CREDENTIAL@localhost' }), /base-url$/);
  let called = false;
  await assert.rejects(verifyDeployedStats({ ...expected, token: 'RAW-CREDENTIAL' }, { fetcher() { called = true; } }), /snapshot-allowlist$/);
  assert.equal(called, false);
  await serve(expected, async base => {
    await assert.rejects(verifyDeployedStats(expected, { base, browserType: { launch() { throw new Error('RAW-BROWSER-CREDENTIAL'); } } }), error => error.message === 'Deployed stats verification failed: execution' && !error.cause);
  });
});

test('POST success/redirect/auth statuses cannot pass the public mutation rejection probes', async () => {
  const expected = fixture(new Date());
  for (const path of ['/stats', '/stats.json']) {
    for (const status of [200, 201, 204, 302, 403, 500]) {
      let launched = false;
      const fetcher = async (url, init) => new Response(null, {
        status: new URL(url).pathname === path && init.method === 'POST' ? status : init.method === 'POST' ? 405 : 404,
      });
      await assert.rejects(verifyDeployedStats(expected, { fetcher, browserType: { launch() { launched = true; } } }), /public-mutation-exposed$/);
      assert.equal(launched, false);
    }
  }
});

test('non-resolving requests are bounded and aborted without raw diagnostics', { timeout: 12_000 }, async () => {
  const expected = fixture(new Date());
  const signals = [];
  await assert.rejects(verifyDeployedStats(expected, { fetcher: (_url, init) => {
    signals.push(init.signal); return new Promise(() => {});
  } }), error => error.message === 'Deployed stats verification failed: request-timeout' && !error.cause);
  await Promise.all(signals.map(signal => signal.aborted ? undefined : new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))));
  assert.ok(signals.length > 0 && signals.every(signal => signal.aborted));
});

test('pure browser helper rejects missing rows, wrong headings and arbitrary mismatched rendering', () => {
  for (const bad of [null, {}, { rows: [] }, { headings: ['Wrong'], caveats: [] }]) {
    rejected(() => validateRenderedStats(bad, fixture()), 'browser-snapshot-mismatch');
  }
});
