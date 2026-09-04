import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const submitSource = readFileSync(new URL("../src/pages/submit.astro", import.meta.url), "utf8");
const skillDocument = readFileSync(new URL("../public/SKILL.md", import.meta.url), "utf8");

function extractSubmitWorkflow(source) {
  return source
    .match(/const publicContributorWorkflow = `([\s\S]*?)`;/)?.[1]
    ?.replaceAll("\\${", "${")
    .replaceAll("\\\\\n", "\\\n");
}

function extractSkillWorkflow(document) {
  return document.match(/### Public contributor workflow \(default\)[\s\S]*?```bash\n([\s\S]*?)\n```/)?.[1];
}

test("submit source and public skill share the same fork-based contributor workflow", () => {
  const submitWorkflow = extractSubmitWorkflow(submitSource);
  const skillWorkflow = extractSkillWorkflow(skillDocument);

  assert.ok(submitWorkflow, "submit page must define the public contributor workflow");
  assert.ok(skillWorkflow, "public skill must define the public contributor workflow");
  assert.equal(submitWorkflow, skillWorkflow);

  for (const expected of [
    "gh auth status",
    "gh repo fork bradvin/agentfirst.directory --clone=false",
    'git remote add fork "https://github.com/${GH_USER}/agentfirst.directory.git"',
    "git push -u fork add-coolapi",
    "gh pr create --repo bradvin/agentfirst.directory --base main",
    '--head "${GH_USER}:add-coolapi"',
  ]) {
    assert.match(submitWorkflow, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(submitWorkflow, /git push (?:-u )?origin add-coolapi/);
});

test("both public surfaces include browser fallback and a labelled collaborator shortcut", () => {
  const browserFallback = "https://github.com/bradvin/agentfirst.directory/compare/main...YOUR-USERNAME:add-coolapi?expand=1";

  for (const [surface, content] of [
    ["submit source", submitSource],
    ["public skill", skillDocument],
  ]) {
    assert.match(content, /Browser fallback/iu, `${surface} must label the browser fallback`);
    assert.match(content, /Git authentication for HTTPS/iu, `${surface} must require authenticated Git pushes`);
    assert.match(content, /credential manager or personal access token/iu, `${surface} must explain HTTPS authentication options`);
    assert.ok(content.includes(browserFallback), `${surface} must include the concrete browser PR URL`);
    assert.match(content, /Collaborator shortcut/iu, `${surface} must label the collaborator-only path`);
  }
});
