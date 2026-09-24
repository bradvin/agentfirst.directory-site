# Development plan: reviewer-owned tool SEO metadata

## Scope and acceptance

Source: Brad's approved plan in the current Codex conversation.

Add optional `seoTitle`, `seoDescription`, and `agentSummary` fields across the site and content repositories. Tool authors may suggest values, while the editorial reviewer owns the accepted wording. Existing tools without these fields must keep their current metadata and layout. The content publisher must mirror the fields into D1, and the site must use independent fallbacks for title and description while rendering the summary before the existing tool description.

Acceptance criteria:

- A1: Both repositories contain the same nullable D1 migration for the three fields.
- A2: Content validation accepts omission, validates supplied values, and the sync pipeline inserts, updates, clears, escapes, and change-tracks them.
- A3: The content README, public submission skill, publish documentation, and canonical tool review guide describe suggestions, reviewer authority, drafting guidance, and optional rollout.
- A4: Site queries/types expose all fields; custom title and description override independently, and fallbacks preserve current behavior.
- A5: `agentSummary` renders as an optional plain-text paragraph before the existing tool description with no empty spacing when absent.
- A6: HTML, Open Graph, Twitter, and WebPage schema use the resolved metadata; data exports, feeds, LLM summaries, and tool-entity descriptions remain unchanged.
- A7: Relevant tests and each repository's full local validation pass.

## Execution plan

| ID | Acceptance | Dependencies | Ownership | Status | Developer | QA | Repairs | Evidence | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | A1–A7 | none | Both repositories | done | GPT-6 Sol High (`/root/seo_metadata_dev`): cross-repo schema, migration, publishing, rendering, docs, and tests require coordinated changes | GPT-6 Sol Medium (`/root/seo_metadata_qa`) | 2 | Final QA approved; supervisor: content 75 tests + validation, site 78 tests + clean Astro check/build, identical migrations, diff checks clean | Site `f6e9956`; content `5b578d8` |
| T2 | Deploy the accepted changes through repository PRs and verify both workflows | T1 | Both repositories | developing | Supervisor release task; no development agent required | Existing T1 QA evidence | 0 | Brad authorized PR creation, merge, and deployment | — |

Shared files are expected across migrations, content parsing/publishing, runtime queries, tool rendering, documentation, and focused tests. One developer owns the complete implementation to avoid cross-repo integration conflicts. Independent QA begins only after the developer freezes the submitted diff.

Validation commands:

- Content repo: `npm test` and `npm run validate:content`
- Site repo: `npm run ci`
- Inspect identical migration contents and both working trees before acceptance.
- Run rendered verification if its local D1/runtime prerequisites are available; otherwise record the concrete limitation and rely on focused rendering/build coverage.

## Workflow and budget

- Site base: `2816c8c06ae5e7659c90c4efc03bb0b22eed2d33` on `main`
- Content base: `99d9a2073cbfe78f4f9cf931ac21b3208de8d124` on `main`
- Supervisor: current session model, explicitly accepted by Brad; setting cannot be independently verified.
- Authorized allowance: 8 percentage points of the weekly Codex window (initial 5 points plus Brad's approved 3-point extension for release).
- Baseline: 34% used, `codex`, 10,080 minutes, reset `1790680522`.
- Reserve: 1.6 points; early stop at 40.4% used.
- Pre-existing work: untracked `output/` in the site repository; preserve and exclude from task commits.

```json
{"version":1,"baseline":{"limit_id":"codex","window_minutes":10080,"resets_at":1790680522,"used_percent":34,"observed_at":1790239956},"last":{"limit_id":"codex","window_minutes":10080,"resets_at":1790680522,"used_percent":39,"observed_at":1790270813},"budget_pp":8,"reserve_pp":1.6,"status":"active"}
```

| Checkpoint | Used | Delta | Headroom before stop | Decision |
| --- | ---: | ---: | ---: | --- |
| Baseline before planning | 34% | 0 pp | 4 pp | Start T1 |
| After development, before QA | 34% | 0 pp | 4 pp | Start independent QA |
| After initial QA, before repair | 34% | 0 pp | 4 pp | Focused repair and QA re-review |
| Final acceptance and commits | 34% | 0 pp | 4 pp | Complete |
| Release extension | 39% | 5 pp | 1.4 pp | Brad added 3 points; create and verify PR deployments |

## Handoff

T1 is complete and committed in both repositories. T2 is active: create and merge the site PR first, verify deployment, then create and merge the content PR and verify publication.
