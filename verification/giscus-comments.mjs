import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";
const toolPath = process.env.TOOL_PATH ?? "/tools/hermes-agent";
const baseOrigin = new URL(baseUrl).origin;
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
const injectCsp = localHosts.has(new URL(baseOrigin).hostname);
const widths = [320, 390, 768, 1440];

async function configuredCsp() {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  const value = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
  assert.ok(value, "Content-Security-Policy header missing from public/_headers");
  return value;
}

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    const requiredResponses = new Map();

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" });
    });
    page.on("response", (response) => {
      const url = response.url();
      if (
        url === "https://giscus.app/client.js" ||
        url === "https://giscus.app/default.css" ||
        url.startsWith("https://giscus.app/en/widget?") ||
        url.startsWith("https://giscus.app/themes/")
      ) {
        requiredResponses.set(url, response.status());
      }
    });

    if (injectCsp) {
      const csp = await configuredCsp();
      await page.route(`${baseOrigin}/**`, async (route) => {
        const response = await route.fetch();
        if (route.request().resourceType() !== "document") {
          await route.fulfill({ response });
          return;
        }
        await route.fulfill({
          response,
          headers: { ...response.headers(), "content-security-policy": csp },
        });
      });
    }

    const documentResponse = await page.goto(new URL(toolPath, baseUrl).href, { waitUntil: "networkidle", timeout: 60_000 });
    const effectiveCsp = documentResponse?.headers()["content-security-policy"] ?? "";
    assert.match(effectiveCsp, /style-src-elem[^;]*https:\/\/giscus\.app/, `${width}px: effective CSP does not permit Giscus stylesheets`);
    const frameElement = page.locator(".comments-panel .giscus-frame");
    await frameElement.waitFor({ state: "visible", timeout: 30_000 });
    const frame = page.frames().find((candidate) => candidate.url().startsWith("https://giscus.app/"));
    assert.ok(frame, `${width}px: Giscus frame did not load`);

    for (const label of ["Write", "Preview", "Sign in with GitHub"]) {
      assert.equal(await frame.getByText(label, { exact: true }).isVisible(), true, `${width}px: ${label} is not visible`);
    }

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const panel = document.querySelector(".comments-panel");
      const mount = document.querySelector(".comments-panel .giscus");
      const frame = document.querySelector(".comments-panel .giscus-frame");
      if (!(panel instanceof HTMLElement) || !(mount instanceof HTMLElement) || !(frame instanceof HTMLIFrameElement)) {
        throw new Error("Giscus containment elements missing");
      }
      const rectangle = (element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      };
      return {
        root: { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth },
        panel: rectangle(panel),
        mount: rectangle(mount),
        frame: rectangle(frame),
        frameBorder: getComputedStyle(frame).borderStyle,
      };
    });
    const frameDocument = await frame.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));

    assert.equal(metrics.root.scrollWidth, metrics.root.clientWidth, `${width}px: root page overflows`);
    assert.ok(metrics.panel.right <= metrics.root.clientWidth, `${width}px: comments panel exceeds viewport`);
    assert.ok(metrics.frame.width > 0, `${width}px: frame has no width`);
    assert.ok(Math.abs(metrics.frame.width - metrics.mount.width) <= 1, `${width}px: frame does not track mount width`);
    assert.ok(metrics.frame.right <= metrics.panel.right, `${width}px: frame exceeds comments panel`);
    assert.equal(metrics.frameBorder, "none", `${width}px: frame fallback border is visible`);
    assert.ok(frameDocument.scrollWidth <= frameDocument.clientWidth, `${width}px: Giscus document overflows horizontally`);
    assert.ok(
      frameDocument.scrollHeight <= frameDocument.clientHeight,
      `${width}px: Giscus frame clips its content height (${frameDocument.clientHeight}px < ${frameDocument.scrollHeight}px)`,
    );

    const required = [...requiredResponses.entries()];
    assert.ok(required.some(([url, status]) => url === "https://giscus.app/client.js" && status === 200), `${width}px: client.js did not load`);
    assert.ok(required.some(([url, status]) => url === "https://giscus.app/default.css" && status === 200), `${width}px: default.css did not load`);
    assert.ok(required.some(([url, status]) => url.startsWith("https://giscus.app/en/widget?") && status === 200), `${width}px: widget document did not load`);
    assert.ok(
      required.some(([url, status]) => url.startsWith("https://giscus.app/themes/") && status === 200),
      `${width}px: no Giscus theme stylesheet completed`,
    );
    const nonBenignGiscusFailures = failedRequests.filter(
      ({ url, error }) =>
        url.startsWith("https://giscus.app/") &&
        // Giscus can abort its preferred-color-scheme request after resolving the active theme.
        !(url.startsWith("https://giscus.app/themes/") && error === "net::ERR_ABORTED"),
    );
    assert.deepEqual(
      nonBenignGiscusFailures,
      [],
      `${width}px: required Giscus request failed`,
    );
    assert.deepEqual(
      consoleErrors.filter((message) => /content security policy|violates.*style-src|default\.css/i.test(message)),
      [],
      `${width}px: Giscus emitted a CSP stylesheet error`,
    );

    results.push({ width, metrics, frameDocument, requiredResponses: required, consoleErrors, failedRequests });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ baseUrl, toolPath, cspMode: injectCsp ? "injected-from-public/_headers" : "server-response", results }, null, 2));
