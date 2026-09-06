import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const openSourcePagePath = "src/pages/open-source-ai-agent-tools.astro";
const researchPagePath = "src/pages/research/state-of-agent-first-infrastructure.astro";

test("open-source collection uses the approved copy and retains licence caveats", () => {
  const source = read(openSourcePagePath);

  assert.match(source, /<h2>An open-source label does not cover everything<\/h2>/);
  assert.match(
    source,
    /This page includes all listings that are categorized as open source\./,
  );
  assert.match(
    source,
    /That label does not mean every asset,\s+hosted service, model, dependency, or trademark uses the same licence\./,
  );
  assert.match(
    source,
    /Check each profile's repository, licence\s+source, evidence date, and deployment notes before reuse\./,
  );
  assert.match(source, /<h2 id="open-source-list-heading">Browse open-source tools for AI agents<\/h2>/);
  assert.doesNotMatch(source, /—/u);
});

test("research page uses the approved copy and retains all three exclusions", () => {
  const source = read(researchPagePath);

  assert.match(
    source,
    /A live count of the directory's published records, with an explanation of what those records can show and what\s+they cannot show\./,
  );
  assert.match(
    source,
    /This is a taxonomy snapshot, not a ranking, adoption survey, or estimate of the whole market\./,
  );
  assert.match(source, /<h2>All category guidance written for the directory is public<\/h2>/);
  assert.doesNotMatch(source, /—/u);
});

test("copy edits preserve page titles, H1s, canonicals, and JSON-LD wiring", () => {
  const openSourceSource = read(openSourcePagePath);
  const researchSource = read(researchPagePath);

  assert.match(openSourceSource, /const title = "Open-source AI agent tools and infrastructure"/);
  assert.match(openSourceSource, /<h1 class="page-title">Open-source AI agent tools<\/h1>/);
  assert.match(openSourceSource, /canonicalPath=\{path\}/);
  assert.match(openSourceSource, /structuredData=\{structuredData\}/);
  assert.match(openSourceSource, /type: "CollectionPage"/);

  assert.match(researchSource, /const pageName = "State of Agent-First Infrastructure"/);
  assert.match(researchSource, /<h1 class="page-title">State of Agent-First Infrastructure<\/h1>/);
  assert.match(researchSource, /canonicalPath=\{path\}/);
  assert.match(researchSource, /structuredData=\{structuredData\}/);
  assert.match(researchSource, /type: "WebPage"/);
});
