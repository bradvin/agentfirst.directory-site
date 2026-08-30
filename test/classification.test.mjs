import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatClassification,
  normalizeClassification,
} from "../src/lib/classification.ts";

const cases = [
  ["agent-native", "Agent-native"],
  ["agent-enabling", "Agent-enabling"],
  ["agent-internet-protocol", "Agent internet protocol"],
];

for (const [classification, label] of cases) {
  test(`formats ${classification}`, () => {
    assert.equal(formatClassification(classification), label);
    assert.equal(normalizeClassification(classification), classification);
  });
}

test("normalizes a staged NULL classification without inventing a value", () => {
  assert.equal(normalizeClassification(null), undefined);
});
