import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("tool-profile public metadata uses colons instead of em dashes", () => {
  const toolPage = read("src/pages/tools/[slug].astro");

  assert.match(toolPage, /`\$\{tool\.entry\.name\}: \$\{tool\.category\.label\} \| AI Agent Tools`/);
  assert.match(toolPage, /socialImageAlt=\{tool \? `\$\{tool\.entry\.name\}: \$\{tool\.entry\.description\}`/);
  assert.doesNotMatch(toolPage, /tool\.entry\.(?:name|description)\} —/);
});

test("tool-profile labels and trust copy state evidence boundaries directly", () => {
  const toolPage = read("src/pages/tools/[slug].astro");

  for (const wording of [
    ">Overview</p>",
    ">About {tool.entry.name}</h2>",
    ">Listing decision</p>",
    ">Why {tool.entry.name} is listed</h2>",
    ">Before you choose</p>",
    ">Fit and limitations</h2>",
    ">Sources</p>",
    ">Sources and verification</h2>",
    ">Profile facts</h2>",
    "This summary uses submitted and public product material. Only source-mapped claims are documentation reviewed.",
    "First-party unless marked otherwise. Each link supports only its adjacent claim.",
    "No claim-level review or evidence mapping is recorded. Use these first-party links as starting points for verification.",
  ]) {
    assert.ok(toolPage.includes(wording), `missing direct wording: ${wording}`);
  }

  assert.match(toolPage, /documentation-reviewed": "Documentation reviewed"/);
  assert.match(toolPage, /vendor-confirmed": "Vendor confirmed"/);
  assert.match(toolPage, /hands-on-tested": "Hands-on tested"/);
  assert.match(toolPage, /: "Not reviewed"/);
  assert.match(toolPage, /under the directory's evidence-based inclusion policy/);
  assert.match(toolPage, /No claim-level listing rationale is recorded/);
  assert.doesNotMatch(toolPage, /migration (?:is )?pending/i);

  assert.match(toolPage, /\{limitationsHtml && <div><h3>Known limitations<\/h3>/);
  assert.match(toolPage, /\{unknownsHtml && <div><h3>Not yet verified<\/h3>/);
  assert.match(toolPage, /<a[^>]+href=\{source\.url\}[^>]*>\{source\.title\}<\/a>\s*<p>\{source\.claim\}<\/p>/);
  assert.match(toolPage, /source\.sourceType\?\.replaceAll/);
  assert.match(toolPage, /source\.accessedAt \? ` · accessed \$\{displayDate\(source\.accessedAt\)\}`/);
});

test("fit guidance and sources span the full tool-profile detail grid after the sidebar", () => {
  const toolPage = read("src/pages/tools/[slug].astro");
  const styles = read("src/styles/global.css");
  const contentStack = toolPage.match(/<div class="detail-content-stack">([\s\S]*?)<\/div>\s*<aside class="detail-sidebar">/)?.[1];

  assert.ok(contentStack, "tool-profile detail content stack was not found");
  assert.match(contentStack, /id="overview"/);
  assert.match(contentStack, /id="why-this-qualifies"/);
  assert.doesNotMatch(contentStack, /id="fit-and-limitations"|id="sources"/);
  assert.match(
    toolPage,
    /<\/aside>\s*\{[\s\S]*?class="detail-panel evidence-panel detail-full-span" id="fit-and-limitations"[\s\S]*?\}\s*<section class="detail-panel evidence-panel detail-full-span" id="sources"/,
  );
  assert.match(styles, /\.detail-full-span\s*\{\s*grid-column:\s*1\s*\/\s*-1;\s*\}/);
});

test("unavailable comments use a concise public message", () => {
  const comments = read("src/components/GiscusComments.astro");

  assert.match(comments, /<p class="comments-note">Comments are not available yet\.<\/p>/);
  assert.doesNotMatch(comments, /waiting on GitHub Discussions|repository\/category IDs|configured to use/i);
});

test("repeated tool-profile boilerplate is reduced by at least 40 percent", () => {
  // Method: count words in the repeated labels and trust/status sentences rendered on every
  // evidence-reviewed profile. Dynamic tool names are normalized to "Example Tool". Content-owned
  // body, rationale, fit, limitations, unknowns, source claims, links, and dates are excluded.
  const beforeSnippets = [
    "Listing overview",
    "What Example Tool provides",
    "This summary reflects the submitted listing and public product material. Only statements mapped to evidence in the source record below should be read as documentation-reviewed facts.",
    "Editorial verdict",
    "Why Example Tool qualifies as agent-first",
    "Decision guide",

    "Evidence record",
    "Sources and verification links",
    "Sources are first-party unless labeled otherwise. A linked source supports the specific claim shown beside it; it is not a blanket endorsement of every vendor claim.",
    "Verified profile facts",
    "documentation reviewed",
  ];
  const afterSnippets = [
    "Overview",
    "About Example Tool",
    "This summary uses submitted and public product material. Only source-mapped claims are documentation reviewed.",
    "Listing decision",
    "Why Example Tool is listed",
    "Before you choose",
    "Sources",
    "Sources and verification",
    "First-party unless marked otherwise. Each link supports only its adjacent claim.",
    "Profile facts",
    "Documentation reviewed",
  ];
  const words = (snippets) => (snippets.join(" ").match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? []).length;
  const before = words(beforeSnippets);
  const after = words(afterSnippets);
  const reduction = (before - after) / before;
  const toolPage = read("src/pages/tools/[slug].astro");

  for (const snippet of afterSnippets.filter((snippet) => snippet !== "Example Tool")) {
    const templateSnippet = snippet.replaceAll("Example Tool", "{tool.entry.name}");
    assert.ok(toolPage.includes(templateSnippet), `measured boilerplate is not rendered: ${templateSnippet}`);
  }
  assert.equal(before, 79);
  assert.equal(after, 47);
  assert.ok(reduction >= 0.4, `boilerplate reduction was ${(reduction * 100).toFixed(1)}%`);
  console.log(`Boilerplate measurement: ${before} words before, ${after} after, ${(reduction * 100).toFixed(1)}% reduction.`);
});
