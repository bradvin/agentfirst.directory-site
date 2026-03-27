---
name: add-agentfirst-tool
description: Add a new tool or propose a new category for agentfirst.directory by editing the content repository, creating the required markdown or JSON files, and opening a pull request with a concise justification.
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
2. Prefer an existing category when one fits.
3. Create or update the tool markdown file.
4. Create a category JSON file only if needed, and include at least one tool that uses it in the same PR.
5. Commit the changes on a branch and open a pull request against `main`.
6. In the PR description, explain briefly why the tool belongs in the directory.

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
pricing: "freemium"
submittedBy: "your-github-handle"
---

Short summary of what the tool does.
```

### Tool rules

- `slug` must be lowercase kebab-case and must match the filename
- `name` must be the public tool name
- `description` must be a short summary
- `category` must match an existing category slug unless you also add a new category in the same PR
- `tags` must contain at least one tag
- `websiteUrl` must be a valid `http` or `https` URL
- `pricing` must be one of `open-source`, `freemium`, `free`, or `paid`
- `submittedBy` must be a valid GitHub username
- The markdown body must not be empty

## Category file format

Only add a new category when the current taxonomy clearly does not fit.

Create `categories/<slug>.json`:

```json
{
  "slug": "agent-security",
  "label": "Agent Security",
  "sortOrder": 110
}
```

### Category rules

- `slug` must be lowercase kebab-case and must match the filename
- `label` should be short and readable
- `sortOrder` is optional and should be an integer when present
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
- Keep the body concise and factual
- Do not put listing-content changes in the site repo unless the user explicitly asked for site work
