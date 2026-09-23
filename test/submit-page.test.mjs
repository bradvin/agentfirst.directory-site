import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const submitPage = await readFile(new URL("../src/pages/submit.astro", import.meta.url), "utf8");

test("submit page directs visitors to their agent and the content PR", () => {
  assert.match(submitPage, /Give your agent the instructions/);
  assert.match(submitPage, /href=\{skillUrl\}/);
  assert.match(submitPage, /href=\{contentRepoUrl\}/);
  assert.match(submitPage, /Editors verify source ownership, claim support, and directory eligibility/);
  assert.doesNotMatch(submitPage, /<form\b|publicContributorWorkflow|Browser fallback|Add a tool markdown file/);
});

test("submit copy prompt and interaction remain exact", () => {
  const prompt = "Read https://agentfirst.directory/SKILL.md to add a new tool";
  assert.equal(prompt.length, 60);
  assert.match(submitPage, new RegExp(`const skillCopyText = "${prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`));
  assert.match(submitPage, /data-copy-text=\{skillCopyText\}/);
  assert.match(submitPage, /navigator\.clipboard\.writeText\(text\)/);
});
