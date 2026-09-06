import assert from "node:assert/strict";
import { test } from "node:test";

import { categoryEditorialEntries } from "../src/lib/category-editorial.ts";

const approvedFallbackDefinitions = {
  "agent-identity-communication":
    "Identity and communication tools belong here when they are designed for agents to be addressed, authenticated, contacted, or represented in an ongoing workflow.",
  "agent-compute-sandbox-environments":
    "Compute tools belong here when they materially improve an agent’s ability to execute, inspect, resume, or contain code, command-line, desktop, or remote-machine work.",
  "web-browser-interaction-tools":
    "Browser automation tools belong here when their primary value is operating a browser or website interface for an agent, from low-level browser control to higher-level task execution.",
  "agent-ui-frontends":
    "Frontend systems belong here when they are built around agent-generated interfaces, agent-user interaction, or shared human-agent work rather than conventional application UI alone.",
  "web-crawling-data-extraction":
    "Crawling and extraction tools belong here when their primary outcome is usable web data produced through crawling, page retrieval, parsing, or structured extraction.",
  "agent-testing-qa":
    "Testing and quality-assurance systems belong here when agents actively author, operate, evaluate, or debug tests.",
  "storage-media-hosting":
    "Storage and media infrastructure belongs here when it has a documented agent-first workflow, such as direct tool access, durable artifact URLs, transformations, or agent-oriented discovery.",
  "long-term-memory-state-management":
    "Memory and state tools belong here when they provide durable layers for continuity in agent behaviour, including conversation, entity, user, episodic, and workflow state.",
  "agent-payment-financial-primitives":
    "Payment infrastructure belongs here when it lets agents discover prices, hold or use payment credentials, transact, or operate within programmable financial controls.",
  "agent-frameworks-standards":
    "Frameworks and standards belong here when agents, agent runtimes, or agent interactions are their central subject.",
  "saas-tool-integration-platforms":
    "Connector catalogues and integration platforms belong here when their primary value is giving agents usable actions across external business applications.",
  orchestrators:
    "Orchestrators belong here when their main purpose is coordinating agent work across multiple runs, roles, workers, or workflows rather than implementing one agent in isolation.",
  "api-access-orchestration-layers":
    "API orchestration tools belong here when they sit between an agent and external APIs, and discovery, credentials, policy, routing, or execution materially improves safe tool use.",
  "voice-multimodal-interfaces":
    "Voice and multimodal tools belong here when real-time speech or another non-text modality is central to the agent’s operation or user experience.",
  "specialized-search-discovery-engines":
    "Search and discovery tools belong here when their indexed data, ranking, enrichment, or result structure materially improves an agent workflow.",
  "marketing-seo":
    "Marketing and SEO tools belong here when they are designed for agent workflows, including demand research, search analysis, content planning, optimisation, and measurable follow-up actions.",
};

test("all fallback category definitions match the approved wording by slug", () => {
  const slugs = categoryEditorialEntries.map(({ slug }) => slug);
  assert.equal(slugs.length, Object.keys(approvedFallbackDefinitions).length);
  assert.equal(new Set(slugs).size, slugs.length);

  const actualDefinitions = Object.fromEntries(
    categoryEditorialEntries.map(({ slug, definition }) => [slug, definition]),
  );

  assert.deepEqual(actualDefinitions, approvedFallbackDefinitions);
});
