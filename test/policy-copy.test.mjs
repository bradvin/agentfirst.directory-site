import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { editorialPolicy, categoryEditorialEntries } from "../src/lib/category-editorial.ts";
import { formatClassification } from "../src/lib/classification.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\s+/gu, " ").trim();

// Reviewer regressions: these remain source-copy assertions, not an eligibility evaluator.
test("Run control is route-conditional and portable standards keep an existing classification", () => {
  assert.match(read("src/pages/policy.astro"), /offering claiming Run must establish Run control/);
  assert.doesNotMatch(read("src/pages/policy.astro"), /runtime\/control-plane shape must establish Run control/);
  for (const path of ["src/pages/submit.astro", "public/SKILL.md"]) {
    assert.match(read(path), /agent-internet-protocol[^\n]*maintained, implementable protocol or standard[^\n]*portable agent representation across systems/);
    assert.doesNotMatch(read(path), /An open protocol lets agents/);
  }
});
const policy = read("src/pages/policy.astro");
const standards = read("src/pages/editorial-standards.astro");
const skill = read("public/SKILL.md");
const readme = read("README.md");

// These are copy/wiring regressions, not executable evaluator-behavior tests.
for (const [name, source] of [["policy", policy], ["standards", standards], ["skill", skill], ["README", readme]]) {
  test(`${name}: all three eligibility routes and broad Equip requirements are explicit`, () => {
    for (const route of ["Run", "Equip", "Enable"]) assert.ok(source.includes(route));
    assert.match(source, /concrete agent task or improvement/);
    assert.match(source, /named (?:product |agent-specific )?features/);
    assert.match(source, /does not (?:have to|require).*?(?:infrastructure|execution)/i);
    assert.match(source, /human-operated|human–agent collaboration/);
    assert.match(source, /maintained agent-focused librar/i);
    assert.match(source, /connector/i);
    assert.match(source, /data|context/);
  });
  test(`${name}: bounded positioning precedes evidence; failed/unclear fit stops`, () => {
    for (const verdict of ["pass-fit", "fail-fit", "unclear-fit"]) assert.ok(source.includes(verdict));
    assert.match(source, /at most two short first-party positioning excerpts/);
    assert.match(source, /evidence not reviewed/);
    assert.match(source, /(?:contradiction|uncertain).*?hold/i);
    assert.match(source, /full (?:first-party )?evidence, schema, and contradiction review/);
    assert.doesNotMatch(source, /canonical homepage positioning if necessary/);
  });
  test(`${name}: generic compatibility and standalone packs remain excluded`, () => {
    assert.match(source, /compatibility alone|compatibility-only/i);
    assert.match(source, /[Ss]tandalone prompt packs, skill files, templates and one-off scripts/);
    assert.doesNotMatch(source, /human-first app with REST, MCP, or SDK access|internal autonomous agents alone qualify|infrastructure or builder tooling designed for agent operation/i);
  });
  test(`${name}: Enable contract and Run customer-control uncertainty cannot be inferred`, () => {
    assert.match(source, /first-class participants/);
    assert.match(source, /shared contract/);
    assert.match(source, /portable (?:agent )?representation/);
    assert.match(source, /protocol.*?(?:harness|SDK)/i);
    assert.match(source, /approv(?:ing|al).*?(?:finished|output|result).*?(?:not|insufficient)/i);
  });
}

test("policy routes remain distinct from existing classifications and scoped orchestrator rules", () => {
  assert.deepEqual(["agent-native", "agent-enabling", "agent-internet-protocol"].map(formatClassification), ["Agent-native", "Agent-enabling", "Agent internet protocol"]);
  assert.match(policy, /eligibility routes, not classification values/);
  assert.match(policy, /Run-specific.*?not.*?Equip or Enable/);
  assert.match(policy, /Historical reassessments and public corrections require separate owner approval/);
  assert.equal(editorialPolicy.version, "0.3");
  assert.equal(editorialPolicy.effectiveDate, "2026-11-22");
  assert.equal(editorialPolicy.sourceUrl, "https://github.com/bradvin/agentfirst.directory/issues/125");
});

test("machine-readable summaries publish broad routes and link the canonical policy", () => {
  for (const path of ["src/pages/llms.txt.ts", "src/pages/llms-full.txt.ts"]) {
    const source = read(path);
    assert.match(source, /policySummary/);
    assert.match(source, /https:\/\/agentfirst.directory\/policy/);
  }
});

test("submission guidance retains prompt-only controls and a review/publish pause", () => {
  const submit = read("src/pages/submit.astro");
  for (const source of [submit, skill]) {
    assert.match(source, /review and publishing remain paused/);
    assert.match(source, /does not restart/);
  }
  assert.match(submit, /id="skill-copy-button"/);
  assert.match(submit, /id="announcement-x-handle"/);
  assert.doesNotMatch(submit, /<form|method="post"|fetch\(/i);
});

test("SaaS fallback permits maintained connectors without mandatory platform ownership", () => {
  const entry = categoryEditorialEntries.find(({slug}) => slug === "saas-tool-integration-platforms");
  assert.doesNotMatch(entry.excludeWhen.join(" "), /only one product integration/);
  assert.doesNotMatch(entry.includeWhen.join(" "), /Authentication, user authorization, and action execution are handled/);
  assert.match(entry.includeWhen.join(" "), /named features/i);
  assert.match(read("src/pages/category/[category].astro"), /eligibility routes/);
});

for (const [shape, route, description] of [
  ["looot-shaped maintained connectors", "Equip", /connector\/catalogue tools/],
  ["Agentation-shaped human feedback", "Equip", /structured feedback/],
  ["maintained agent-focused library", "Equip", /maintained agent-focused libraries/],
  ["human-operated context and data tools", "Equip", /[Hh]uman-operated context capture/],
  ["x402-shaped agent payments contract", "Enable", /[Aa]gent payments/],
  ["AG-UI-shaped interaction contract", "Enable", /agent-to-application events/],
]) {
  test(`policy copy preserves ${route} scope for ${shape} without accepting a product`, () => {
    assert.ok(policy.includes(`<strong>${route}:</strong>`));
    assert.match(policy, description);
  });
}
