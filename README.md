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
  "sortOrder": 10,
  "seoTitle": "Frameworks for building AI agents",
  "descriptionMd": "Frameworks, SDKs, and standards for agent systems.",
  "definitionMd": "Reusable development abstractions in which agents are central.",
  "scopeMd": "Agent runtimes, SDKs, and interoperability standards.",
  "inclusionMd": "Include first-class agent abstractions or specifications.",
  "exclusionMd": "Exclude generic AI libraries with no first-class agent model.",
  "selectionGuideMd": "Compare runtime model, tool interfaces, state, and interoperability.",
  "useCases": ["Build an agent runtime", "Connect interoperable agent systems"],
  "isIndexable": true
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
entityType: "software-source-code"
developerName: "CrewAI"
docsUrl: "https://docs.crewai.com"
licenseUrl: "https://github.com/crewAIInc/crewAI/blob/main/LICENSE"
interfaces:
  - "Python SDK"
deploymentModes:
  - "self-hosted"
verificationLevel: "documentation-reviewed"
classificationRationaleMd: "The maintained documentation makes agents and coordinated crews the framework's core abstractions."
evidenceSources:
  - title: "CrewAI documentation"
    url: "https://docs.crewai.com"
    claim: "The documentation describes a framework for building and coordinating AI agents."
    accessedAt: "YYYY-MM-DD"
    sourceType: "official-documentation"
sortOrder: 90
---

CrewAI is a lean, lightning-fast framework built in Python for orchestrating role-playing autonomous AI agents.
```

Replace `YYYY-MM-DD` with the date the cited source was actually checked. Add `reviewedBy` and `reviewedAt` together only after a real editorial review.

## Product-fit-first editorial policy

Only tools built for agents belong in the directory. Before evidence review, record `pass-fit`, `fail-fit`, or `unclear-fit` with the intended user, core job, and why the product is or is not built for agents. Use only the product description and operating model, plus canonical homepage positioning if necessary, not evidence arrays, docs, MCP details, implementation, pricing, licence, or validation.

Only `pass-fit` proceeds to full evidence, schema, and contradiction review. `fail-fit` stops with nonacceptance; `unclear-fit` holds for product-positioning clarification. Neither proceeds to evidence review, metadata enrichment, or listing commits. A human-first app with REST, MCP, or SDK access cannot be rescued by integration depth or tool count. An AI agent serving humans is not, by itself, a tool built for agents. Agent-oriented infrastructure, protocols, and agent-builder tools may pass when designed for agent operation; exclusive agent use or agent-only origins are not required.

The product-fit gate at `/policy#inclusion-test` takes precedence over category or contribution guidance, including any workflow that starts with evidence or treats internal autonomous agents alone as sufficient. Historical reassessments and public corrections require separate owner approval; this update authorizes no existing-listing changes.

After `pass-fit` and successful evidence review, every published tool must have one classification:

- `agent-native`: agents are a core actor, runtime, abstraction, or participant.
- `agent-enabling`: infrastructure or builder tooling designed for agent operation materially enables an agent-first workflow; this cannot bypass product fit.
- `agent-internet-protocol`: an interoperable protocol lets agents communicate, transact, identify, coordinate, or interact online.

The staged `0003_add_tool_classification.sql` migration permits `NULL` only so a populated database can be upgraded before the content publisher backfills every row. `0004_add_editorial_seo_metadata.sql` adds review/evidence metadata, genuine content dates, image dimensions, indexation flags, and the URL redirect/retirement registry. Runtime reads keep old/null rows safe and do not fabricate a classification badge, free offer, review, or operating-system claim. The public policy and evidence test live at `/policy`.

`content_modified_at` is owned by the content publishing pipeline: it is initialized on first publication and advances only when a visible authored field changes. `synced_at` still records every database synchronization and is deliberately not used as sitemap freshness.

## Local development

### Optional announcement X handle

`/submit` remains a copy-to-agent workflow, not a submission API. Its optional X input appends an explicitly supplied handle to the copied prompt; blank input produces the exact legacy prompt. The agent preserves it as `announcementXHandle` in the content PR frontmatter following `/SKILL.md`. Handles are trimmed, may start with one `@`, and normalize to case-preserving bare ASCII `[A-Za-z0-9_]{1,15}`. URLs, null, and non-string values are invalid; omitted/blank means no tag. Never infer or scrape a handle, or fall back to a GitHub username.

Migration `0007_add_announcement_x_handle.sql` adds nullable `TEXT` column `tools.announcement_x_handle`; apply it before enabling content-publisher writes of that column. Existing rows remain NULL. The content publisher owns ingestion, this site's D1 query maps NULL to absence in `Tool.announcementXHandle`, and `/api/tools.json` preserves explicitly supplied values as `announcementXHandle` for downstream use. GitHub attribution is unchanged. This field is not rendered on public tool profiles and is not a social identity or JSON-LD `sameAs` link.

**Downstream dependency:** no announcement poster is implemented in either repository. A future external announcement consumer must read this explicit field, tag only when it is present, and make no GitHub or scraped-account fallback. Actual announcement posting and end-to-end social delivery remain pending; this change does not post anything.

`test/announcement-x-handle.test.mjs` exercises validation, an existing-row migration, and the actual D1 query/map/JSON export using synthetic SQLite fixtures. `verification/submit-announcement.mjs` runs real local Chromium with mocked clipboard and local GET-only transport, including invalid edits after a valid handle; it is included in `verify:rendered`. Never use live submissions for this verification.

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

- Every PR to the site repo runs unit/SEO regression tests and a Worker-targeted Astro build.
- Merge to `main` applies pending D1 migrations and deploys the Worker.
- Content publication into D1 is handled by the content repo, not this repo.

## Search and AI discovery surfaces

- HTML sitemap index: `/sitemap-index.xml`
- Recent-entry RSS feed: `/feed.xml`
- Published tool JSON: `/api/tools.json`
- Published tool CSV: `/data/agent-first-tools.csv`
- Concise discovery map: `/llms.txt`
- Expanded AI-readable directory: `/llms-full.txt`
- Submission instructions: `/SKILL.md`

Canonical HTML profiles remain the citable authority. JSON-LD is emitted as a connected publisher/WebSite/WebPage graph and uses type-specific tool entities; user-authored values are escaped before being inserted into script elements. `llms.txt` is a discovery aid, not an indexing control.

Tool images are served through `/media/tools/<slug>/<variant>` (`card`, `hero-small`, or `hero`). The route requests Cloudflare Image Transformations, enforces a 350 KB transformed-output budget, and falls back to local assets when an upstream image fails. Enable Image Transformations and allow the required remote origins in the production zone before evaluating image performance.

Legacy URL rules live in D1's `url_redirects` table. Redirect destinations must be internal paths; supported statuses are `301`, `308`, and `410`. Use `410` only for a deliberately retired URL with no replacement.

The full implementation and launch checklist is maintained in [`docs/seo-audit-task-list.md`](docs/seo-audit-task-list.md).

## Required GitHub secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`

Production setup also needs zone-level Always Use HTTPS, a `www` → apex redirect rule for static assets, Cloudflare Image Transformations, crawler/WAF verification, and sitemap ownership in Google Search Console and Bing Webmaster Tools. These are intentionally not changed by a local code build.
