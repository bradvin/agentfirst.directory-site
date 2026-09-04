import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";
const canonicalOrigin = "https://agentfirst.directory";

function matches(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

function decodeAttribute(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

async function requestPublicUrl(publicUrl, options = {}) {
  const target = new URL(publicUrl, canonicalOrigin);
  const localUrl = new URL(`${target.pathname}${target.search}`, baseUrl);
  const headers = new Headers(options.headers);
  headers.set("Cache-Control", "no-cache");
  return fetch(localUrl, { redirect: "manual", ...options, headers });
}

async function getText(publicUrl, expectedType) {
  const response = await requestPublicUrl(publicUrl);
  const body = await response.text();
  assert.equal(response.status, 200, `${publicUrl} returned ${response.status}`);
  if (expectedType) {
    assert.match(
      response.headers.get("content-type") ?? "",
      expectedType,
      `${publicUrl} returned an unexpected content type`,
    );
  }
  return body;
}

function sitemapLocations(xml) {
  return matches(xml, /<loc>([^<]+)<\/loc>/g).map((value) => decodeAttribute(value.trim()));
}

const sitemapIndex = await getText("/sitemap-index.xml", /(?:application|text)\/xml/);
const childSitemaps = sitemapLocations(sitemapIndex);
assert.ok(childSitemaps.length >= 3, "sitemap index must expose separate child sitemaps");
assert.equal(new Set(childSitemaps).size, childSitemaps.length, "sitemap index contains duplicates");

const publicPageUrls = [];
for (const sitemapUrl of childSitemaps) {
  const sitemap = await getText(sitemapUrl, /(?:application|text)\/xml/);
  publicPageUrls.push(...sitemapLocations(sitemap));
}

assert.ok(publicPageUrls.length > 0, "child sitemaps did not expose any public pages");
assert.equal(new Set(publicPageUrls).size, publicPageUrls.length, "a page appears in more than one sitemap");

const titles = new Map();
const descriptions = new Map();
const internalLinks = new Map();

for (const publicUrl of publicPageUrls) {
  const parsedPublicUrl = new URL(publicUrl);
  assert.equal(parsedPublicUrl.origin, canonicalOrigin, `${publicUrl} uses the wrong sitemap origin`);
  assert.equal(parsedPublicUrl.hash, "", `${publicUrl} contains a sitemap fragment`);
  assert.equal(parsedPublicUrl.search, "", `${publicUrl} contains sitemap query parameters`);

  const html = await getText(publicUrl, /^text\/html/);
  assert.match(html, /<html\b[^>]*\blang="en"/i, `${publicUrl} is missing lang=en`);
  assert.doesNotMatch(
    html,
    /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i,
    `${publicUrl} is indexable in the sitemap but emits noindex`,
  );

  const pageTitles = matches(html, /<title>([\s\S]*?)<\/title>/gi).map((value) => value.trim());
  assert.equal(pageTitles.length, 1, `${publicUrl} must have exactly one title`);
  assert.ok(pageTitles[0].length >= 10 && pageTitles[0].length <= 70, `${publicUrl} title length is ${pageTitles[0].length}`);
  assert.equal(titles.get(pageTitles[0]), undefined, `${publicUrl} duplicates the title used by ${titles.get(pageTitles[0])}`);
  titles.set(pageTitles[0], publicUrl);

  const pageDescriptions = matches(
    html,
    /<meta\b[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/gi,
  ).map(decodeAttribute);
  assert.equal(pageDescriptions.length, 1, `${publicUrl} must have exactly one meta description`);
  assert.ok(
    pageDescriptions[0].length >= 50 && pageDescriptions[0].length <= 165,
    `${publicUrl} meta description length is ${pageDescriptions[0].length}`,
  );
  assert.equal(
    descriptions.get(pageDescriptions[0]),
    undefined,
    `${publicUrl} duplicates the description used by ${descriptions.get(pageDescriptions[0])}`,
  );
  descriptions.set(pageDescriptions[0], publicUrl);

  const canonicals = matches(html, /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/gi);
  assert.deepEqual(canonicals, [publicUrl], `${publicUrl} must emit an exact HTTPS self-canonical`);
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, `${publicUrl} must have exactly one H1`);

  const jsonLd = matches(
    html,
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  assert.ok(jsonLd.length > 0, `${publicUrl} is missing JSON-LD`);
  jsonLd.forEach((document, index) => {
    assert.doesNotThrow(() => JSON.parse(document), `${publicUrl} JSON-LD document ${index + 1} is invalid`);
  });

  if (parsedPublicUrl.pathname.startsWith("/tools/")) {
    assert.match(html, /id="overview"/, `${publicUrl} is missing its overview anchor`);
    assert.match(html, /id="why-this-qualifies"/, `${publicUrl} is missing its qualification anchor`);
    assert.match(html, /id="fit-and-limitations"/, `${publicUrl} is missing its limitations anchor`);
    assert.match(html, /id="sources"/, `${publicUrl} is missing its evidence anchor`);
    assert.match(html, /id="verified-facts"/, `${publicUrl} is missing its facts anchor`);
    assert.match(html, /documentation reviewed/i, `${publicUrl} is missing its visible review status`);
    assert.doesNotMatch(html, /Evidence migration pending/i, `${publicUrl} still exposes migration copy`);
  }

  if (parsedPublicUrl.pathname.startsWith("/category/")) {
    assert.match(html, /id="definition"/, `${publicUrl} is missing its definition anchor`);
    assert.match(html, /id="inclusion-criteria"/, `${publicUrl} is missing its inclusion anchor`);
    assert.match(html, /id="how-to-choose"/, `${publicUrl} is missing its selection anchor`);
    assert.match(html, /id="category-sources"/, `${publicUrl} is missing category sources`);
    assert.match(html, /id="comparison"/, `${publicUrl} is missing its comparison table`);
  }

  for (const property of ["og:title", "og:description", "og:url", "og:image", "og:image:alt"]) {
    assert.match(
      html,
      new RegExp(`<meta\\b[^>]*property="${property}"[^>]*content="[^"]+"[^>]*>`, "i"),
      `${publicUrl} is missing ${property}`,
    );
  }

  for (const rawHref of matches(html, /<a\b[^>]*href="([^"]+)"[^>]*>/gi)) {
    const href = decodeAttribute(rawHref.trim());
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }

    const target = new URL(href, publicUrl);
    if (target.origin !== canonicalOrigin) continue;
    target.hash = "";
    const key = `${target.pathname}${target.search}`;
    const sources = internalLinks.get(key) ?? new Set();
    sources.add(publicUrl);
    internalLinks.set(key, sources);
  }
}

const toolSitemapUrls = publicPageUrls.filter((url) => new URL(url).pathname.startsWith("/tools/"));
const dataResponse = await requestPublicUrl("/api/tools.json");
const directoryData = await dataResponse.json();
assert.equal(dataResponse.status, 200, "/api/tools.json must return 200");
assert.equal(directoryData.count, toolSitemapUrls.length, "JSON export and tool sitemap counts differ");
assert.equal(directoryData.tools.length, toolSitemapUrls.length, "JSON export tools and sitemap counts differ");
assert.deepEqual(
  new Set(directoryData.tools.map((tool) => `${canonicalOrigin}/tools/${tool.slug}`)),
  new Set(toolSitemapUrls),
  "JSON export and tool sitemap contain different records",
);
for (const tool of directoryData.tools) {
  assert.ok(tool.evidenceSources.length > 0, `${tool.slug} has no evidence in the JSON export`);
  assert.equal(tool.verificationLevel, "documentation-reviewed", `${tool.slug} has an unsupported review level`);
  assert.ok(tool.classificationRationaleMd, `${tool.slug} has no qualification rationale in the JSON export`);
  assert.ok(tool.bestForMd, `${tool.slug} has no best-fit guidance in the JSON export`);
  assert.ok(tool.limitationsMd, `${tool.slug} has no limitations in the JSON export`);
  assert.ok(
    tool.evidenceSources.every((source) => source.url && source.claim && source.accessedAt),
    `${tool.slug} has incomplete evidence in the JSON export`,
  );
}

const feed = await getText("/feed.xml", /^application\/rss\+xml/);
assert.equal((feed.match(/<item>/g) ?? []).length, toolSitemapUrls.length, "RSS and tool sitemap counts differ");

for (const [path, sources] of internalLinks) {
  const response = await requestPublicUrl(path);
  await response.arrayBuffer();
  assert.equal(
    response.status,
    200,
    `${path} linked from ${[...sources].join(", ")} returned ${response.status}`,
  );
  assert.equal(response.headers.get("location"), null, `${path} is an internal redirect target`);
}

console.log(
  `Rendered SEO crawl passed for ${publicPageUrls.length} sitemap pages and ${internalLinks.size} unique internal links.`,
);
