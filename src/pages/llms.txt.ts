import type { APIRoute } from "astro";
import { cacheControl } from "../lib/cache";
import { getCategories } from "../lib/content";

export const GET: APIRoute = async () => {
  const categories = await getCategories();
  const categoryLinks = categories
    .map((category) => `- [${category.label}](https://agentfirst.directory/category/${category.slug})`)
    .join("\n");
  const body = `# Agent First Directory

> An evidence-led directory of tools built for AI agents: agent-native tools, agent-enabling infrastructure, and agent internet protocols.

This file is a discovery aid. Canonical HTML pages remain the authoritative, citable versions.

## Editorial and methodology

- [About](https://agentfirst.directory/about)
- [Editorial standards and review methodology](https://agentfirst.directory/editorial-standards)
- [Agent-first inclusion policy](https://agentfirst.directory/policy)
- [Corrections and appeals](https://agentfirst.directory/corrections)
- [State of Agent-First Infrastructure](https://agentfirst.directory/research/state-of-agent-first-infrastructure)

## Data and updates

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
