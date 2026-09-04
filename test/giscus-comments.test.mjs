import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function cspDirective(headers, name) {
  const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1] ?? headers;
  assert.ok(csp, "Content-Security-Policy header missing");

  return csp
    .split(";")
    .map((directive) => directive.trim().split(/\s+/))
    .find(([directiveName]) => directiveName === name);
}

function headersCsp(headers) {
  const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
  assert.ok(csp, "Content-Security-Policy header missing");
  return csp;
}

function middlewareCsp(source) {
  const declaration = source.match(/const contentSecurityPolicy = \[([\s\S]*?)\]\.join\("; "\);/)?.[1];
  assert.ok(declaration, "middleware Content-Security-Policy declaration missing");
  return [...declaration.matchAll(/^\s*"([^"]+)",?$/gm)].map((match) => match[1]).join("; ");
}

function cssRule(styles, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  assert.ok(body, `${selector} rule missing`);
  return body;
}

test("CSP permits only the required Giscus stylesheet origin", () => {
  const headers = read("public/_headers");
  const middleware = middlewareCsp(read("src/middleware.ts"));
  const deployment = headersCsp(headers);
  const styleElements = cspDirective(deployment, "style-src-elem");

  assert.ok(styleElements, "style-src-elem directive missing");
  assert.equal(middleware, deployment, "middleware and deployment CSP differ");
  assert.ok(styleElements.includes("https://giscus.app"));
  assert.ok(!styleElements.includes("*"), "style-src-elem must not contain a wildcard");
  assert.deepEqual(
    styleElements.filter((source) => source.startsWith("http")),
    ["https://fonts.googleapis.com", "https://giscus.app"],
  );
});

test("Giscus mount and frame retain defensive responsive containment", () => {
  const styles = read("src/styles/global.css");
  const panel = cssRule(styles, ".comments-panel");
  const mount = cssRule(styles, ".comments-panel .giscus");
  const frame = cssRule(styles, ".comments-panel .giscus-frame");

  assert.match(panel, /min-width:\s*0;/);
  assert.match(mount, /min-width:\s*0;/);
  assert.match(mount, /max-width:\s*100%;/);
  assert.match(frame, /display:\s*block;/);
  assert.match(frame, /width:\s*100%;/);
  assert.match(frame, /min-height:\s*380px;/);
  assert.match(frame, /max-width:\s*100%;/);
  assert.match(frame, /border:\s*0;/);
});
