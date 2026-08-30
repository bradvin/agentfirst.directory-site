import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";

async function get(path) {
  const response = await fetch(new URL(path, baseUrl));
  const body = await response.text();
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return body;
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

function softwareApplication(html) {
  return jsonLdDocuments(html)
    .flatMap((document) => (Array.isArray(document) ? document : [document]))
    .find((document) =>
      Array.isArray(document?.["@type"])
        ? document["@type"].includes("SoftwareApplication")
        : document?.["@type"] === "SoftwareApplication",
    );
}

const homepage = await get("/");
assert.match(cardFor(homepage, "hermes-agent"), /Agent-native/);
assert.match(cardFor(homepage, "fiber"), /Agent-enabling/);
assert.match(cardFor(homepage, "x402"), /Agent internet protocol/);
assert.doesNotMatch(cardFor(homepage, "legacy-tool"), /classification-badge/);
assert.match(homepage, /three classifications/i);
assert.ok((homepage.match(/href="\/policy"/g) ?? []).length >= 3, "policy links missing from header, summary, or footer");

const category = await get("/category/agent-infrastructure");
assert.match(cardFor(category, "fiber"), /Agent-enabling/);

const nativeDetail = await get("/tools/hermes-agent");
assert.match(detailHeroFor(nativeDetail, "Hermes Agent"), /classification-badge[^>]*>[\s\S]*Agent-native/);
assertClassificationFact(nativeDetail, "Agent-native");
assert.match(cardFor(nativeDetail, "fiber"), /Agent-enabling/);
assert.doesNotMatch(cardFor(nativeDetail, "legacy-tool"), /classification-badge/);
assert.equal(
  softwareApplication(nativeDetail).additionalProperty[0].value,
  "Agent-native",
);

const enablingDetail = await get("/tools/fiber");
assert.match(detailHeroFor(enablingDetail, "Fiber"), /classification-badge[^>]*>[\s\S]*Agent-enabling/);
assertClassificationFact(enablingDetail, "Agent-enabling");
assert.equal(
  softwareApplication(enablingDetail).additionalProperty[0].value,
  "Agent-enabling",
);

const protocolDetail = await get("/tools/x402");
assert.match(detailHeroFor(protocolDetail, "x402"), /classification-badge[^>]*>[\s\S]*Agent internet protocol/);
assertClassificationFact(protocolDetail, "Agent internet protocol");
assert.equal(
  softwareApplication(protocolDetail).additionalProperty[0].value,
  "Agent internet protocol",
);

const legacyDetail = await get("/tools/legacy-tool");
const legacyTitle = legacyDetail.match(/<h1 class="detail-title"[^>]*>Legacy Tool<\/h1>/);
assert.ok(legacyTitle, "legacy detail title missing");
assert.doesNotMatch(legacyDetail.slice(legacyTitle.index, legacyTitle.index + 500), /classification-badge/);
assert.equal(softwareApplication(legacyDetail).additionalProperty, undefined);

const policy = await get("/policy");
assert.match(policy, /Agent-native/);
assert.match(policy, /Agent-enabling/);
assert.match(policy, /Agent internet protocol/);
assert.match(policy, /evidence/i);
assert.match(policy, /does not qualify/i);

const sitemap = await get("/sitemap-pages.xml");
assert.match(sitemap, /<loc>https:\/\/agentfirst\.directory\/policy<\/loc>/);

console.log("Rendered UI assertions passed for homepage, category, compact related cards, four details, policy, sitemap, and JSON-LD.");
