import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = read("src/pages/stats.astro");
const compiled = transform(source, {
  filename: "src/pages/stats.astro",
  internalURL: "astro/compiler-runtime",
  resultScopedSlot: true,
  resolvePath: (specifier) => specifier,
});

// Explicit synthetic fixtures exercise presentation states; they are never production data.
function fixture(status = "fresh") {
  const daily = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 8, 6 + index)).toISOString().slice(0, 10),
    uniqueVisitors: index < 3 && status !== "unavailable" ? 0 : null,
    requests: index < 3 && status !== "unavailable" ? 100 : null,
    sampleInterval: index < 3 && status !== "unavailable" ? 100 : null,
  }));
  return {
    schemaVersion: "2", status,
    refreshedAt: status === "unavailable" ? null : "2026-10-06T08:00:00.000Z",
    period: { start: daily[0].date, end: daily.at(-1).date, timezone: "UTC", days: 30 },
    source: { name: "Synthetic zone analytics", dataset: "httpRequests1dGroups", metrics: { uniqueVisitors: "uniq.uniques", requests: "sum.requests" }, caveats: ["Synthetic sampling caveat", "Synthetic <escaped> caveat"] },
    coverage: { reportedDays: status === "unavailable" ? 0 : 3, missingDays: status === "unavailable" ? 30 : 27, sampled: status !== "unavailable" },
    totals: { uniqueVisitors: status === "unavailable" ? null : 0, requests: status === "unavailable" ? null : 300, complete: status !== "unavailable" },
    daily,
  };
}

