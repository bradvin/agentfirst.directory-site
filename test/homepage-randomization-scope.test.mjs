import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const contentSource = readFileSync(new URL("../src/lib/content.ts", import.meta.url), "utf8");

function exportedFunctionBody(name) {
  const match = contentSource.match(
    new RegExp(`export async function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`),
  );
  assert.ok(match, `${name} function not found`);
  return match[1];
}

test("only getHomepageData randomizes the deterministic tool query result", () => {
  const homepageBody = exportedFunctionBody("getHomepageData");
  const categoryBody = exportedFunctionBody("getToolsByCategory");
  const toolBody = exportedFunctionBody("getToolBySlug");

  assert.match(homepageBody, /tools: shuffleCopy\(tools, random\)/);
  assert.doesNotMatch(categoryBody, /shuffleCopy/);
  assert.doesNotMatch(toolBody, /shuffleCopy/);
  assert.equal((contentSource.match(/shuffleCopy\(tools, random\)/g) ?? []).length, 1);
  assert.match(contentSource, /ORDER BY \$\{TOOL_ORDER\}/);
  assert.match(contentSource, /ORDER BY slug COLLATE NOCASE/g);
});
