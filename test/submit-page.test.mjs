import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const submitPage = await readFile(new URL("../src/pages/submit.astro", import.meta.url), "utf8");
const globalCss = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("submit grids allow long content to shrink without disabling local code scrolling", () => {
  assert.match(
    globalCss,
    /\.submit-shell,\s*\.submit-panel,\s*\.submit-grid\s*>\s*\*,\s*\.submit-code-grid\s*>\s*\*\s*\{[^}]*min-width:\s*0;/s,
  );
  assert.match(globalCss, /\.code-block\s*\{[^}]*overflow-x:\s*auto;/s);
});

test("submit code scrollers are keyboard focusable and labelled", () => {
  const codeBlocks = [...submitPage.matchAll(/<pre class="code-block"([^>]*)>/g)];
  const allPreBlocks = [...submitPage.matchAll(/<pre\b/g)];
  assert.ok(codeBlocks.length > 0);
  assert.equal(codeBlocks.length, allPreBlocks.length);

  for (const [, attributes] of codeBlocks) {
    assert.match(attributes, /\btabindex="0"/);
    assert.match(attributes, /\baria-label="[^"]+"/);
  }
});

test("submit copy prompt and interaction remain exact", () => {
  const prompt = "Read https://agentfirst.directory/SKILL.md to add a new tool";
  assert.equal(prompt.length, 60);
  assert.match(submitPage, new RegExp(`const skillCopyText = "${prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`));
  assert.match(submitPage, /data-copy-text=\{skillCopyText\}/);
  assert.match(submitPage, /navigator\.clipboard\.writeText\(text\)/);
});
