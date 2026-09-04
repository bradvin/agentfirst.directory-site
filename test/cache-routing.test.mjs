import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cacheControl,
  getSharedCachePolicy,
  sharedCachePolicies,
} from "../src/lib/cache.ts";

test("shared HTML and sitemap routes receive their intended cache policy", () => {
  assert.strictEqual(getSharedCachePolicy("/"), sharedCachePolicies.homepage);
  assert.strictEqual(getSharedCachePolicy("/category/protocols"), sharedCachePolicies.category);
  assert.strictEqual(getSharedCachePolicy("/category/protocols/"), sharedCachePolicies.category);
  assert.strictEqual(getSharedCachePolicy("/open-source-ai-agent-tools"), sharedCachePolicies.category);
  assert.strictEqual(getSharedCachePolicy("/tools/x402"), sharedCachePolicies.tool);

  for (const path of [
    "/sitemap-index.xml",
    "/sitemap-pages.xml",
    "/sitemap-categories.xml",
    "/sitemap-tools.xml",
  ]) {
    assert.strictEqual(getSharedCachePolicy(path), sharedCachePolicies.sitemap, path);
  }
});

test("AI discovery, feed, and downloadable data routes share the data policy", () => {
  for (const path of [
    "/api/tools.json",
    "/data/agent-first-tools.csv",
    "/feed.xml",
    "/llms.txt",
    "/llms-full.txt",
  ]) {
    assert.strictEqual(getSharedCachePolicy(path), sharedCachePolicies.data, path);
  }

  assert.equal(sharedCachePolicies.data.cacheControl, cacheControl.data);
  assert.equal(sharedCachePolicies.data.cdnCacheControl, cacheControl.dataCdn);
  assert.equal(sharedCachePolicies.data.edgeTtlSeconds, 900);
});

test("private, interactive, malformed, and unknown paths are not shared-cache candidates", () => {
  for (const path of [
    "/submit",
    "/about",
    "/tools",
    "/tools/x402/more",
    "/category",
    "/category/protocols/more",
    "/api/unknown.json",
    "/favicon.ico",
  ]) {
    assert.equal(getSharedCachePolicy(path), undefined, path);
  }
});
