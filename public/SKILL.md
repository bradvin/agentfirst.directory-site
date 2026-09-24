---
name: add-agentfirst-tool
description: Add an evidence-backed, classified tool or propose a category for agentfirst.directory by editing the content repository and opening a pull request.
compatibility: Requires Node.js 24, git, GitHub access, and the ability to edit Markdown and JSON files; GitHub CLI is recommended.
metadata:
  canonical-url: https://agentfirst.directory/SKILL.md
  content-repo: https://github.com/bradvin/agentfirst.directory
  site-repo: https://github.com/bradvin/agentfirst.directory-site
---

# Add a Tool to agentfirst.directory

Use this skill when a user wants to add a new tool to `agentfirst.directory` or propose a new category for that directory.

## Goal

Create a pull request against the content repository, not the website repository.

- Content repo: `https://github.com/bradvin/agentfirst.directory`
- Site repo: `https://github.com/bradvin/agentfirst.directory-site`
- Default target branch: `main`

Only change the site repo when the user explicitly asks for website code changes.

## Required outputs

- A new or updated tool file in `tools/<slug>.md`
- A new category file in `categories/<slug>.json` only when an existing category clearly does not fit
- A synchronized `tool-submitters.json` entry for each changed tool, generated with the repository script
- A pull request against `bradvin/agentfirst.directory`

## Workflow

1. Check whether the tool already exists in the content repo.
2. Apply the evidence-based inclusion test at `https://agentfirst.directory/policy`.
3. Choose exactly one supported classification.
4. Read the content repo's current `README.md` and category files; prefer an existing category when one fits.
5. Create or update the tool markdown file.
6. Add a short factual body and prefer including a `## So agents can...` section with concrete outcomes.
7. Create a category JSON file only if needed, and include at least one tool that uses it in the same PR.
8. Run the repo's submitter sync and content validation commands below. Fix their findings before opening the PR.
9. Commit the changes on a branch, push it to the contributor's fork, and open a pull request against `bradvin/agentfirst.directory:main`.
10. In the PR description, cite first-party evidence and explain why the tool belongs in the directory.

## Tool file format

Create `tools/<slug>.md` with YAML frontmatter plus a short markdown body. This is an illustrative template: replace the product facts, URLs, category, claims, and access date with researched values.

```md
---
slug: "coolapi"
name: "CoolAPI"
description: "An agent-first API for doing cool things"
seoTitle: "CoolAPI: Controlled API Access for AI Agent Workflows"
seoDescription: "Explore how CoolAPI gives AI agents controlled access to documented API operations. Review its supported interfaces, deployment model, pricing, and evidence."
agentSummary: "CoolAPI provides API and MCP interfaces for agents that need to request approved operations. Its documented permission controls define which actions an agent can attempt, while the hosted deployment handles the execution path. Review the linked documentation and pricing page to confirm the current controls, supported operations, and limits before relying on it."
category: "api-access-orchestration-layers"
tags:
  - "mcp"
  - "security"
  - "api"
websiteUrl: "https://coolapi.dev"
githubUrl: "https://github.com/cooldev/coolapi"
logoUrl: "https://www.google.com/s2/favicons?sz=64&domain_url=https://coolapi.dev"
ogImageUrl: "https://coolapi.dev/og-image.png"
pricing: "freemium"
classification: "agent-enabling"
entityType: "web-api"
developerName: "CoolDev"
docsUrl: "https://coolapi.dev/docs"
pricingUrl: "https://coolapi.dev/pricing"
interfaces:
  - "API"
  - "MCP"
deploymentModes:
  - "hosted"
classificationRationaleMd: "CoolAPI exposes documented, agent-oriented execution and security controls through API and MCP interfaces."
bestForMd: "Agents that need controlled access to security-sensitive operations."
limitationsMd: "The public documentation does not describe a self-hosted deployment option."
evidenceSources:
  - title: "CoolAPI agent documentation"
    url: "https://coolapi.dev/docs/agents"
    claim: "CoolAPI documents API and MCP interfaces intended for agent workflows."
    accessedAt: "YYYY-MM-DD"
    sourceType: "official-documentation"
---

Short summary of what the tool does.

## So agents can...

- do outcome one
- do outcome two
- do outcome three
```

### Tool rules

