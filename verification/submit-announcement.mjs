// Local browser only: clipboard and all non-local network traffic are intercepted.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.env.BASE_URL ?? "http://127.0.0.1:4321");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use a local fixture Worker, never production");
const legacy = "Read https://agentfirst.directory/SKILL.md to add a new tool";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const writes = [];
  const mutations = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["GET", "HEAD"].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`);
    if (new URL(request.url()).origin !== base.origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
    return route.continue();
  });
  await context.exposeBinding("recordClipboard", (_source, text) => writes.push(text));
  await context.addInitScript(() => {
    Reflect.set(window, "announcementClipboardMode", "ok");
    Object.defineProperty(navigator, "clipboard", { value: { async writeText(text) {
      if (Reflect.get(window, "announcementClipboardMode") === "reject") throw new Error("mock clipboard denied");
      await window.recordClipboard(text);
      if (Reflect.get(window, "announcementClipboardMode") === "delay") await new Promise((resolve) => { window.resolveClipboard = resolve; });
    } } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("/submit", base).href);
  const handle = page.getByLabel("X handle to tag when we announce your listing (optional)", { exact: true });
  const copy = page.locator("#skill-copy-button");
  const preview = page.locator("#skill-copy-input");
  const error = page.locator("#announcement-x-error");
  assert.equal(await handle.getAttribute("aria-describedby"), "announcement-x-help announcement-x-error");
  assert.equal(await page.locator("#announcement-x-help").textContent(), "Your personal or product account. Leave blank if you don’t want a tag.");
  assert.equal(await preview.inputValue(), legacy);
  await copy.click();
  await page.waitForFunction(() => document.querySelector("#skill-copy-button").textContent === "Copied");
  assert.equal(writes.at(-1), legacy);
  for (const [input, expected] of [[" @MiXeD_123 ", "MiXeD_123"], ["Bare_Account", "Bare_Account"], ["123456789012345", "123456789012345"]]) {
    await handle.fill(input);
    await copy.click();
    await page.waitForFunction(() => document.querySelector("#skill-copy-button").textContent === "Copied");
    assert.ok(writes.at(-1).includes(`announcementXHandle: "${expected}"`));
    assert.equal(await preview.inputValue(), writes.at(-1));
    assert.equal(await handle.getAttribute("aria-invalid"), "false");
  }
  const validWriteCount = writes.length;
  for (const invalid of ["https://x.com/user", "x.com/user", "@", "@@user", "a-b", "a b", "é", "1234567890123456"]) {
    await handle.fill(invalid);
    await copy.click();
    assert.equal(writes.length, validWriteCount, "invalid edit must not copy any previous valid handle");
    assert.equal(await copy.textContent(), "Copy");
    assert.equal(await preview.inputValue(), "");
    assert.equal(await copy.getAttribute("data-copy-text"), "");
    assert.equal(await handle.getAttribute("aria-invalid"), "true");
    assert.equal(await error.isVisible(), true);
    assert.equal(await handle.evaluate((element) => element === document.activeElement), true);
  }
  for (const blank of ["", "   "]) {
    await handle.fill(blank);
    await copy.click();
    await page.waitForFunction(() => document.querySelector("#skill-copy-button").textContent === "Copied");
    assert.equal(writes.at(-1), legacy);
    assert.equal(await preview.inputValue(), legacy);
    assert.equal(await error.isVisible(), false);
  }
  await page.evaluate(() => { Reflect.set(window, "announcementClipboardMode", "reject"); });
  const beforeDenied = writes.length;
  await handle.fill("@Fallback");
  await copy.click();
  await page.waitForFunction(() => document.activeElement?.id === "skill-copy-input");
  assert.equal(writes.length, beforeDenied);
  assert.equal(await copy.textContent(), "Copy");
  assert.ok(await preview.evaluate((element) => element instanceof HTMLInputElement && element.selectionEnd === element.value.length && element.selectionStart === 0));
  await page.evaluate(() => { Reflect.set(window, "announcementClipboardMode", "delay"); });
  await handle.fill("@BeforeEdit");
  await copy.click();
  await page.waitForFunction(() => typeof window.resolveClipboard === "function");
  await handle.fill("https://x.com/invalid");
  await page.evaluate(() => window.resolveClipboard());
  await page.waitForTimeout(50);
  assert.equal(await copy.textContent(), "Copy", "stale clipboard completion cannot report success after edit");
  assert.equal(await preview.inputValue(), "");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile layout must not overflow");
  if (process.env.ANNOUNCEMENT_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ANNOUNCEMENT_ARTIFACT_DIR}/site-submit-mobile.png`, fullPage: true });
  assert.deepEqual(mutations, [], "copy workflow must not submit any network mutation");
  assert.deepEqual(errors, []);
  console.log("PASS: real Chromium /submit opt-in, bare/@ normalization, exact blank legacy prompt, invalid/stale-copy prevention, accessible errors, clipboard denial/race, mobile layout; mocked clipboard and local GET-only transport, no submission.");
} finally {
  await browser.close();
}
