import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4321";
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const submissionRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/submission-evidence") {
      submissionRequests.push(request.postDataJSON());
    }
  });

  const response = await page.goto(new URL("/submit", baseUrl).href, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);

  const form = page.locator("#submission-evidence-form");
  const errorSummary = page.locator("#evidence-error-summary");
  const success = page.locator("#evidence-success");
  const submit = page.getByRole("button", { name: "Validate required evidence" });
  const firstSource = form.getByRole("group", { name: "Evidence source 1" });

  assert.equal(await firstSource.getByLabel("Source title *").isVisible(), true);
  assert.equal(await firstSource.getByLabel("First-party HTTPS URL *").isVisible(), true);
  assert.equal(await firstSource.getByLabel("Specific supported claim *").isVisible(), true);
  assert.equal(await firstSource.getByLabel("Date checked *").isVisible(), true);
  assert.equal(await firstSource.getByLabel("Source type *").isVisible(), true);

  await submit.click();
  assert.equal(await errorSummary.isVisible(), true, "missing evidence must show the error summary");
  assert.match(await errorSummary.textContent(), /Source title is required/);
  assert.equal(await success.isHidden(), true);
  assert.equal(submissionRequests.length, 0, "missing evidence must be blocked before the API request");
  assert.equal(await errorSummary.evaluate((element) => element === document.activeElement), true, "error summary must receive focus");

  await firstSource.getByLabel("Source title *").fill("Official agent documentation");
  await firstSource.getByLabel("First-party HTTPS URL *").fill("http://example.com/docs/agents");
  await firstSource.getByLabel("Specific supported claim *").fill("The documentation describes the agent-facing API.");
  await firstSource.getByLabel("Date checked *").fill("2026-09-20");
  await firstSource.getByLabel("Source type *").selectOption("official-documentation");
  await submit.click();

  assert.equal(await errorSummary.isVisible(), true, "invalid evidence must show the error summary");
  assert.match(await errorSummary.textContent(), /must use HTTPS/);
  assert.match(await errorSummary.textContent(), /Confirm that this is a first-party source/);
  assert.equal(submissionRequests.length, 0, "malformed evidence must be blocked before the API request");

  const bypassResult = await page.evaluate(async () => {
    const apiResponse = await fetch("/api/submission-evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        evidenceSources: [{
          title: "Official agent documentation",
          url: "http://example.com/docs/agents",
          claim: "The documentation describes the agent-facing API.",
          accessedAt: "2026-02-30",
          sourceType: "vendor-blog",
          firstParty: true,
        }],
      }),
    });
    return { status: apiResponse.status, body: await apiResponse.json() };
  });
  assert.equal(bypassResult.status, 422, "server must reject malformed evidence when client checks are bypassed");
  assert.equal(bypassResult.body.ok, false);
  assert.deepEqual(
    bypassResult.body.errors.map((error) => error.path),
    ["evidenceSources.0.url", "evidenceSources.0.accessedAt", "evidenceSources.0.sourceType"],
  );
  submissionRequests.length = 0;
  consoleErrors.length = 0;

  await firstSource.getByLabel("First-party HTTPS URL *").fill("https://example.com/docs/agents");
  await firstSource.getByLabel("I confirm this URL is maintained by the product developer or project.").check();

  await page.getByRole("button", { name: "Add another source" }).click();
  const secondSource = form.getByRole("group", { name: "Evidence source 2" });
  assert.equal(await secondSource.isVisible(), true, "add source control must create a second labelled group");
  assert.equal(await secondSource.getByRole("button", { name: "Remove evidence source 2" }).isVisible(), true);

  await secondSource.getByLabel("Source title *").fill("Official project repository");
  await secondSource.getByLabel("First-party HTTPS URL *").fill("https://github.com/example/project");
  await secondSource.getByLabel("Specific supported claim *").fill("The maintained repository documents the project's agent runtime.");
  await secondSource.getByLabel("Date checked *").fill("2026-09-21");
  await secondSource.getByLabel("Source type *").selectOption("official-repository");
  await secondSource.getByLabel("I confirm this URL is maintained by the product developer or project.").check();

  await submit.click();
  await success.waitFor({ state: "visible" });
  assert.equal(submissionRequests.length, 1, "one valid multi-source payload must reach the API");
  assert.deepEqual(submissionRequests[0], {
    evidenceSources: [
      {
        title: "Official agent documentation",
        url: "https://example.com/docs/agents",
        claim: "The documentation describes the agent-facing API.",
        accessedAt: "2026-09-20",
        sourceType: "official-documentation",
        firstParty: true,
      },
      {
        title: "Official project repository",
        url: "https://github.com/example/project",
        claim: "The maintained repository documents the project's agent runtime.",
        accessedAt: "2026-09-21",
        sourceType: "official-repository",
        firstParty: true,
      },
    ],
  });

  const yaml = await page.locator("#evidence-output").textContent();
  assert.match(yaml, /evidenceSources:/);
  assert.match(yaml, /sourceType: "official-documentation"/);
  assert.match(yaml, /sourceType: "official-repository"/);
  assert.doesNotMatch(yaml, /firstParty/, "editorial attestation must not leak into content frontmatter");
  assert.match(await success.textContent(), /Editorial review must still confirm/);

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(layout.scrollWidth, layout.clientWidth, "submission form must not overflow a 390px viewport");
  assert.deepEqual(consoleErrors, []);

  await secondSource.getByRole("button", { name: "Remove evidence source 2" }).click();
  assert.equal(await form.getByRole("group").count(), 1, "remove control must remove only the selected source");
  assert.equal(await form.getByRole("group", { name: "Evidence source 1" }).isVisible(), true);

  await context.close();
  console.log("Submission evidence browser flow passed: missing and malformed evidence blocked; valid two-source payload accepted; add/remove and mobile layout verified.");
} finally {
  await browser.close();
}
