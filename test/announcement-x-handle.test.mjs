import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test, after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), "announcement-x-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const parser = () => import("../src/lib/announcement-x-handle.ts");
const legacy = "Read https://agentfirst.directory/SKILL.md to add a new tool";

test("optional handles normalize to case-preserving bare ASCII, with blank/omitted absence", async () => {
  const { normalizeAnnouncementXHandle, buildSubmissionPrompt } = await parser();
  for (const value of [undefined, "", "   ", "\t\n"]) {
    assert.equal(normalizeAnnouncementXHandle(value), undefined);
    assert.equal(buildSubmissionPrompt(value), legacy);
  }
  for (const [input, expected] of [["A", "A"], ["_", "_"], ["MiXeD_123", "MiXeD_123"], [" @MiXeD_123 \t", "MiXeD_123"], ["123456789012345", "123456789012345"]]) {
    assert.equal(normalizeAnnouncementXHandle(input), expected);
    assert.ok(buildSubmissionPrompt(input).startsWith(legacy));
    assert.doesNotMatch(buildSubmissionPrompt(input), /[\r\n]/, "single-line readonly fallback must preserve the complete prompt");
    assert.ok(buildSubmissionPrompt(input).includes(`announcementXHandle: "${expected}"`));
  }
});

test("invalid handles, URLs, null, and wrong types are rejected rather than treated as opt-out", async () => {
  const { normalizeAnnouncementXHandle, buildSubmissionPrompt } = await parser();
  for (const value of [null, false, true, 123, [], {}, ["user"], "@", "@@user", "a b", "a-b", "a.b", "é", "Ａ", "a\nb", "1234567890123456", "https://x.com/user", "http://twitter.com/user", "x.com/user", "@user/path", "user?x=1", "user\u200b"]) {
    assert.throws(() => normalizeAnnouncementXHandle(value), /X handle/);
    assert.throws(() => buildSubmissionPrompt(value), /X handle/);
  }
});

test("migration upgrades existing data with nullable TEXT and no GitHub fallback", () => {
  const database = new DatabaseSync(":memory:");
  const migrations = readdirSync(new URL("migrations/", root)).filter((name) => name.endsWith(".sql")).sort();
  assert.ok(migrations.includes("0007_add_announcement_x_handle.sql"));
  for (const file of migrations.filter((name) => !name.startsWith("0007_"))) database.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  database.exec(`INSERT INTO categories (slug,label,source_path) VALUES ('fixture','Fixture','categories/fixture.json');
    INSERT INTO tools (slug,name,description,body_md,category_slug,tags_json,website_url,pricing,source_path,submitted_by_github)
    VALUES ('fixture','Fixture','Fixture description','Body','fixture','[]','https://example.com','paid','tools/fixture.md','github-only');`);
  database.exec(readFileSync(new URL("migrations/0007_add_announcement_x_handle.sql", root), "utf8"));
  const column = database.prepare("PRAGMA table_info(tools)").all().find((item) => item.name === "announcement_x_handle");
  assert.deepEqual({ type: column.type, notnull: column.notnull, default: column.dflt_value }, { type: "TEXT", notnull: 0, default: null });
  const row = database.prepare("SELECT announcement_x_handle, submitted_by_github FROM tools").get();
  assert.equal(row.announcement_x_handle, null);
  assert.equal(row.submitted_by_github, "github-only");
  database.close();
});

test("actual D1 query/map/export round trip preserves independent X and GitHub attribution, not SEO", async () => {
  const database = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("migrations/", root)).filter((name) => name.endsWith(".sql")).sort()) database.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  database.exec(`INSERT INTO categories (slug,label,source_path) VALUES ('fixture','Fixture','categories/fixture.json');
    INSERT INTO tools (slug,name,description,body_md,category_slug,tags_json,website_url,pricing,source_path,submitted_by_github)
    VALUES ('fixture','Fixture','Fixture description','Body','fixture','[]','https://example.com','paid','tools/fixture.md','github-only');`);
  globalThis.__announcementDB = { prepare(sql) { return { bind(...args) { return { async all() { return { results: database.prepare(sql).all(...args) }; } }; } }; } };
  const output = join(scratch, "runtime.mjs");
  await build({
    stdin: { contents: 'export { getPublishedTools } from "./src/lib/content.ts"; export { toolToPublicRecord } from "./src/lib/data-export.ts"; export { toolEntitySchema } from "./src/lib/seo.ts";', resolveDir: root.pathname },
    outfile: output, bundle: true, format: "esm", platform: "node", target: "node24", logLevel: "silent",
    plugins: [{ name: "fixture-d1", setup(builder) {
      builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "workers", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const env = { DB: globalThis.__announcementDB };" }));
    } }],
  });
  const { getPublishedTools, toolToPublicRecord, toolEntitySchema } = await import(pathToFileURL(output).href);
  try {
    const [blank] = await getPublishedTools();
    assert.equal(blank.entry.announcementXHandle, undefined);
    assert.equal(toolToPublicRecord(blank).announcementXHandle, undefined);
    assert.equal(blank.entry.submittedByGithub, "github-only");
    database.prepare("UPDATE tools SET announcement_x_handle = ?").run("MiXeD_123");
    const [explicit] = await getPublishedTools();
    assert.equal(explicit.entry.announcementXHandle, "MiXeD_123");
    assert.equal(explicit.entry.submittedByGithub, "github-only");
    assert.equal(JSON.parse(JSON.stringify(toolToPublicRecord(explicit))).announcementXHandle, "MiXeD_123");
    assert.doesNotMatch(JSON.stringify(toolEntitySchema(explicit)), /MiXeD_123|x\.com|twitter\.com/);
    database.prepare("UPDATE tools SET announcement_x_handle = NULL").run();
    const [cleared] = await getPublishedTools();
    assert.equal(cleared.entry.announcementXHandle, undefined);
    assert.equal(cleared.entry.submittedByGithub, "github-only");
  } finally { database.close(); delete globalThis.__announcementDB; }
});

test("submit page and contribution instructions explicitly collect opt-in without inference", () => {
  const page = readFileSync(new URL("src/pages/submit.astro", root), "utf8");
  const skill = readFileSync(new URL("public/SKILL.md", root), "utf8");
  assert.ok(page.includes("X handle to tag when we announce your listing (optional)"));
  assert.ok(page.includes("Your personal or product account. Leave blank if you don’t want a tag."));
  assert.match(page, /aria-describedby="announcement-x-help announcement-x-error"/);
  assert.match(page, /id="announcement-x-error"[^>]*role="alert"/);
  assert.match(skill, /announcementXHandle/);
  assert.match(skill, /never infer or scrape/i);
  assert.match(skill, /GitHub attribution/);
});
