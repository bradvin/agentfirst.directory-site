# agentfirst.directory-site

Astro site for `agentfirst.directory`, deployed to Cloudflare Workers with D1-backed runtime reads. Site code and D1 schema live here. Approved content continues to live in the public `bradvin/agentfirst.directory` repo and is published into D1 by that repo's pipeline.

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
submittedBy: "bradvin"
sortOrder: 90
---

CrewAI is a lean, lightning-fast framework built in Python for orchestrating role-playing autonomous AI agents.
```

## Local development

```bash
npm install
npm run dev
```

The checked-in config points at the `agentfirst-directory` D1 database. Local builds still use a local D1 binding so they work without Cloudflare auth; use Wrangler remote access explicitly when you need live data.

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
- `CLOUDFLARE_D1_DATABASE_NAME`
