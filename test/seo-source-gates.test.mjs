import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("BaseLayout preserves canonical, safe robots, social-image, and JSON-LD gates", () => {
  const source = read("src/layouts/BaseLayout.astro");

  assert.match(source, /<link rel="canonical" href=\{canonicalUrl\}/);
  assert.match(source, /noindex \? "noindex, follow"/);
  assert.doesNotMatch(source, /noindex, nofollow/);
  assert.match(source, /property="og:image:width"/);
  assert.match(source, /property="og:image:height"/);
  assert.match(source, /property="og:image:type"/);
  assert.match(source, /set:html=\{serializeJsonLd\(schema\)\}/);
  assert.doesNotMatch(source, /set:html=\{JSON\.stringify\(schema\)\}/);
});

test("homepage keeps the approved direct copy and shared SEO description", () => {
  const site = read("src/lib/site.ts");
  const homepage = read("src/pages/index.astro");
  const description =
    "Find and compare evidence-reviewed tools built for AI agents: agent-native software, enabling infrastructure, and open agent protocols.";

  assert.match(site, new RegExp(JSON.stringify(description).slice(1, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(homepage, /description: siteConfig\.description/);
  assert.match(homepage, /description=\{siteConfig\.description\}/);
  assert.match(homepage, /<p class="hero-copy-text">\s*\{siteConfig\.description\}\{" "\}/);
  assert.match(
    homepage,
    /The directory for <span class="hero-accent">agent-first<\/span> AI tools/,
  );
  assert.match(
    homepage,
    /Every listing has to pass the evidence-based inclusion test\.\{" "\}/,
  );
  assert.match(
    homepage,
    /<a class="detail-link" href="\/policy">Read the inclusion policy →<\/a>/,
  );
  assert.doesNotMatch(`${description}\n${homepage}`, /—/);
});

test("tool and category misses retain hard status codes and noindex directives", () => {
  const toolPage = read("src/pages/tools/[slug].astro");
  const categoryPage = read("src/pages/category/[category].astro");
  const catchAll = read("src/pages/[...path].astro");

  for (const source of [toolPage, categoryPage]) {
    assert.match(source, /Astro\.response\.status = isGone \? 410 : 404/);
    assert.match(source, /noindex=\{/);
  }

  assert.match(catchAll, /Astro\.response\.status = isGone \? 410 : 404/);
  assert.match(catchAll, /<BaseLayout[\s\S]*?noindex/);
  assert.match(catchAll, /Cache-Control", "public, max-age=0, s-maxage=180"/);
});

test("sitemap eligibility follows indexability and content-modification metadata", () => {
  const content = read("src/lib/content.ts");
  const toolSitemapBody = content.match(
    /export async function getSitemapToolEntries\(\) \{([\s\S]*?)\n\}/,
  )?.[1];
  const categorySitemapBody = content.match(
    /export async function getSitemapCategoryEntries\(\) \{([\s\S]*?)\n\}/,
  )?.[1];

  assert.ok(toolSitemapBody, "getSitemapToolEntries body missing");
  assert.ok(categorySitemapBody, "getSitemapCategoryEntries body missing");
  assert.match(content, /AND t\.is_indexable = 1/);
  assert.match(content, /AND c\.is_indexable = 1/);
  assert.match(content, /AND EXISTS \([\s\S]*?t\.is_indexable = 1/);
  assert.match(toolSitemapBody, /contentModifiedAt \?\? tool\.entry\.publishedAt/);
  assert.doesNotMatch(toolSitemapBody, /syncedAt/);
  assert.match(categorySitemapBody, /category\.contentModifiedAt/);
  assert.match(categorySitemapBody, /tool\.entry\.contentModifiedAt/);
  assert.doesNotMatch(categorySitemapBody, /syncedAt/);
});

test("redirect lookup accepts only active internal non-self destinations", () => {
  const redirects = read("src/lib/redirects.ts");

  assert.match(redirects, /!value\.startsWith\("\/"\) \|\| value\.startsWith\("\/\/"\)/);
  assert.match(redirects, /WHERE source_path = \?1\s+AND is_active = 1/);
  assert.match(redirects, /!\[301, 308, 410\]\.includes\(row\.status_code\)/);
  assert.match(redirects, /destinationPath === sourcePath/);
});

test("production origin and immutable asset controls remain configured", () => {
  const wrangler = JSON.parse(read("wrangler.jsonc"));
  const middleware = read("src/middleware.ts");
  const middlewarePolicy = read("src/lib/middleware-policy.ts");
  const headers = read("public/_headers");

  assert.equal(wrangler.workers_dev, false);
  assert.equal(wrangler.preview_urls, false);
  assert.deepEqual(
    wrangler.routes.map((route) => route.pattern),
    ["agentfirst.directory"],
  );
  assert.equal(wrangler.routes[0].custom_domain, true);
  assert.match(middlewarePolicy, /canonicalOrigin = "https:\/\/agentfirst\.directory"/);
  assert.match(middleware, /getCanonicalRedirectLocation\(url\)/);
  assert.match(middleware, /status: 308/);
  assert.match(middleware, /getRequestCacheDecision\(/);
  assert.match(middleware, /getResponseCacheDecision\(/);
  assert.match(middlewarePolicy, /hasCacheDirective\(responseCacheControl, "private"\)/);
  assert.match(middlewarePolicy, /hasCacheDirective\(responseCacheControl, "no-store"\)/);
  assert.match(headers, /\/_astro\/\*[\s\S]*?max-age=31536000, immutable/);
});

test("controlled media variants enforce dimensions, byte limits, and local fallbacks", () => {
  const mediaRoute = read("src/pages/media/tools/[slug]/[variant].ts");

  assert.match(mediaRoute, /hero:[\s\S]*?width: 1200,[\s\S]*?height: 630/);
  assert.match(mediaRoute, /"hero-small":[\s\S]*?width: 640,[\s\S]*?height: 336/);
  assert.match(mediaRoute, /card:[\s\S]*?width: 96,[\s\S]*?height: 96/);
  assert.match(mediaRoute, /const MAX_TRANSFORMED_BYTES = 350_000/);
  assert.match(mediaRoute, /body = await response\.arrayBuffer\(\)/);
  assert.match(mediaRoute, /body\.byteLength > MAX_TRANSFORMED_BYTES/);
  assert.match(mediaRoute, /return fallbackResponse\(variant\.fallback\)/);
  assert.match(mediaRoute, /"X-Robots-Tag": "noindex"/);
});

test("tool-card headings are contextual and card images use the controlled media route", () => {
  const toolList = read("src/components/ToolList.astro");
  const categoryPage = read("src/pages/category/[category].astro");
  const toolPage = read("src/pages/tools/[slug].astro");

  assert.match(toolList, /headingLevel\?: 2 \| 3 \| 4 \| 5 \| 6/);
  assert.match(toolList, /<HeadingTag class="card-title">/);
  assert.match(toolList, /src=\{`\/media\/tools\/\$\{tool\.entry\.slug\}\/card`\}/);
  assert.match(categoryPage, /<ToolList tools=\{tools\} headingLevel=\{3\}/);
  assert.match(toolPage, /<ToolList tools=\{relatedTools\} variant="compact" headingLevel=\{3\}/);
});

test("category content sections retain consistent vertical spacing", () => {
  const categoryPage = read("src/pages/category/[category].astro");
  const styles = read("src/styles/global.css");

  assert.match(categoryPage, /<div class="category-content-stack">[\s\S]*?<section class="section-block">/);
  assert.match(styles, /\.category-content-stack\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*24px;/);
});

test("category comparison tables omit low-value human review dates", () => {
  const categoryPage = read("src/pages/category/[category].astro");

  assert.match(categoryPage, /<th scope="col">Verification<\/th>/);
  assert.doesNotMatch(categoryPage, /Human review date/);
  assert.doesNotMatch(categoryPage, /tool\.entry\.reviewedAt/);
});

test("category definition spans above the equal-width guidance columns", () => {
  const categoryPage = read("src/pages/category/[category].astro");
  const styles = read("src/styles/global.css");

  assert.match(categoryPage, /class="detail-panel category-guidance category-guidance-definition" id="definition"/);
  assert.match(styles, /\.category-editorial-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.category-guidance-definition\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.category-editorial-grid,[\s\S]*?grid-template-columns:\s*1fr/);
});
