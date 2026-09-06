import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const homepageSource = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");

test("homepage renders the selected directory workspace production structure", () => {
  assert.match(homepageSource, /pageClass="homepage-workspace-page"/);
  assert.match(homepageSource, /class="homepage-intro"/);
  assert.match(homepageSource, /The directory for[\s\S]*agent-first[\s\S]*AI tools/);
  assert.match(homepageSource, /href="\/submit"/);
  assert.match(homepageSource, /href="\/policy"/);
  assert.match(homepageSource, /class="homepage-workspace"/);
  assert.match(homepageSource, /<CategoryFilters categories=\{categories\} tools=\{toolCards\} \/>/);
  assert.match(homepageSource, /<ToolList tools=\{toolCards\} variant="workspace" searchable \/>/);
  assert.doesNotMatch(homepageSource, /CategoryChips/);
});