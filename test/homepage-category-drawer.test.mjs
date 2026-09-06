import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const categoryFiltersUrl = new URL("../src/components/CategoryFilters.astro", import.meta.url);
const categoryFiltersSource = existsSync(categoryFiltersUrl)
  ? readFileSync(categoryFiltersUrl, "utf8")
  : "";
const searchSource = readFileSync(
  new URL("../src/components/HomepageSearch.astro", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("mobile category drawer exposes an accessible toggle and labelled region", () => {
  assert.ok(categoryFiltersSource, "CategoryFilters component should exist");
  assert.match(categoryFiltersSource, /<nav/);
  assert.doesNotMatch(categoryFiltersSource, /<aside/);
  assert.match(searchSource, /aria-controls="homepage-category-filters"/);
  assert.match(searchSource, /aria-expanded="false"/);
  assert.match(searchSource, /data-category-toggle/);
  assert.match(categoryFiltersSource, /id="homepage-category-filters"/);
  assert.match(categoryFiltersSource, /aria-labelledby="homepage-category-heading"/);
  assert.match(categoryFiltersSource, /<h2[^>]*id="homepage-category-heading"/);
  assert.match(categoryFiltersSource, /data-category-filter="all"/);
  assert.match(searchSource, /event\.key === "Escape"/);
  assert.match(searchSource, /toggle\.focus\(\)/);
  assert.match(globalStyles, /\[data-category-toggle\]\[hidden\][\s\S]*display:\s*none\s*!important/);
  assert.match(globalStyles, /\[data-category-sidebar\]\[hidden\][\s\S]*display:\s*none\s*!important/);
});