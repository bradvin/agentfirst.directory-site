import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const policySource = readFileSync(new URL("../src/pages/policy.astro", import.meta.url), "utf8");
const editorialStandardsSource = readFileSync(
  new URL("../src/pages/editorial-standards.astro", import.meta.url),
  "utf8",
);

function normalizeWhitespace(source) {
  return source.replace(/\s+/gu, " ").trim();
}

test("policy definition states the approved eligibility boundary and keeps its evidence and classification requirements", () => {
  assert.match(
    normalizeWhitespace(policySource),
    /We include products, infrastructure, and protocols that give AI agents a material role or capability\. Each listing must have public evidence for its claimed role and fit exactly one classification\./u,
  );
});

test("editorial scope states the approved causal standard for every actor", () => {
  assert.match(
    normalizeWhitespace(editorialStandardsSource),
    /The reviewer states what an agent, agent builder, or interoperable agent system can do with the product or protocol, and why that capability is material\./u,
  );
});
