import assert from "node:assert/strict";
import { test } from "node:test";

import * as homepageSearch from "../src/lib/homepage-search.ts";

const {
  buildToolSearchText,
  matchesToolSearch,
  normalizeSearchText,
} = homepageSearch;

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

test("combines the search query and selected category", () => {
  assert.equal(typeof homepageSearch.matchesHomepageFilters, "function");
  const { matchesHomepageFilters } = homepageSearch;
  const searchText = buildToolSearchText({
    name: "Hermes Agent",
    description: "An autonomous assistant",
    categoryLabel: "Agent Infrastructure",
    tags: ["Open Source", "CLI"],
  });

  assert.equal(
    matchesHomepageFilters({
      searchText,
      categorySlug: "agent-infrastructure",
      query: "hermes",
      selectedCategory: "agent-infrastructure",
    }),
    true,
  );
  assert.equal(
    matchesHomepageFilters({
      searchText,
      categorySlug: "agent-infrastructure",
      query: "payments",
      selectedCategory: "agent-infrastructure",
    }),
    false,
  );
  assert.equal(
    matchesHomepageFilters({
      searchText,
      categorySlug: "agent-infrastructure",
      query: "hermes",
      selectedCategory: "protocols",
    }),
    false,
  );
  assert.equal(
    matchesHomepageFilters({
      searchText,
      categorySlug: "agent-infrastructure",
      query: "hermes",
      selectedCategory: "all",
    }),
    true,
  );
});