async function renderSnapshot(snapshot) {
  // Run the real compiler output with only I/O and the surrounding layout replaced.
  // This keeps the test independent of D1, the Worker, and unrelated header data.
  const layout = runtime.createComponent((_result, props, slots) => runtime.render`<meta name="description" content="${props.description}">${slots.default()}`);
  const db = {};
  const response = { headers: new Headers() };
  const module = { exports: {} };
  const require = (id) => {
    if (id === "astro/compiler-runtime") return runtime;
    if (id === "src/pages/stats.astro?astro&type=style&index=0&lang.css") return {};
    if (id === "cloudflare:workers") return { env: { DB: db } };
    if (id === "../layouts/BaseLayout.astro") return { __esModule: true, default: layout };
    if (id === "../lib/site") return { siteConfig: { name: "Agent First Directory" } };
    if (id === "../lib/public-stats") return { readPublicStats: async (binding) => { assert.equal(binding, db); return snapshot; } };
    throw new Error(`Unexpected stats page dependency: ${id}`);
  };
  const { outputText } = ts.transpileModule(compiled.code, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  });
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  const result = {
    createAstro: () => ({ response, request: new Request('http://localhost/stats') }),
    _metadata: { rendererSpecificHydrationScripts: new Set(), renderedScripts: new Set(), hasRenderedHead: false, renderedHead: "", extraHead: [], propagators: new Set() },
    renderers: [],
    styles: new Set(),
    scripts: new Set(),
    links: new Set(),
    componentMetadata: new Map(),
    clientDirectives: new Map(),
    // SSR-only fixture: the built-Worker harness exercises the actual client bundle.
    inlinedScripts: new Map(), resolve: async () => "data:text/javascript,",
  };
  const html = await runtime.renderToString(result, module.exports.default, {}, {});
  return { html, response };
}

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const cards = (html) => [...html.matchAll(/<article\b[^>]*class="stats-summary-card[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
const cardValues = (html) => cards(html).map(card => text(card.match(/<p\b[^>]*class="stats-value[^>]*>([\s\S]*?)<\/p>/)[1]));

for (const status of ["fresh", "stale", "unavailable"]) {
  test(`${status}: exactly three ordered summary cards and snapshot status last`, async () => {
    const snapshot = fixture(status);
    const { html, response } = await renderSnapshot(snapshot);
    const summary = cards(html);
    assert.equal(summary.length, 3);
    assert.deepEqual(summary.map(card => text(card.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)[1])), ["Unique visitors", "HTTP Requests", "Window"]);
    assert.deepEqual(cardValues(html), status === "unavailable" ? ["Unavailable", "Unavailable", "Last 30 days"] : ["0", "300", "Last 30 days"]);
    for (const card of summary) {
      const description = text(card.match(/<p\b[^>]*class="stats-card-copy[^>]*>([\s\S]*?)<\/p>/)[1]);
      assert.ok(description.length < 140);
      assert.equal((description.match(/[.!?]/g) ?? []).length, 1);
    }
    const sections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].map(match => match[0]);
    assert.match(sections.at(-1), /aria-labelledby="snapshot-heading"/);
    assert.ok(html.indexOf('class="stats-summary') < html.indexOf('id="daily-heading"'));
    assert.ok(html.indexOf('id="daily-heading"') < html.indexOf('id="methodology-heading"'));
    assert.ok(html.indexOf('id="methodology-heading"') < html.indexOf('id="snapshot-heading"'));
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
    // Check rendered text and the actual description passed to the layout, not imports.
    assert.doesNotMatch(text(html) + html.match(/<meta[^>]+>/)[0], /cloudflare|httpRequests1dGroups|uniq\.uniques|sum\.requests|sampleInterval|Sample interval|\bAPI\b|\bzone\b|\bRUM\b|dataset|Synthetic.*caveat|—/i);
    assert.match(html, /href="\/stats\.json"/);
    assert.match(text(html), /bots and automated traffic/);
    assert.match(text(html), /not an exact count of people/);
    assert.match(text(html), /pages, images and other files/);
    assert.match(text(html), /not page views/);
    const sampling = html.match(/<dt[^>]*>Sampling<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/)[1];
    assert.equal((sampling.match(/<p\b/g) ?? []).length, 1);
    assert.equal((text(sampling).match(/\./g) ?? []).length, 1);
    assert.ok(text(sampling).length < 200);
    assert.doesNotMatch(text(html), /unsampled|No sampling|deduplicated|distinct people|real.time/i);
    assert.match(text(html), /30 complete days in UTC/);
    assert.match(html, /datetime="2026-09-06"/);
    assert.match(html, /datetime="2026-10-05"/);
  });
}

test("daily table preserves missing values, measured zeros, chart fallback and keyboard region", async () => {
  const snapshot = fixture();
  const { html } = await renderSnapshot(snapshot);
  const body = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((body.match(/<tr[\s>]/g) ?? []).length, 30);
  assert.deepEqual([...body.matchAll(/datetime="([^"]+)"/g)].map(match => match[1]), [...snapshot.daily].reverse().map(day => day.date));
  const original = JSON.stringify(snapshot);
  await renderSnapshot(snapshot);
  assert.equal(JSON.stringify(snapshot), original, "Rendering must not mutate snapshot.daily");
  for (const { date } of snapshot.daily) assert.ok(body.includes(`datetime="${date}"`));
  assert.match(body, /<td[^>]*>0<\/td>/);
  assert.match(body, /<td[^>]*>Not reported<\/td>/);
  assert.match(html, /<caption[^>]*>Daily unique visitors and HTTP requests/);
  assert.match(html, /<figure[^>]*aria-labelledby="chart-caption"/);
  assert.equal((html.match(/stats-bar-slot/g) ?? []).length, 30);
  assert.equal((body.match(/scope="row"/g) ?? []).length, 30);
  assert.equal((html.match(/scope="col"/g) ?? []).length, 3);
  assert.equal((body.match(/<td\b/g) ?? []).length, 60);
  assert.match(html, /role="region"[^>]*tabindex="0"[^>]*aria-label="Daily traffic estimates, horizontally scrollable"[^>]*aria-describedby="daily-help"/);
  assert.match(text(html), /arrow keys to scroll/);
  assert.match(text(html), /Do not add daily visitors/);
});

test("fresh and stale values retain dated update and coverage evidence", async () => {
  for (const status of ["fresh", "stale"]) {
    const { html } = await renderSnapshot(fixture(status));
    assert.match(text(html), status === "fresh" ? /Fresh snapshot/ : /Stale snapshot.*may be out of date/);
    assert.match(text(html), /3 days reported; 27 days not reported/);
    assert.match(html, /datetime="2026-10-06T08:00:00.000Z"/);
    assert.match(text(html), /6 Oct 2026, 08:00 UTC/);
    assert.match(text(html), /6 Sept? 2026 to 5 Oct 2026/);
  }
});

test("unavailable or null totals never become zero, while measured zero stays zero", async () => {
  const { html } = await renderSnapshot(fixture("unavailable"));
  assert.match(text(html), /Statistics unavailable/);
  assert.match(text(html), /Missing figures do not mean zero traffic/);
  assert.match(text(html), /No successful update yet/);
  assert.doesNotMatch(html, /<td[^>]*>0<\/td>/);
  assert.equal((html.match(/<td[^>]*>Not reported<\/td>/g) ?? []).length, 60);
  const snapshot = fixture(); snapshot.totals.uniqueVisitors = null;
  assert.deepEqual(cardValues((await renderSnapshot(snapshot)).html), ["Not reported", "300", "Last 30 days"]);
});

test("rendering leaves the complete JSON snapshot, sampling and caveats untouched", async () => {
  const { publicStatsResponse } = await import('../src/lib/public-stats.ts');
  const snapshot = fixture();
  const before = JSON.stringify(snapshot);
  await renderSnapshot(snapshot);
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(await publicStatsResponse(snapshot).json(), JSON.parse(before));
  snapshot.coverage.sampled = false;
  snapshot.daily = snapshot.daily.map(day => ({ ...day, sampleInterval: day.sampleInterval === null ? null : 1 }));
  assert.doesNotMatch(text((await renderSnapshot(snapshot)).html), /unsampled|No sampling/i);
});

test("public statistics are discoverable in the footer and llms.txt without changing listing exports", () => {
  assert.match(read("src/components/SiteFooter.astro"), /href="\/stats">Traffic Stats<\/a>/);
  const llms = read("src/pages/llms.txt.ts");
  assert.match(llms, /https:\/\/agentfirst\.directory\/stats\)/);
  assert.match(llms, /https:\/\/agentfirst\.directory\/stats\.json\)/);
  assert.match(llms, /https:\/\/agentfirst\.directory\/api\/tools\.json/);
  assert.match(source, /\.stats-table-scroll:focus-visible/);
  assert.match(source, /overflow-x: auto/);
});
