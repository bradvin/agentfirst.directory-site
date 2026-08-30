import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildToolSearchText,
  matchesToolSearch,
  normalizeSearchText,
} from "../src/lib/homepage-search.ts";

test("normalizes search text for case-insensitive matching", () => {
  assert.equal(normalizeSearchText("  Agent\nNATIVE  "), "agent native");
});

test("builds search text from every rendered searchable field", () => {
  assert.equal(
    buildToolSearchText({
      name: "Hermes Agent",
      description: "An autonomous assistant",
      categoryLabel: "Agent Infrastructure",
      tags: ["Open Source", "CLI"],
    }),
    "hermes agent an autonomous assistant agent infrastructure open source cli",
  );
});

test("matches immediate case-insensitive queries across every searchable field", () => {
  const searchText = buildToolSearchText({
    name: "Hermes Agent",
    description: "An autonomous assistant",
    categoryLabel: "Agent Infrastructure",
    tags: ["Open Source", "CLI"],
  });

  for (const query of ["HERMES", "AuToNoMoUs ASSISTANT", "infrastructure", "open SOURCE", "cli"]) {
    assert.equal(matchesToolSearch(searchText, query), true, `expected ${query} to match`);
  }

  assert.equal(matchesToolSearch(searchText, "payments"), false);
  assert.equal(matchesToolSearch(searchText, "   "), true);
});
