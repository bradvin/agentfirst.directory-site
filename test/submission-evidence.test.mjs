import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWED_EVIDENCE_SOURCE_TYPES,
  handleSubmissionEvidenceRequest,
  validateSubmissionEvidence,
} from "../src/lib/submission-evidence.ts";

const validSource = {
  title: "Official agent documentation",
  url: "https://example.com/docs/agents",
  claim: "The documentation describes an API designed for autonomous agent workflows.",
  accessedAt: "2026-09-22",
  sourceType: "official-documentation",
  firstParty: true,
};

function request(body, headers = { "content-type": "application/json" }) {
  return new Request("https://agentfirst.directory/api/submission-evidence", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("evidence contract exposes only the content policy source types", () => {
  assert.deepEqual(ALLOWED_EVIDENCE_SOURCE_TYPES, [
    "official-documentation",
    "official-repository",
    "official-license",
    "official-pricing",
    "official-product-page",
    "official-product-announcement",
    "official-specification",
    "official-legal",
    "official-release-notes",
  ]);
});

test("submission evidence requires at least one source", () => {
  for (const payload of [{}, { evidenceSources: [] }]) {
    const result = validateSubmissionEvidence(payload);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.path === "evidenceSources"));
  }
});

test("submission evidence rejects malformed claim-level evidence", () => {
  const result = validateSubmissionEvidence({
    evidenceSources: [
      {
        title: " ",
        url: "http://example.com/docs",
        claim: "",
        accessedAt: "2026-02-30",
        sourceType: "vendor-blog",
        firstParty: false,
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.path),
    [
      "evidenceSources.0.title",
      "evidenceSources.0.claim",
      "evidenceSources.0.url",
      "evidenceSources.0.accessedAt",
      "evidenceSources.0.sourceType",
      "evidenceSources.0.firstParty",
    ],
  );
});

test("submission evidence accepts and trims a valid multi-source payload", () => {
  const result = validateSubmissionEvidence({
    evidenceSources: [
      { ...validSource, title: `  ${validSource.title}  ` },
      {
        title: "Official repository",
        url: "https://github.com/example/project",
        claim: "The maintained repository documents the project's agent runtime and Apache-2.0 source.",
        accessedAt: "2026-09-21",
        sourceType: "official-repository",
        firstParty: true,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.evidenceSources.length, 2);
  assert.equal(result.evidenceSources[0].title, validSource.title);
  assert.equal("firstParty" in result.evidenceSources[0], false);
});

test("server endpoint rejects missing and invalid evidence even when client validation is bypassed", async () => {
  const missing = await handleSubmissionEvidenceRequest(request({ evidenceSources: [] }));
  assert.equal(missing.status, 422);
  assert.equal(missing.headers.get("cache-control"), "no-store");
  assert.equal((await missing.json()).ok, false);

  const invalid = await handleSubmissionEvidenceRequest(
    request({ evidenceSources: [{ ...validSource, sourceType: "vendor-blog" }] }),
  );
  assert.equal(invalid.status, 422);
  assert.ok((await invalid.json()).errors.some((error) => error.path === "evidenceSources.0.sourceType"));
});

test("server endpoint returns normalized valid multi-source evidence", async () => {
  const response = await handleSubmissionEvidenceRequest(
    request({
      evidenceSources: [
        validSource,
        {
          title: "Official specification",
          url: "https://example.com/specification",
          claim: "The specification defines the protocol messages exchanged by autonomous agents.",
          accessedAt: "2026-09-20",
          sourceType: "official-specification",
          firstParty: true,
        },
      ],
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.evidenceSources.length, 2);
  assert.equal(body.validationScope, "schema-only");
});

test("server endpoint rejects unsupported content types and malformed JSON", async () => {
  const wrongType = await handleSubmissionEvidenceRequest(
    request("plain text", { "content-type": "text/plain" }),
  );
  assert.equal(wrongType.status, 415);

  const malformed = await handleSubmissionEvidenceRequest(request("{"));
  assert.equal(malformed.status, 400);
});
