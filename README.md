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

## Product-fit-first editorial policy v0.3

The adopted source is [policy issue #125](https://github.com/bradvin/agentfirst.directory/issues/125); `/policy` explains it publicly. Identify one maintained offering and its exact unit/mode. Routes are separate from category slugs and classification values:

The companion source lane confirms `docs/editorial-policy.md` in [source PR #145](https://github.com/bradvin/agentfirst.directory/pull/145/files) as its coordinated repository policy path. It becomes available on main after that PR merges; until then issue #125 remains canonical. No unmerged-branch content pin or network policy fetch is required. Listing/category content remains D1-backed, with repository overrides ahead of local category fallbacks; `/policy` takes precedence over conflicting category guidance.

- **Run:** runs agents with meaningful customer control over execution, state or authority. Approving a finished output alone is not sufficient; uncertain control means hold.
- **Equip:** supports a concrete agent task or improvement through named product features designed for that workflow. It does not require infrastructure ownership or control of execution, resources, state or authority. Human-operated context, feedback, human–agent collaboration, maintained agent-focused libraries, connectors, catalogues and data tools can qualify, including software producing instructions or using upstream providers.
- **Enable:** a maintained agent-first protocol/standard defines first-class participants (agents or agent systems), a concrete interaction or portable agent representation across systems and a shared contract. A protocol and its same-branded harness/SDK are distinct units; ambiguity or contradiction means hold. Runtime ownership, exclusive agent use, formal recognition and multiple implementations are not prerequisites.

Use a small positioning packet: identity, unit/mode, intended user and core job, a short workflow explanation (target 150 words), submitted overview and at most two short first-party positioning excerpts (combined target 300 words) with URLs/sections. Introductory repository/docs and mode overviews are allowed; do not inspect claim-evidence arrays, detailed API/MCP docs, code, pricing, licensing or validators at this stage. A material contradiction or uncertain fact means hold, not rejection based on omission. Record `pass-fit`, `fail-fit` or `unclear-fit`, with route-specific rationale. Failed/unclear fit stops with **evidence not reviewed**: no evidence review, metadata enrichment or listing commits. Availability is separate from fit.

Only `pass-fit` proceeds to full first-party evidence, schema, and contradiction review, listing accuracy and exact-revision technical validation. Verify Enable's current public implementable contract; positioning does not prove conformance or working interoperability. Record policy/source revision and date, unit/mode, route, positioning sources, fit decision, gaps, stage reached, evidence consulted, actual validation, unresolved facts and recommendation with approval boundary. Final recommendations are eligible — corrections required, hold — evidence unresolved, meets policy, or does not meet policy. Fit pass is not acceptance; meets-policy is not merge/deploy permission.

Generic compatibility alone, labels or repackaged APIs do not qualify. Standalone prompt packs, skill files, templates and one-off scripts remain excluded; maintained software is not a prompt pack merely because it produces instructions. A Run-specific orchestrator/category boundary cannot reject an otherwise valid Equip or Enable offering. Historical reassessments and public corrections require separate owner approval; this update authorizes no existing-listing changes. Submission review and publishing remain paused; the update does not restart them or activate the installed reviewer.

After successful review, every published tool still has exactly one classification:

- `agent-native`: agents are a core actor, runtime, abstraction or participant.
- `agent-enabling`: purpose-built features materially enable a concrete agent workflow, including libraries, connectors, data, context and feedback; no execution or infrastructure ownership requirement.
- `agent-internet-protocol`: a maintained agent-first contract defines interaction or portable representation across systems.

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