- `slug` must be lowercase kebab-case and must match the filename
- `name` must be the public tool name
- `description` must be a short summary
- `seoTitle`, `seoDescription`, and `agentSummary` are optional plain-text suggestions. Each must be a non-empty string when included. The editorial reviewer owns the accepted wording; existing listings can leave all three out.
- Surrounding whitespace is trimmed before validation and publishing; whitespace-only values are invalid.
- `category` must match an existing category slug unless you also add a new category in the same PR
- `tags` must contain at least one tag
- `websiteUrl` must be a valid `http` or `https` URL
- `pricing` must be one of `open-source`, `source-available`, `freemium`, `free`, `paid`, or `unknown`; confirm the current product pricing and licence from first-party sources. A trial or temporary credit is not an ongoing free tier, and a restricted source licence is not open source. Use `unknown` when the product's own pricing is unverified
- `classification` must be one of `agent-native`, `agent-enabling`, or `agent-internet-protocol`
- `evidenceSources` must contain at least one first-party source
- Every evidence source must have a non-empty `title`, HTTPS `url`, specific supported `claim`, ISO `accessedAt` date in `YYYY-MM-DD` format, and allowed `sourceType`
- `sourceType` must be one of `official-documentation`, `official-repository`, `official-license`, `official-pricing`, `official-product-page`, `official-product-announcement`, `official-specification`, `official-legal`, or `official-release-notes`
- Replace `YYYY-MM-DD` with the date on which you actually read the cited source
- Passing schema validation does not prove that a source is first-party or supports the stated claim; editorial review verifies source ownership, claim support, and directory eligibility
- When included, `classificationRationaleMd` should explain the material agent role supported by those sources; the field is optional but useful for review
- The markdown body must not be empty
- Do not add `submittedBy` or `contentModifiedAt` to tool frontmatter; the repository manages attribution and modification time

### Inclusion and classification rules

- `agent-native`: agents are a core actor, runtime, abstraction, or participant
- `agent-enabling`: the tool materially empowers an agent-first workflow
- `agent-internet-protocol`: an interoperable protocol enables agents to communicate, transact, identify, coordinate, or interact online
- Use first-party product docs, specifications, official websites, or maintained repositories as evidence
- Generic technical compatibility, a thin MCP/API wrapper, or unsupported marketing does not qualify
- Choose the most specific class the evidence supports; classification is not a quality score or endorsement

Optional fields:

- Suggest a specific, factual `seoTitle` about the tool's agent use (usually about 50–60 characters), a `seoDescription` that helps a reader choose whether to open the profile (usually about 140–160 characters), and one short plain-text `agentSummary` paragraph about the practical agent-facing outcome (roughly 40–70 words). These are editorial drafting targets, not hard validation limits or automatic truncation rules. Avoid unsupported claims, keyword repetition, promotional language, and markdown or HTML. The title and description fall back independently when omitted; the summary appears before the existing visible description.
- `githubUrl` should be included when the tool is open source
- `logoUrl` can be included when the canonical logo URL is already known
- `ogImageUrl` can be included when the canonical social preview image is already known
- Missing logo and social preview URLs may be filled by repository automation; do not invent either URL
- `entityType` may be `software-application`, `web-application`, `software-source-code`, `web-api`, `service`, `technical-standard`, or `protocol`
- `developerName`, `docsUrl`, `pricingUrl`, and `licenseUrl` should be included when verified
- `interfaces` and `deploymentModes` should contain only documented capabilities
- `inclusionRationaleMd`, `bestForMd`, `notBestForMd`, `limitationsMd`, and `unknownsMd` are encouraged when evidence supports them
- `verificationLevel`, `reviewedBy`, and `reviewedAt` are maintained during editorial review; do not claim hands-on testing unless it actually occurred
- Set `reviewedBy` and `reviewedAt` together only after a real editorial review; set `publishedAt` only when its date is known
- `isIndexable` defaults to `true`; omit it unless there is a reviewed reason to change it
- `sortOrder` can be included when ordering matters

## Category file format

Only add a new category when the current taxonomy clearly does not fit. The example below is for a proposed category and is separate from the tool template above.

Create `categories/<slug>.json`:

