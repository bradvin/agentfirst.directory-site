import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";

async function request(path, { status = 200, redirect = "follow" } = {}) {
  const response = await fetch(new URL(path, baseUrl), { redirect });
  const body = await response.text();
  assert.equal(response.status, status, `${path} returned ${response.status}`);
  return { response, body };
}

async function get(path) {
  return (await request(path)).body;
}

function cardFor(html, slug) {
  const href = `/tools/${slug}`;
  const hrefIndex = html.indexOf(href);
  assert.notEqual(hrefIndex, -1, `missing card link ${href}`);
  const articleStart = html.lastIndexOf("<article", hrefIndex);
  const articleEnd = html.indexOf("</article>", hrefIndex);
  assert.notEqual(articleStart, -1, `missing card start for ${slug}`);
  assert.notEqual(articleEnd, -1, `missing card end for ${slug}`);
  return html.slice(articleStart, articleEnd);
}

function jsonLdDocuments(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) =>
    JSON.parse(match[1]),
  );
}

function jsonLdNodes(html) {
  const nodes = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!value || typeof value !== "object") return;
    if (value["@type"] || value["@id"]) nodes.push(value);
    Object.values(value).forEach(visit);
  };

  jsonLdDocuments(html).forEach(visit);
  return nodes;
}

function schemaHasType(schema, type) {
  return Array.isArray(schema?.["@type"])
    ? schema["@type"].includes(type)
    : schema?.["@type"] === type;
}

function schemaOfType(html, type) {
  return jsonLdNodes(html).find((node) => schemaHasType(node, type));
}

function toolEntity(html) {
  return jsonLdNodes(html).find((node) => node["@id"]?.endsWith("#tool") && node["@type"]);
}

function detailHeroFor(html, name) {
  const titleMatch = html.match(new RegExp(`<h1 class="detail-title"[^>]*>${name}</h1>`));
  assert.ok(titleMatch, `${name} detail title missing`);
  const sectionStart = html.lastIndexOf("<section", titleMatch.index);
  const sectionEnd = html.indexOf("</section>", titleMatch.index);
  return html.slice(sectionStart, sectionEnd);
}

function assertClassificationFact(html, label) {
  assert.match(
    html,
    new RegExp(`detail-fact-label[^>]*>Classification</span>[\\s\\S]{0,500}>\\s*${label}\\s*</a>`),
  );
}

function assertNoInventedAppClaims(schema) {
  assert.equal(schema.operatingSystem, undefined);
  assert.equal(schema.isAccessibleForFree, undefined);
  assert.equal(schema.offers, undefined);
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.review, undefined);
}

