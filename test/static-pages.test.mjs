import assert from "node:assert/strict";
import { test } from "node:test";

import { getStaticPageEntries } from "../src/lib/static-pages.ts";

test("static sitemap includes the public policy page", () => {
  assert.deepEqual(getStaticPageEntries(), [
    { path: "/" },
    { path: "/policy" },
    { path: "/submit" },
  ]);
});
