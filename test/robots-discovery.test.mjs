import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("robots.txt explicitly allows search, citation, and declared training crawlers", () => {
  const robots = read("public/robots.txt");
  const allowedAgents = [
    "*",
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "Claude-SearchBot",
    "Claude-User",
    "ClaudeBot",
    "PerplexityBot",
  ];

  for (const agent of allowedAgents) {
    const escapedAgent = agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      robots,
      new RegExp(`User-agent: ${escapedAgent}\\s+Allow: /(?:\\s|$)`),
      `${agent} must be explicitly allowed`,
    );
  }

  assert.doesNotMatch(robots, /^\s*Disallow:/im);
  assert.equal(
    (robots.match(/^Sitemap:\s+https:\/\/agentfirst\.directory\/sitemap-index\.xml\s*$/gm) ?? []).length,
    1,
  );
});

test("all declared static sitemap pages have a route implementation", async () => {
  const { getStaticPageEntries } = await import("../src/lib/static-pages.ts");
  const routeFiles = new Map([
    ["/", "src/pages/index.astro"],
    ["/about", "src/pages/about.astro"],
    ["/editorial-standards", "src/pages/editorial-standards.astro"],
    ["/policy", "src/pages/policy.astro"],
    ["/corrections", "src/pages/corrections.astro"],
    ["/open-source-ai-agent-tools", "src/pages/open-source-ai-agent-tools.astro"],
    ["/research/state-of-agent-first-infrastructure", "src/pages/research/state-of-agent-first-infrastructure.astro"],
    ["/submit", "src/pages/submit.astro"],
  ]);

  assert.deepEqual(getStaticPageEntries().map(({ path }) => path), [...routeFiles.keys()]);
  for (const [path, file] of routeFiles) {
    assert.equal(existsSync(new URL(file, root)), true, `${path} is missing ${file}`);
  }
});

test("feed, AI discovery, and downloadable data endpoints remain published and linked", () => {
  const endpoints = new Map([
    ["/feed.xml", "src/pages/feed.xml.ts"],
    ["/api/tools.json", "src/pages/api/tools.json.ts"],
    ["/data/agent-first-tools.csv", "src/pages/data/agent-first-tools.csv.ts"],
    ["/llms.txt", "src/pages/llms.txt.ts"],
    ["/llms-full.txt", "src/pages/llms-full.txt.ts"],
  ]);

  for (const [path, file] of endpoints) {
    assert.equal(existsSync(new URL(file, root)), true, `${path} is missing ${file}`);
  }

  const layout = read("src/layouts/BaseLayout.astro");
  assert.match(layout, /feedUrl = "\/feed\.xml"/);
  assert.match(layout, /rel="alternate" type="application\/rss\+xml"/);
  assert.match(layout, /appleTouchIconUrl = "\/apple-touch-icon\.png"/);
  assert.match(layout, /manifestUrl = "\/site\.webmanifest"/);

  const llms = read("src/pages/llms.txt.ts");
  for (const path of endpoints.keys()) {
    if (path === "/llms.txt") continue;
    assert.match(llms, new RegExp(`https://agentfirst\\.directory${path.replaceAll(".", "\\.")}`));
  }

  assert.match(read("src/pages/feed.xml.ts"), /Content-Type": "application\/rss\+xml; charset=utf-8"/);
  assert.match(read("src/pages/api/tools.json.ts"), /X-Robots-Tag": "index, follow"/);
  assert.match(read("src/pages/data/agent-first-tools.csv.ts"), /X-Robots-Tag": "index, follow"/);
});

test("manifest and declared icon/social assets exist with non-empty content", () => {
  const manifest = JSON.parse(read("public/site.webmanifest"));

  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.icons[0].src, "/apple-touch-icon.png");
  assert.equal(manifest.icons[0].sizes, "180x180");

  for (const file of [
    "public/favicon.ico",
    "public/favicon.svg",
    "public/apple-touch-icon.png",
    "public/og-default.png",
  ]) {
    const url = new URL(file, root);
    assert.equal(existsSync(url), true, `${file} is missing`);
    assert.ok(statSync(url).size > 0, `${file} is empty`);
  }
});
