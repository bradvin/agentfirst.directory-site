# agentfirst.directory-site

Astro site for `agentfirst.directory`, an evidence-led directory of agent-native tools, agent-enabling infrastructure, and agent internet protocols. It is deployed to Cloudflare Workers with D1-backed runtime reads. Site code and D1 schema live here. Approved content continues to live in the public `bradvin/agentfirst.directory` repo and is published into D1 by that repo's pipeline.

## Stack

- Astro server rendering on Cloudflare Workers
- D1 as the runtime published index
- Public content repo for categories and tools

## Content model

### Categories

Approved categories live in the public content repo at `categories/<slug>.json`.

Example:

```json
{
  "slug": "frameworks",
  "label": "Frameworks & SDKs",
  "sortOrder": 10
}
```

### Tools

Approved tools live in the public content repo at `tools/<slug>.md`.

Example:

```md
---
slug: "crewai"
name: "CrewAI"
description: "Framework for orchestrating role-playing AI agents"
category: "frameworks"
tags:
  - "python"
  - "multi-agent"
  - "orchestration"
websiteUrl: "https://crewai.com"
githubUrl: "https://github.com/crewAIInc/crewAI"
pricing: "open-source"
classification: "agent-native"
submittedBy: "bradvin"
sortOrder: 90
---

CrewAI is a lean, lightning-fast framework built in Python for orchestrating role-playing autonomous AI agents.
```

Every published tool must have one classification:

- `agent-native`: agents are a core actor, runtime, abstraction, or participant.
- `agent-enabling`: the tool materially empowers an agent-first workflow.
- `agent-internet-protocol`: an interoperable protocol lets agents communicate, transact, identify, coordinate, or interact online.

The staged `0003_add_tool_classification.sql` migration permits `NULL` only so a populated database can be upgraded before the content publisher backfills every row. Runtime reads keep old/null rows safe and do not fabricate a classification badge. The public policy and evidence test live at `/policy`.

## Local development

```bash
npm ci
npm test
npm run dev
```

Use Node 24. `npm run ci` runs the migration/unit tests and Worker-targeted Astro build. For rendered verification, apply local D1 migrations, seed `test/fixtures/seed-classifications.sql`, start the local runtime, and run `npm run verify:rendered`. Never point that fixture at remote D1.

Homepage tool cards are shuffled per uncached request. Because the existing homepage edge cache remains `s-maxage=300`, visitors served by the same edge cache share that order until the five-minute cache refresh.

The checked-in config uses a placeholder D1 database ID. Local builds still use a local D1 binding so they work without Cloudflare auth; use Wrangler remote access explicitly when you need live data. CI injects the real D1 database ID at deploy time.

## Repo split

- Site repo: `https://github.com/bradvin/agentfirst.directory-site`
- Content repo: `https://github.com/bradvin/agentfirst.directory`
- The content repo remains the authoring source of truth and is responsible for publishing content and purging cache.
- This site repo owns the runtime query layer, Workers deploy, and D1 migrations.

## CI and publish flow

- Every PR to the site repo runs a Worker-targeted Astro build.
- Merge to `main` applies pending D1 migrations and deploys the Worker.
- Content publication into D1 is handled by the content repo, not this repo.

## Required GitHub secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
