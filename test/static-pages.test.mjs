import assert from "node:assert/strict";
import { test } from "node:test";

import { getStaticPageEntries } from "../src/lib/static-pages.ts";

test("static sitemap includes every canonical public editorial page", () => {
  assert.deepEqual(getStaticPageEntries(), [
    { path: "/" },
    { path: "/about" },
    { path: "/editorial-standards" },
    { path: "/policy" },
    { path: "/corrections" },
    { path: "/open-source-ai-agent-tools" },
    { path: "/research/state-of-agent-first-infrastructure" },
    { path: "/submit" },
  ]);
});