const homepage = await get("/");
assert.match(homepage, /<title>AI Agent Tools Directory \| agentfirst\.directory<\/title>/);
assert.match(homepage, /<link rel="canonical" href="https:\/\/agentfirst\.directory\/">/);
assert.match(homepage, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
assert.match(homepage, /<link rel="manifest" href="\/site\.webmanifest">/);
assert.match(homepage, /<link rel="alternate" type="application\/rss\+xml"[^>]*href="\/feed\.xml">/);
assert.match(homepage, /<meta property="og:image:width" content="1200">/);
assert.match(homepage, /<meta property="og:image:height" content="630">/);
assert.match(homepage, /<meta property="og:image:type" content="image\/png">/);
assert.match(cardFor(homepage, "hermes-agent"), /Agent-native/);
assert.match(cardFor(homepage, "hermes-agent"), /<h2 class="card-title">Hermes Agent<\/h2>/);
assert.match(cardFor(homepage, "fiber"), /Agent-enabling/);
assert.match(cardFor(homepage, "x402"), /Agent internet protocol/);
assert.doesNotMatch(cardFor(homepage, "legacy-tool"), /classification-badge/);
assert.ok((homepage.match(/href="\/policy"/g) ?? []).length >= 3, "policy links missing from header, summary, or footer");
assert.equal(schemaOfType(homepage, "Person")?.name, "Brad Vincent");
assert.ok(schemaOfType(homepage, "WebSite"), "homepage WebSite schema missing");
assert.ok(schemaOfType(homepage, "CollectionPage"), "homepage CollectionPage schema missing");
const homepageList = schemaOfType(homepage, "ItemList");
assert.equal(homepageList?.itemListOrder, "https://schema.org/ItemListUnordered");
assert.ok(homepageList?.itemListElement.every((item) => item.position === undefined));

const category = await get("/category/agent-infrastructure");
assert.match(category, /<title>AI agent infrastructure tools<\/title>/);
assert.match(category, /Systems that provide a material runtime/);
assert.match(category, /Run durable agent workflows/);
assert.match(cardFor(category, "fiber"), /Agent-enabling/);
assert.match(cardFor(category, "fiber"), /<h3 class="card-title">Fiber<\/h3>/);
assert.ok(schemaOfType(category, "CollectionPage"), "category CollectionPage schema missing");
assert.equal(schemaOfType(category, "ItemList")?.numberOfItems, 3);

const nativeDetail = await get("/tools/hermes-agent");
assert.match(detailHeroFor(nativeDetail, "Hermes Agent"), /classification-badge[^>]*>[\s\S]*Agent-native/);
assertClassificationFact(nativeDetail, "Agent-native");
assert.match(cardFor(nativeDetail, "fiber"), /Agent-enabling/);
assert.match(cardFor(nativeDetail, "fiber"), /<h3 class="card-title">Fiber<\/h3>/);
assert.doesNotMatch(cardFor(nativeDetail, "legacy-tool"), /classification-badge/);
const nativeEntity = toolEntity(nativeDetail);
assert.equal(nativeEntity["@type"], "SoftwareSourceCode");
assert.equal(nativeEntity.codeRepository, "https://github.com/NousResearch/hermes-agent");
assert.ok(nativeEntity.genre.includes("Agent-native"));
assertNoInventedAppClaims(nativeEntity);
assert.ok(schemaOfType(nativeDetail, "ItemPage"), "tool ItemPage schema missing");
assert.ok(schemaOfType(nativeDetail, "BreadcrumbList"), "tool breadcrumb schema missing");
assert.match(nativeDetail, /id="overview"/);
assert.match(nativeDetail, /id="why-this-qualifies"/);
assert.match(nativeDetail, /Agents are the runtime(?:'|’|&rsquo;)s core actor/);
assert.match(nativeDetail, /id="verified-facts"/);
assert.match(nativeDetail, /documentation reviewed/);
assert.match(nativeDetail, /id="sources"/);
assert.match(nativeDetail, /Hermes Agent documentation/);
assert.match(nativeDetail, /accessed Sep 3, 2026/);
assert.equal(nativeEntity.subjectOf[0].url, "https://github.com/NousResearch/hermes-agent");

const enablingDetail = await get("/tools/fiber");
assert.match(detailHeroFor(enablingDetail, "Fiber"), /classification-badge[^>]*>[\s\S]*Agent-enabling/);
assertClassificationFact(enablingDetail, "Agent-enabling");
const enablingEntity = toolEntity(enablingDetail);
assert.equal(enablingEntity["@type"], "Service");
assertNoInventedAppClaims(enablingEntity);

const protocolDetail = await get("/tools/x402");
assert.match(detailHeroFor(protocolDetail, "x402"), /classification-badge[^>]*>[\s\S]*Agent internet protocol/);
assertClassificationFact(protocolDetail, "Agent internet protocol");
const protocolEntity = toolEntity(protocolDetail);
assert.equal(protocolEntity["@type"], "CreativeWork");
assert.ok(protocolEntity.genre.includes("Agent internet protocol"));
assertNoInventedAppClaims(protocolEntity);

const legacyDetail = await get("/tools/legacy-tool");
const legacyTitle = legacyDetail.match(/<h1 class="detail-title"[^>]*>Legacy Tool<\/h1>/);
assert.ok(legacyTitle, "legacy detail title missing");
assert.doesNotMatch(legacyDetail.slice(legacyTitle.index, legacyTitle.index + 500), /classification-badge/);
assert.equal(toolEntity(legacyDetail)["@type"], "Service");
assertNoInventedAppClaims(toolEntity(legacyDetail));

const policy = await get("/policy");
assert.match(policy, /Agent-native/);
assert.match(policy, /Agent-enabling/);
assert.match(policy, /Agent internet protocol/);
assert.match(policy, /evidence/i);
assert.match(policy, /does not qualify/i);

for (const path of ["/about", "/editorial-standards", "/corrections", "/open-source-ai-agent-tools", "/research/state-of-agent-first-infrastructure"] ) {
  const page = await get(path);
  const pageType = path === "/about"
    ? "AboutPage"
    : path === "/open-source-ai-agent-tools"
      ? "CollectionPage"
      : "WebPage";
  assert.ok(schemaOfType(page, pageType), `${path} ${pageType} schema missing`);
  assert.ok(schemaOfType(page, "BreadcrumbList"), `${path} breadcrumb schema missing`);
}

const sitemap = await get("/sitemap-pages.xml");
for (const path of [
  "/about",
  "/editorial-standards",
  "/policy",
  "/corrections",
  "/open-source-ai-agent-tools",
  "/research/state-of-agent-first-infrastructure",
  "/submit",
]) {
  assert.match(sitemap, new RegExp(`<loc>https://agentfirst\\.directory${path}</loc>`), path);
}

const jsonEndpoint = await request("/api/tools.json");
assert.match(jsonEndpoint.response.headers.get("content-type") ?? "", /^application\/json/);
assert.equal(jsonEndpoint.response.headers.get("x-robots-tag"), "index, follow");
const directoryData = JSON.parse(jsonEndpoint.body);
assert.equal(directoryData.schemaVersion, "1.0");
assert.equal(directoryData.canonicalUrl, "https://agentfirst.directory/api/tools.json");
assert.match(directoryData.reuseTerms.url, /\/editorial-standards#data-reuse$/);
assert.equal(directoryData.count, 4);
assert.equal(directoryData.tools.length, 4);
const hermesRecord = directoryData.tools.find((tool) => tool.slug === "hermes-agent");
assert.equal(hermesRecord.evidenceSources.length, 1);
assert.match(hermesRecord.classificationRationaleMd, /core actor/);
assert.match(hermesRecord.limitationsMd, /benchmark/);

const csvEndpoint = await request("/data/agent-first-tools.csv");
assert.match(csvEndpoint.response.headers.get("content-type") ?? "", /^text\/csv/);
assert.equal(csvEndpoint.response.headers.get("x-robots-tag"), "index, follow");
assert.match(csvEndpoint.body, /^"slug","name","profile_url"/);
assert.match(csvEndpoint.body, /"x402"/);
assert.match(csvEndpoint.body, /Hermes Agent documentation/);

const openSourceHub = await get("/open-source-ai-agent-tools");
assert.match(openSourceHub, /<h1 class="page-title">Open-source AI agent tools<\/h1>/);
assert.match(cardFor(openSourceHub, "hermes-agent"), /Hermes Agent/);
assert.doesNotMatch(openSourceHub, /href="\/tools\/fiber"/);

const feed = await request("/feed.xml");
assert.match(feed.response.headers.get("content-type") ?? "", /^application\/rss\+xml/);
assert.match(feed.body, /<rss version="2\.0">/);
assert.equal((feed.body.match(/<item>/g) ?? []).length, 4);

const llms = await request("/llms.txt");
assert.match(llms.response.headers.get("content-type") ?? "", /^text\/plain/);
assert.match(llms.body, /Published tools JSON/);
assert.match(llms.body, /Editorial standards and review methodology/);
const llmsFull = await request("/llms-full.txt");
assert.match(llmsFull.body, /## Hermes Agent/);
assert.match(llmsFull.body, /Use the canonical profile URL when citing a listing/);
assert.match(llmsFull.body, /Why it qualifies: Agents are the runtime/);
assert.match(llmsFull.body, /Limitations: No independent performance benchmark/);

const missing = await request("/tools/not-a-real-tool", { status: 404 });
assert.match(missing.body, /<meta name="robots" content="noindex, follow">/);
const gone = await request("/retired-directory-page", { status: 410 });
assert.match(gone.body, /<meta name="robots" content="noindex, follow">/);
const redirect = await request("/old-hermes", { status: 301, redirect: "manual" });
assert.equal(redirect.response.headers.get("location"), "/tools/hermes-agent");

const cardFallback = await request("/media/tools/legacy-tool/card", { status: 307, redirect: "manual" });
assert.equal(cardFallback.response.headers.get("location"), "/favicon.svg");
const heroFallback = await request("/media/tools/legacy-tool/hero", { status: 307, redirect: "manual" });
assert.equal(heroFallback.response.headers.get("location"), "/og-default.png");

console.log("Rendered SEO assertions passed for metadata, schema graphs, discovery endpoints, sitemaps, and error/redirect handling.");
