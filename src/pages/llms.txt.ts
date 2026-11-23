import type { APIRoute } from "astro";
import { cacheControl } from "../lib/cache";
import { getCategories } from "../lib/content";
import { editorialPolicy } from "../lib/category-editorial";

export const GET: APIRoute = async () => {
  const categories = await getCategories();
  const categoryLinks = categories
    .map((category) => `- [${category.label}](https://agentfirst.directory/category/${category.slug})`)
    .join("\n");
  const body = `# Agent First Directory

> An evidence-led directory of tools for agents and people building, running and working with agents, plus agent-first protocols and standards.

This file is a discovery aid. Canonical HTML pages remain the authoritative, citable versions.

## Inclusion policy v${editorialPolicy.version}

${editorialPolicy.policySummary}

Full policy: https://agentfirst.directory/policy
Adopted source: ${editorialPolicy.sourceUrl}
Submission review and publishing remain paused; this policy update does not restart them or activate the installed reviewer.

## Editorial and methodology

- [About](https://agentfirst.directory/about)
- [Editorial standards and review methodology](https://agentfirst.directory/editorial-standards)
- [Agent-first inclusion policy](https://agentfirst.directory/policy)
- [Corrections and appeals](https://agentfirst.directory/corrections)
- [State of Agent-First Infrastructure](https://agentfirst.directory/research/state-of-agent-first-infrastructure)

## Data and updates

- [Public website traffic statistics and measurement caveats](https://agentfirst.directory/stats)
- [Public traffic snapshot JSON](https://agentfirst.directory/stats.json)
- [Published tools JSON](https://agentfirst.directory/api/tools.json)
- [Published tools CSV](https://agentfirst.directory/data/agent-first-tools.csv)
- [Recently updated tools feed](https://agentfirst.directory/feed.xml)
- [Full AI-readable directory](https://agentfirst.directory/llms-full.txt)
- [XML sitemap index](https://agentfirst.directory/sitemap-index.xml)

## Categories

${categoryLinks}

## Contribute

- [Agent contribution instructions](https://agentfirst.directory/SKILL.md)
- [Public content repository](https://github.com/bradvin/agentfirst.directory)
`;

  return new Response(body, {
    headers: {
      "Cache-Control": cacheControl.data,
      "CDN-Cache-Control": cacheControl.dataCdn,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
