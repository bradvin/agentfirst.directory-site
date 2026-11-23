// Copy/wiring and browser checks against an isolated local fixture, not a semantic reviewer.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = new URL(process.env.BASE_URL ?? "http://127.0.0.1:4321");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use local D1 fixtures, never production");
const artifactDir = process.env.POLICY_ARTIFACT_DIR;
if (artifactDir) await mkdir(artifactDir, { recursive: true });
for (const path of ["/SKILL.md", "/llms.txt", "/llms-full.txt"]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  const text = await response.text();
  for (const term of ["Run", "Equip", "Enable", "concrete agent task or improvement", "evidence not reviewed", "issues/125", "review and publishing remain paused"])
    assert.ok(text.includes(term), `${path}: missing ${term}`);
  assert.doesNotMatch(text, /human-first app with REST, MCP, or SDK access/);
}

const browser = await chromium.launch({ headless: true });
const coverage = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const errors = [];
    const mutations = [];
    await context.route("**/*", (route) => {
      const request = route.request();
      if (!["GET", "HEAD"].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`);
      return new URL(request.url()).origin === base.origin && ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/policy", "/submit", "/editorial-standards", "/category/agent-infrastructure", "/", "/about"]) {
      const response = await page.goto(new URL(path, base).href);
      assert.equal(response.status(), 200, path);
      assert.ok(await page.locator("h1").isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflow at ${width}`);
      if (["/policy", "/editorial-standards"].includes(path)) {
        const text = await page.locator("main").innerText();
        for (const term of ["Run", "Equip", "Enable", "named product features", "first-class participants", "shared contract", "evidence not reviewed"])
          assert.ok(text.includes(term), `${path} missing ${term}`);
        assert.equal(await page.locator('a[href="https://github.com/bradvin/agentfirst.directory/issues/125"]').count(), 1);
      }
      if (path === "/policy") {
        assert.ok(await page.locator("#eligibility-routes").isVisible());
        assert.ok(await page.locator("#inclusion-test").isVisible());
        assert.ok(await page.locator("#classification-model").isVisible());
        await page.locator('.policy-cta a[href="/submit"]').click();
        assert.equal(new URL(page.url()).pathname, "/submit");
        assert.match(await page.locator("main").innerText(), /review and publishing remain paused/);
        await page.goBack();
      }
      if (path === "/submit") {
        assert.match(await page.locator("main").innerText(), /does not restart/);
        assert.equal(await page.locator("form").count(), 0);
        assert.ok(await page.locator("#announcement-x-handle").isVisible());
        assert.ok(await page.locator("#skill-copy-button").isEnabled());
        await page.locator('a[href="/policy#inclusion-test"]').click();
        assert.equal(new URL(page.url()).hash, "#inclusion-test");
        await page.goBack();
      }
      if (path.startsWith("/category/")) {
        assert.match(await page.locator("main").innerText(), /eligibility routes/);
        assert.match(await page.locator("main").innerText(), /policy takes precedence/);
      }
      if (artifactDir) await page.screenshot({ path: `${artifactDir}/${path.replaceAll("/", "-") || "home"}-${width}.png`, fullPage: true });
      coverage.push({ path, width, status: response.status() });
    }
    assert.deepEqual(errors, [], "no browser runtime errors");
    assert.deepEqual(mutations, [], "prompt-only pages must make no network writes");
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`PASS: served policy/SKILL/LLM summaries, desktop/mobile local Chromium, policy/submission navigation, pause, unchanged prompt controls; no network writes. ${JSON.stringify(coverage)}`);
