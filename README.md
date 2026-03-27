# agentfirst.directory-site

Astro site for `agentfirst.directory`, deployed to Cloudflare Pages with D1 sync. Site code lives here. Approved content continues to live in the public `bradvin/agentfirst.directory` repo, and this repo is being migrated away from the old embedded `content/` checkout toward runtime D1 reads.

## Stack

- Astro static site generation
- Cloudflare Pages for hosting and preview deploys
- D1 as the mirrored published index
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
npm run validate:content
npm run dev
```

This repo does not currently embed the content repo. Until the runtime D1 migration is complete, commands that expect a local `content/` directory will fail.

## Repo split

- Site repo: `https://github.com/bradvin/agentfirst.directory-site`
- Content repo: `https://github.com/bradvin/agentfirst.directory`
- The site is being migrated to read published content at runtime instead of from an embedded checkout.

## CI and publish flow

- Every PR to the site repo runs content validation and Astro build.
- Cloudflare Pages should be connected to the GitHub repo for preview deployments.
- Merge to `main` is the approval event.
- After merge, `.github/workflows/sync-d1.yml`:
  1. validates content
  2. applies D1 migrations
  3. generates a full sync SQL file
  4. upserts categories and tools into D1

## Required GitHub secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`
