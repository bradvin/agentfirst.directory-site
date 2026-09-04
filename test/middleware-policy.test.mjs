import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getCanonicalRedirectLocation,
  getRequestCacheDecision,
  getResponseCacheDecision,
} from "../src/lib/middleware-policy.ts";

const cacheableResponseHeaders = new Headers({ "Content-Type": "text/html; charset=utf-8" });

function requestDecision({
  url = "https://agentfirst.directory/tools/example",
  method = "GET",
  headers = {},
  hasCachePolicy = true,
} = {}) {
  return getRequestCacheDecision(new URL(url), method, new Headers(headers), hasCachePolicy);
}

test("the exact HTTPS apex URL does not redirect", () => {
  assert.equal(
    getCanonicalRedirectLocation(new URL("https://agentfirst.directory/tools/example?source=test")),
    undefined,
  );
});

test("HTTP, www, unexpected hosts, and non-canonical ports redirect to the HTTPS apex", () => {
  for (const input of [
    "http://agentfirst.directory/tools/example?source=test",
    "https://www.agentfirst.directory/tools/example?source=test",
    "https://preview.example.com/tools/example?source=test",
    "https://agentfirst.directory:8443/tools/example?source=test",
  ]) {
    assert.equal(
      getCanonicalRedirectLocation(new URL(input)),
      "https://agentfirst.directory/tools/example?source=test",
      input,
    );
  }
});

test("local development hosts bypass canonical redirects", () => {
  for (const input of [
    "http://localhost:4321/tools/example",
    "http://site.localhost:4321/tools/example",
    "http://127.0.0.1:4321/tools/example",
    "http://[::1]:4321/tools/example",
    "http://0.0.0.0:4321/tools/example",
  ]) {
    assert.equal(getCanonicalRedirectLocation(new URL(input)), undefined, input);
  }
});

test("only GET and HEAD requests with a matching route policy can use shared cache", () => {
  for (const method of ["GET", "HEAD"]) {
    const decision = requestDecision({ method });
    assert.equal(decision.methodCanBeCached, true, method);
    assert.equal(decision.canUseSharedCache, true, method);
  }

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const decision = requestDecision({ method });
    assert.equal(decision.methodCanBeCached, false, method);
    assert.equal(decision.canUseSharedCache, false, method);
  }

  assert.equal(requestDecision({ hasCachePolicy: false }).canUseSharedCache, false);
  assert.equal(
    requestDecision({ url: "http://localhost:4321/tools/example" }).canUseSharedCache,
    false,
  );
});

test("query strings and request credentials or partial-content headers remain private", () => {
  const cases = [
    { name: "query", url: "https://agentfirst.directory/tools/example?source=test" },
    { name: "authorization", headers: { Authorization: "Bearer secret" } },
    { name: "cookie", headers: { Cookie: "session=secret" } },
    { name: "range", headers: { Range: "bytes=0-99" } },
    { name: "no-store", headers: { "Cache-Control": "max-age=60, no-store" } },
  ];

  for (const { name, ...options } of cases) {
    const decision = requestDecision(options);
    assert.equal(decision.containsPrivateRequestData, true, name);
    assert.equal(decision.canUseSharedCache, false, name);
  }
});

test("force-refresh request headers bypass a shared-cache hit", () => {
  for (const headers of [
    { "Cache-Control": "no-cache" },
    { "Cache-Control": "public, MAX-AGE = 0" },
    { Pragma: "NO-CACHE" },
  ]) {
    assert.equal(requestDecision({ headers }).forceRefresh, true, JSON.stringify(headers));
  }

  assert.equal(requestDecision({ headers: { "Cache-Control": "max-age=60" } }).forceRefresh, false);
});

test("eligible public responses are cacheable and do not receive private headers", () => {
  const decision = getResponseCacheDecision(
    requestDecision(),
    true,
    200,
    cacheableResponseHeaders,
  );

  assert.deepEqual(decision, { isCacheableResponse: true, mustRemainPrivate: false });
});

test("mutations and private request signals force matching production routes private", () => {
  for (const decision of [
    requestDecision({ method: "POST" }),
    requestDecision({ headers: { Cookie: "session=secret" } }),
    requestDecision({ headers: { Authorization: "Bearer secret" } }),
    requestDecision({ headers: { Range: "bytes=0-99" } }),
    requestDecision({ headers: { "Cache-Control": "no-store" } }),
    requestDecision({ url: "https://agentfirst.directory/tools/example?source=test" }),
  ]) {
    assert.deepEqual(
      getResponseCacheDecision(decision, true, 200, cacheableResponseHeaders),
      { isCacheableResponse: false, mustRemainPrivate: true },
    );
  }
});

test("unsafe response metadata prevents shared caching", () => {
  const cases = [
    { status: 404, headers: cacheableResponseHeaders },
    { status: 200, headers: new Headers({ "Content-Type": "image/png" }) },
    {
      status: 200,
      headers: new Headers({ "Content-Type": "text/html", "Cache-Control": "private" }),
    },
    {
      status: 200,
      headers: new Headers({ "Content-Type": "text/html", "Set-Cookie": "session=secret" }),
    },
    {
      status: 200,
      headers: new Headers({ "Content-Type": "text/html", Vary: "Accept-Encoding, *" }),
    },
  ];

  for (const { status, headers } of cases) {
    assert.deepEqual(getResponseCacheDecision(requestDecision(), true, status, headers), {
      isCacheableResponse: false,
      mustRemainPrivate: true,
    });
  }
});

test("local and non-policy routes are never marked private by shared-cache policy", () => {
  const localDecision = requestDecision({
    url: "http://localhost:4321/tools/example?source=test",
    method: "POST",
  });
  assert.equal(
    getResponseCacheDecision(localDecision, true, 404, new Headers()).mustRemainPrivate,
    false,
  );

  const noPolicyDecision = requestDecision({ method: "POST", hasCachePolicy: false });
  assert.equal(
    getResponseCacheDecision(noPolicyDecision, false, 404, new Headers()).mustRemainPrivate,
    false,
  );
});
