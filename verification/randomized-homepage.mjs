import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";

async function get(path) {
  const response = await fetch(new URL(path, baseUrl));
  const body = await response.text();
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return { response, body };
}

function toolCardSlugs(html) {
  return [...html.matchAll(/<article\b[^>]*class="[^"]*\bcard\b[^"]*"[^>]*>[\s\S]*?<a[^>]+href="\/tools\/([^"]+)"/g)]
    .map((match) => match[1]);
}

function jsonLdDocuments(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

const expectedHomepageSlugs = ["fiber", "hermes-agent", "legacy-tool", "x402"];
const homepageOrders = [];
for (let attempt = 0; attempt < 8; attempt += 1) {
  const homepage = await get(`/?verification=${attempt}`);
  const homepageSlugs = toolCardSlugs(homepage.body);
  assert.deepEqual([...homepageSlugs].sort(), expectedHomepageSlugs);
  assert.equal(homepage.response.headers.get("cache-control"), "public, s-maxage=300, stale-while-revalidate=86400");

  const itemList = jsonLdDocuments(homepage.body).find((document) => document["@type"] === "ItemList");
  assert.ok(itemList, "homepage ItemList JSON-LD missing");
  const jsonLdSlugs = itemList.itemListElement.map((item) => new URL(item.url).pathname.split("/").at(-1));
  assert.deepEqual(jsonLdSlugs, homepageSlugs, "JSON-LD order must match rendered homepage cards");
  homepageOrders.push(homepageSlugs.join(","));

  if (new Set(homepageOrders).size > 1) break;
}
assert.ok(new Set(homepageOrders).size > 1, "uncached local homepage requests did not produce two distinct permutations");

const category = await get("/category/agent-infrastructure");
assert.deepEqual(toolCardSlugs(category.body), ["hermes-agent", "fiber", "legacy-tool"]);
const repeatedCategory = await get("/category/agent-infrastructure?verification=repeat");
assert.deepEqual(toolCardSlugs(repeatedCategory.body), ["hermes-agent", "fiber", "legacy-tool"]);

const detail = await get("/tools/hermes-agent");
const relatedStart = detail.body.indexOf(">Related tools</h2>");
assert.notEqual(relatedStart, -1, "related tools section missing");
const relatedSlugs = toolCardSlugs(detail.body.slice(relatedStart));
assert.deepEqual(relatedSlugs, ["fiber", "legacy-tool"]);
const repeatedDetail = await get("/tools/hermes-agent?verification=repeat");
const repeatedRelatedStart = repeatedDetail.body.indexOf(">Related tools</h2>");
assert.notEqual(repeatedRelatedStart, -1, "repeated related tools section missing");
assert.deepEqual(toolCardSlugs(repeatedDetail.body.slice(repeatedRelatedStart)), relatedSlugs);

const sitemap = await get("/sitemap-tools.xml");
const sitemapSlugs = [...sitemap.body.matchAll(/<loc>https:\/\/agentfirst\.directory\/tools\/([^<]+)<\/loc>/g)]
  .map((match) => match[1]);
assert.deepEqual(sitemapSlugs, ["fiber", "hermes-agent", "legacy-tool", "x402"]);

console.log("Randomized homepage assertions passed: permutation, JSON-LD parity, cache, and deterministic non-homepage paths.");
