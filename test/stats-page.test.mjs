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
    visits: index < 3 && status !== "unavailable" ? 0 : null,
    pageViews: index < 3 && status !== "unavailable" ? 100 : null,
    sampleInterval: index < 3 && status !== "unavailable" ? 100 : null,
  }));
  return {
    schemaVersion: "1",
    status,
    refreshedAt: status === "unavailable" ? null : "2026-10-06T08:00:00.000Z",
    period: { start: daily[0].date, end: daily.at(-1).date, timezone: "UTC", days: 30 },
    source: {
      name: "Test browser analytics",
      dataset: "testDataset",
      metrics: { visits: "sum.visits", pageViews: "sum.pageViews" },
      caveats: ["Synthetic sampling caveat", "Synthetic <escaped> caveat"],
    },
    coverage: { reportedDays: status === "unavailable" ? 0 : 3, missingDays: status === "unavailable" ? 30 : 27, sampled: status !== "unavailable" },
    totals: { visits: status === "unavailable" ? null : 0, pageViews: status === "unavailable" ? null : 300, complete: false },
    daily,
  };
}

async function renderSnapshot(snapshot) {
  // Run the real compiler output with only I/O and the surrounding layout replaced.
  // This keeps the test independent of D1, the Worker, and unrelated header data.
  const layout = runtime.createComponent((_result, _props, slots) => runtime.render`${slots.default()}`);
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
    _metadata: { rendererSpecificHydrationScripts: new Set(), hasRenderedHead: false, renderedHead: "", extraHead: [], propagators: new Set() },
    renderers: [],
    styles: new Set(),
    scripts: new Set(),
    links: new Set(),
    componentMetadata: new Map(),
    clientDirectives: new Map(),
  };
  const html = await runtime.renderToString(result, module.exports.default, {}, {});
  return { html, response };
}

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("stats page renders partial estimates, all UTC dates, measured zeros, and every source caveat", async () => {
  const snapshot = fixture();
  const { html, response } = await renderSnapshot(snapshot);
  const copy = text(html);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
  assert.match(copy, /Fresh snapshot/);
  assert.match(copy, /Observed estimates \(partial coverage\)/);
  assert.match(copy, /not full reporting-window totals/);
  assert.match(copy, /3 reported dates; 27 missing dates/);
  assert.match(copy, /Last successful refresh 2026-10-06T08:00:00.000Z \(UTC\)/);
  assert.match(copy, /Visits 0 Page views 300/);
  assert.match(copy, /Visits are not unique people or a count of AI agents/);
  assert.match(copy, /sample interval is the provider-reported sampling weight, not a percentage/);
  assert.match(copy, /Synthetic sampling caveat/);
  assert.match(html, /Synthetic &lt;escaped&gt; caveat/);
  assert.match(copy, /sum\.visits/);
  assert.match(copy, /sum\.pageViews/);
  assert.match(html, /href="\/stats\.json"/);
  const body = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((body.match(/<tr[\s>]/g) ?? []).length, 30);
  for (const { date } of snapshot.daily) assert.ok(body.includes(`datetime="${date}"`));
  assert.match(body, /<td[^>]*>0<\/td>/);
  assert.match(body, /<td[^>]*>Not reported<\/td>/);
  assert.match(html, /<caption[^>]*>Daily visits and page-view estimates/);
  assert.equal((body.match(/scope="row"/g) ?? []).length, 30);
  assert.equal((html.match(/scope="col"/g) ?? []).length, 4);
  assert.match(html, /role="region"[^>]*tabindex="0"[^>]*aria-label="Daily traffic estimates, horizontally scrollable"/);
});

test("stale snapshots show the retained data and a visible freshness warning", async () => {
  const { html } = await renderSnapshot(fixture("stale"));
  const copy = text(html);
  assert.match(copy, /Stale snapshot/);
  assert.match(copy, /may be out of date/);
  assert.match(copy, /over 36 hours old/);
  assert.match(copy, /Visits 0 Page views 300/);
  assert.match(copy, /Last successful refresh 2026-10-06T08:00:00.000Z/);
});

test("unavailable snapshots never present missing traffic as zero", async () => {
  const { html } = await renderSnapshot(fixture("unavailable"));
  const copy = text(html);
  assert.match(copy, /Statistics unavailable/);
  assert.match(copy, /Unavailable measurements are not zero traffic/);
  assert.match(copy, /No successful refresh available/);
  assert.match(copy, /Visits Unavailable Page views Unavailable/);
  assert.doesNotMatch(html, /<td[^>]*>0<\/td>/);
  assert.equal((html.match(/<td[^>]*>Not reported<\/td>/g) ?? []).length, 90);
});

test("complete coverage is still described as estimates rather than exact traffic", async () => {
  const snapshot = fixture();
  snapshot.daily = snapshot.daily.map((day) => ({ ...day, visits: 0, pageViews: 100, sampleInterval: 100 }));
  snapshot.coverage = { reportedDays: 30, missingDays: 0, sampled: true };
  snapshot.totals = { visits: 0, pageViews: 3000, complete: true };
  const { html } = await renderSnapshot(snapshot);
  const copy = text(html);
  assert.match(copy, /Reporting-window estimates/);
  assert.match(copy, /Every date has reported data/);
  assert.match(copy, /not an exact census of traffic/);
  assert.doesNotMatch(copy, /Observed estimates \(partial coverage\)/);
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