```json
{
  "slug": "agent-security",
  "label": "Agent Security",
  "sortOrder": 110,
  "seoTitle": "Security tools for AI agents",
  "descriptionMd": "Security controls and review systems designed for agent-driven work.",
  "definitionMd": "This category covers products whose core purpose is controlling or inspecting agent actions and access.",
  "scopeMd": "Include first-class agent security workflows, not generic security APIs.",
  "inclusionMd": "Include when documented controls materially govern an agent's permissions, actions, or artifacts.",
  "exclusionMd": "Exclude conventional security products whose only agent connection is generic API access.",
  "selectionGuideMd": "Compare policy scope, enforcement points, audit evidence, identity model, and recovery controls.",
  "useCases": ["Constrain agent permissions", "Audit agent actions"],
  "sources": [
    {
      "title": "OWASP Agentic Security Initiative",
      "url": "https://genai.owasp.org/initiatives/agentic-security-initiative/",
      "claim": "OWASP documents security risks and controls that arise from autonomous agent workflows.",
      "accessedAt": "YYYY-MM-DD",
      "sourceType": "official-documentation"
    }
  ],
  "isIndexable": true
}
```

### Category rules

- `slug` must be lowercase kebab-case and must match the filename
- `label` should be short and readable
- A new category should describe a reusable capability area that could fit more than one tool
- `sortOrder` is optional and should be an integer when present
- Add a distinct `seoTitle`, description, definition, scope, inclusion/exclusion rules, selection guide, and concrete use cases
- `sources` is optional for categories. If included, each source needs a title, an HTTP or HTTPS URL, a specific claim, and the date checked; `sourceType` is optional but must use the controlled list above when present. Prefer first-party, claim-level sources for material category statements
- If you add a category, include at least one tool that uses it in the same PR
- Do not add `contentModifiedAt`; the publishing pipeline manages it

## Contribution commands

### Public contributor workflow (default)

This default works without write access to `bradvin/agentfirst.directory`. Use Node.js 24, `git`, and the GitHub CLI with a GitHub account. Run `gh auth login` first if `gh auth status` says you are not signed in. The `gh repo fork` command creates your fork or reuses it when it already exists. Keep upstream as `origin`; push only to the separate `fork` remote.

```bash
# Prerequisites: Node.js 24, git, GitHub CLI (gh), and a GitHub account
gh auth status
GH_USER="$(gh api user --jq .login)"
gh repo fork bradvin/agentfirst.directory --clone=false

git clone https://github.com/bradvin/agentfirst.directory.git
cd agentfirst.directory
git remote add fork "https://github.com/${GH_USER}/agentfirst.directory.git"
git checkout -b add-coolapi

# add or update content; add a category file only if no existing category fits
$EDITOR tools/coolapi.md
npm ci
npm run sync:tool-submitters -- --submitted-by "$GH_USER" --slug coolapi
npm test
npm run validate:content -- --require-submitters

git add tools/coolapi.md tool-submitters.json
# If you created a category, also stage categories/<slug>.json.
git commit -m "Add CoolAPI"
git push -u fork add-coolapi

gh pr create --repo bradvin/agentfirst.directory --base main \
  --head "${GH_USER}:add-coolapi" --title "Add CoolAPI" \
  --body "Explain why CoolAPI belongs and cite its first-party evidence."
```

Replace the sample PR title and body with the actual tool, eligibility rationale, and source links. For an existing tool, the submitter sync script preserves its recorded original submitter. For a new tool, it records the GitHub account opening the PR. Do not add author attribution to the tool frontmatter. If a fork PR's enrichment workflow asks for generated media or submitter metadata changes, run its suggested commands, commit the results, and push the branch again.

### Browser fallback

If `gh` is unavailable, sign in on GitHub and create or reuse your fork at `https://github.com/bradvin/agentfirst.directory/fork`. Before pushing, configure Git authentication for HTTPS with a credential manager or personal access token (or use your fork's SSH URL). Set `GH_USER="YOUR-USERNAME"`, follow the clone, separate `fork` remote, branch, commit, and push commands above (skipping the `gh` commands), then open this URL to create the PR against upstream `main`:

`https://github.com/bradvin/agentfirst.directory/compare/main...YOUR-USERNAME:add-coolapi?expand=1`

## Final checks

- Confirm the tool is not already listed
- Reuse an existing category when possible
- Confirm the tool's category slug exists or its new category file is included in the same PR
- Make sure all URLs are valid
- Confirm the tool passes the evidence-based inclusion test
- Include exactly one valid `classification`
- Cite first-party evidence for the material agent role
- Map every material factual claim to a source rather than adding a generic links list
- State limitations and unknowns instead of filling evidence gaps with assumptions
- Keep the body concise and factual
- Prefer adding a short `## So agents can...` section with concrete agent outcomes
- Run `npm run validate:content -- --require-submitters` after synchronizing `tool-submitters.json`
- Do not add author attribution to tool frontmatter; the repository script records it in `tool-submitters.json`
- Do not put listing-content changes in the site repo unless the user explicitly asked for site work
