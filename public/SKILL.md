---
name: add-agentfirst-tool
description: Add an evidence-backed, classified tool or propose a category for agentfirst.directory by editing the content repository and opening a pull request.
compatibility: Requires git, GitHub access, and the ability to edit Markdown and JSON files.
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
- A pull request against `bradvin/agentfirst.directory`

## Workflow

1. Check whether the tool already exists in the content repo.
2. Apply the evidence-based inclusion test at `https://agentfirst.directory/policy`.
3. Choose exactly one supported classification.
4. Prefer an existing category when one fits.
5. Create or update the tool markdown file.
6. Add a short factual body and prefer including a `## So agents can...` section with concrete outcomes.
7. Create a category JSON file only if needed, and include at least one tool that uses it in the same PR.
8. Commit the changes on a branch and open a pull request against `main`.
9. In the PR description, cite first-party evidence and explain why the tool belongs in the directory.

## Tool file format

Create `tools/<slug>.md` with YAML frontmatter plus a short markdown body.

```md
---
slug: "coolapi"
name: "CoolAPI"
description: "An agent-first API for doing cool things"
category: "agent-security"
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
    sourceType: "official-docs"
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
- `category` must match an existing category slug unless you also add a new category in the same PR
- `tags` must contain at least one tag
- `websiteUrl` must be a valid `http` or `https` URL
- `pricing` must be one of `open-source`, `source-available`, `freemium`, `free`, `paid`, or `unknown`; use `unknown` rather than inferring a product fee from transaction value or a temporary credit
- `classification` must be one of `agent-native`, `agent-enabling`, or `agent-internet-protocol`
- `evidenceSources` must contain at least one first-party source with a title, URL, supported claim, and access date
- Replace `YYYY-MM-DD` with the date on which you actually read the cited source
- `classificationRationaleMd` must explain the material agent role supported by those sources
- The markdown body must not be empty

### Inclusion and classification rules

- `agent-native`: agents are a core actor, runtime, abstraction, or participant
- `agent-enabling`: the tool materially empowers an agent-first workflow
- `agent-internet-protocol`: an interoperable protocol enables agents to communicate, transact, identify, coordinate, or interact online
- Use first-party product docs, specifications, official websites, or maintained repositories as evidence
- Generic technical compatibility, a thin MCP/API wrapper, or unsupported marketing does not qualify
- Choose the most specific class the evidence supports; classification is not a quality score or endorsement

Optional fields:

- `githubUrl` should be included when the tool is open source
- `logoUrl` can be included when the canonical logo URL is already known
- `ogImageUrl` can be included when the canonical social preview image is already known
- `entityType` may be `software-application`, `web-application`, `software-source-code`, `web-api`, `service`, `technical-standard`, or `protocol`
- `developerName`, `docsUrl`, `pricingUrl`, and `licenseUrl` should be included when verified
- `interfaces` and `deploymentModes` should contain only documented capabilities
- `inclusionRationaleMd`, `bestForMd`, `notBestForMd`, `limitationsMd`, and `unknownsMd` are encouraged when evidence supports them
- `verificationLevel`, `reviewedBy`, and `reviewedAt` are maintained during editorial review; do not claim hands-on testing unless it actually occurred
- `sortOrder` can be included when ordering matters

## Category file format

Only add a new category when the current taxonomy clearly does not fit.

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
      "sourceType": "official-guidance"
    }
  ],
  "isIndexable": true
}
```

### Category rules

- `slug` must be lowercase kebab-case and must match the filename
- `label` should be short and readable
- `sortOrder` is optional and should be an integer when present
- Add a distinct `seoTitle`, description, definition, scope, inclusion/exclusion rules, selection guide, and concrete use cases
- Add at least one claim-level `sources` entry with the date on which the source was actually checked
- If you add a category, include at least one tool that uses it in the same PR

## Suggested commands

```bash
git clone https://github.com/bradvin/agentfirst.directory.git
cd agentfirst.directory
git checkout -b add-coolapi

$EDITOR tools/coolapi.md
$EDITOR categories/agent-security.json

git add .
git commit -m "Add CoolAPI"
git push origin add-coolapi
```

Then open a pull request against `main` in `bradvin/agentfirst.directory`.

## Final checks

- Confirm the tool is not already listed
- Reuse an existing category when possible
- Make sure all URLs are valid
- Confirm the tool passes the evidence-based inclusion test
- Include exactly one valid `classification`
- Cite first-party evidence for the material agent role
- Map every material factual claim to a source rather than adding a generic links list
- State limitations and unknowns instead of filling evidence gaps with assumptions
- Keep the body concise and factual
- Prefer adding a short `## So agents can...` section with concrete agent outcomes
- Do not add author attribution manually; it is derived from the PR author
- Do not put listing-content changes in the site repo unless the user explicitly asked for site work
