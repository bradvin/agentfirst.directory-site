import assert from "node:assert/strict";
import { test } from "node:test";

import { shuffleCopy } from "../src/lib/homepage-order.ts";

test("shuffleCopy uses injected random values for a deterministic Fisher-Yates permutation", () => {
  const randomValues = [0, 0, 0];
  let calls = 0;

  const shuffled = shuffleCopy(["alpha", "beta", "gamma", "delta"], () => {
    const value = randomValues[calls];
    calls += 1;
    return value;
  });

  assert.deepEqual(shuffled, ["beta", "gamma", "delta", "alpha"]);
  assert.deepEqual([...shuffled].sort(), ["alpha", "beta", "delta", "gamma"]);
  assert.equal(calls, 3);
});

test("shuffleCopy returns a new array without mutating its input", () => {
  const input = ["alpha", "beta", "gamma"];

  const shuffled = shuffleCopy(input, () => 0);

  assert.notStrictEqual(shuffled, input);
  assert.deepEqual(input, ["alpha", "beta", "gamma"]);
  assert.deepEqual(shuffled, ["beta", "gamma", "alpha"]);
});

test("shuffleCopy accepts the upper edge of the random source range", () => {
  assert.deepEqual(shuffleCopy(["alpha", "beta", "gamma"], () => 0.999999), [
    "alpha",
    "beta",
    "gamma",
  ]);
});

test("shuffleCopy rejects random values outside the Fisher-Yates source range", () => {
  assert.throws(() => shuffleCopy(["alpha", "beta"], () => 1), RangeError);
  assert.throws(() => shuffleCopy(["alpha", "beta"], () => -0.1), RangeError);
  assert.throws(() => shuffleCopy(["alpha", "beta"], () => Number.NaN), RangeError);
});
