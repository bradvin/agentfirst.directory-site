import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/pages/about.astro", import.meta.url), "utf8");
const visibleCopy = source
  .replace(/\{" · "\}/g, " · ")
  .replace(/\{" "\}/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .replace(/\s+([.,;:!?])/g, "$1")
  .trim();

const approvedOpening =
  "A public directory with an evidence-based inclusion test agentfirst.directory documents products, infrastructure, and protocols that give AI agents a material role or capability. It is a discovery resource. It is not a security certification, product endorsement, or complete census of the market.";
const approvedPublisher =
  "I publish and maintain agentfirst.directory. You can find me on GitHub as Brad Vincent (@bradvin) and on X as @bradvin. Community members can propose additions and corrections through the public content repository. Publication decisions remain subject to the same evidence-based inclusion policy.";
const approvedDefinition =
  "Why the directory uses a stricter definition Almost any API can be called by an agent. That alone does not make a product agent-first. The directory checks what the agent actually does, whether that role is material, and whether a maintained first-party source supports the claim. That keeps the taxonomy useful without excluding infrastructure agents depend on.";
const approvedRights =
  "Public access does not grant a separate data licence No separate open licence currently grants bulk republication of the directory's editorial copy or compiled data. The public repositories and live JSON/CSV exports make the work inspectable and citable; they do not by themselves change its reuse rights. Linking to pages and short attributed quotations are welcome. Product names, logos, documentation, and other vendor materials remain subject to their owners' terms. Any future immutable dataset release will publish explicit reuse terms alongside the download.";

test("About page renders the approved publisher voice without weakening editorial boundaries", () => {
  assert.ok(visibleCopy.includes(approvedOpening), "approved opening copy is missing");
  assert.ok(visibleCopy.includes(approvedPublisher), "approved publisher copy is missing");
  assert.ok(visibleCopy.includes(approvedDefinition), "approved definition copy is missing");
  assert.ok(visibleCopy.includes(approvedRights), "approved rights wording or unchanged rights body is missing");

  assert.match(source, /href=\{publisherUrl\}[^>]*>Brad Vincent \(@bradvin\)<\/a>/);
  assert.match(source, /href=\{publisherXUrl\}[^>]*>@bradvin<\/a>/);
  assert.match(source, /const contentRepoUrl = "https:\/\/github\.com\/bradvin\/agentfirst\.directory"/);
  assert.match(source, /href=\{contentRepoUrl\}[^>]*>public content repository<\/a>/);
  assert.doesNotMatch(
    visibleCopy,
    /I (?:personally )?(?:(?:review(?:ed|s)?|approv(?:e|ed|es))(?: and (?:review(?:ed|s)?|approv(?:e|ed|es)))?) (?:every|all) listing/i,
  );
  assert.doesNotMatch(source, /—/);
});
