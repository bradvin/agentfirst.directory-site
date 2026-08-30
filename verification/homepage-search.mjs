import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";

async function get(path) {
  const response = await fetch(new URL(path, baseUrl));
  const body = await response.text();
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return body;
}

const homepage = await get("/");
assert.match(homepage, /<label[^>]*for="homepage-search"[^>]*>\s*Search tools\s*<\/label>/);
assert.match(homepage, /<input[^>]*id="homepage-search"[^>]*type="search"/);
assert.match(homepage, /<[^>]+aria-live="polite"[^>]*>/);
assert.match(homepage, /data-search-empty[^>]*hidden/);
assert.match(
  homepage,
  /<article[^>]*data-search-text="hermes agent an autonomous agent runtime agent infrastructure agents runtime"[^>]*>/,
);
assert.doesNotMatch(homepage, /<article[^>]*data-search-text=[^>]*hidden/);
assert.match(homepage, /Search requires JavaScript\. All tools are listed below\./);

const category = await get("/category/agent-infrastructure");
assert.doesNotMatch(category, /id="homepage-search"/);
assert.doesNotMatch(category, /data-search-text=/);

const detail = await get("/tools/hermes-agent");
assert.doesNotMatch(detail, /id="homepage-search"/);
assert.doesNotMatch(detail, /data-search-text=/);

console.log("Homepage search accessibility and route-scope assertions passed.");
