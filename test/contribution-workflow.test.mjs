import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const skillDocument = readFileSync(new URL("../public/SKILL.md", import.meta.url), "utf8");

function extractSkillWorkflow(document) {
  return document.match(/### Public contributor workflow \(default\)[\s\S]*?```bash\n([\s\S]*?)\n```/)?.[1];
}

test("public skill directs agents through a fork-based content PR", () => {
  const workflow = extractSkillWorkflow(skillDocument);
  assert.ok(workflow, "public skill must define the contributor workflow");

  for (const expected of [
    "gh auth status",
    "gh repo fork bradvin/agentfirst.directory --clone=false",
    'git remote add fork "https://github.com/${GH_USER}/agentfirst.directory.git"',
    "git push -u fork add-coolapi",
    "gh pr create --repo bradvin/agentfirst.directory --base main",
    '--head "${GH_USER}:add-coolapi"',
  ]) {
    assert.ok(workflow.includes(expected), `missing workflow step: ${expected}`);
  }

  assert.doesNotMatch(workflow, /git push (?:-u )?origin add-coolapi/);
});

test("public skill has a browser fallback without a collaborator shortcut", () => {
  const browserFallback = "https://github.com/bradvin/agentfirst.directory/compare/main...YOUR-USERNAME:add-coolapi?expand=1";

  assert.match(skillDocument, /Browser fallback/iu);
  assert.match(skillDocument, /Git authentication for HTTPS/iu);
  assert.match(skillDocument, /credential manager or personal access token/iu);
  assert.ok(skillDocument.includes(browserFallback));
  assert.doesNotMatch(skillDocument, /Collaborator shortcut/iu);
  assert.doesNotMatch(skillDocument, /git push (?:-u )?origin add-coolapi/iu);
});
