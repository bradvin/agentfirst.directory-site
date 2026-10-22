import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { editorialPolicy } from "../src/lib/category-editorial.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\s+/gu, " ").trim();
const policy = read("src/pages/policy.astro");
const standards = read("src/pages/editorial-standards.astro");
const readme = read("README.md");

test("policy defines built-for-agents fit before evidence, retaining acceptance requirements", () => {
  assert.match(policy, /Only tools built for agents belong in this directory\. Product fit is decided before evidence review/);
  assert.match(policy, /Passing fit is necessary, not acceptance/);
  assert.match(policy, /public evidence for its claimed role and fit exactly one classification/);
  assert.ok(policy.indexOf("Product fit before evidence") < policy.indexOf("Only after pass-fit"));
});

for (const [name, source] of [["policy", policy], ["standards", standards], ["README", readme]]) {
  test(`${name}: fit is bounded and nonpassing candidates stop`, () => {
    assert.match(source, /intended user, core job/);
    assert.match(source, /product description and operating model, plus canonical homepage positioning if necessary/);
    assert.match(source, /(?:not|Do not inspect) evidence arrays, (?:documentation|docs), MCP details, implementation, pricing, licence, or validation/);
    for (const verdict of ["pass-fit", "fail-fit", "unclear-fit"]) assert.ok(source.includes(verdict));
    assert.match(source, /nonacceptance/);
    assert.match(source, /positioning clarification/);
    assert.match(source, /evidence review, metadata enrichment, or listing commits|do not review evidence, enrich metadata, or commit listing changes/);
    assert.match(source, /full (?:first-party )?evidence, schema, and contradiction review/);
  });

  test(`${name}: agent-enabling and human-facing AI cannot bypass product fit`, () => {
    assert.match(source, /human-first app with REST, MCP, or SDK access/i);
    assert.match(source, /integration depth or tool count/);
    assert.match(source, /An AI agent serving humans is not, by itself, a tool built for agents/);
    assert.match(source, /Agent-oriented infrastructure, protocols, and agent-builder tools/);
    assert.match(source, /designed for agent operation/);
    assert.match(source, /exclusive agent use or agent-only origins/);
  });
}

test("policy supersedes stale guidance without authorizing historical changes", () => {
  assert.match(policy, /takes precedence over category or contribution guidance/);
  assert.match(policy, /internal autonomous agents alone qualify/);
  assert.match(policy, /Historical reassessments and public corrections require separate owner approval/);
  assert.match(policy, /authorizes no existing-listing changes/);
  assert.equal(editorialPolicy.version, "1.1");
  assert.equal(editorialPolicy.effectiveDate, "2026-10-22");
});

test("policy retains the coding-agent orchestrator lifecycle boundary after fit", () => {
  assert.match(policy, /A coding-agent orchestrator qualifies only when the system owns a material lifecycle across agent runs\. Evidence must show task assignment, isolation, retained or shared state or validation evidence, and a completion, review, or landing gate separate from execution\. Merely launching a single agent, supplying prompts, wrapping an API or MCP server, adding agent compatibility, or providing ordinary developer automation is insufficient\./);
});
