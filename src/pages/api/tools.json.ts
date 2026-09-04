import type { APIRoute } from "astro";
import { cacheControl } from "../../lib/cache";
import { getPublishedTools } from "../../lib/content";
import { dataReuseTerms, toolToPublicRecord } from "../../lib/data-export";

export const GET: APIRoute = async () => {
  const tools = await getPublishedTools();

  return Response.json(
    {
      schemaVersion: "1.0",
      canonicalUrl: "https://agentfirst.directory/api/tools.json",
      reuseTerms: dataReuseTerms,
      methodologyUrl: "https://agentfirst.directory/editorial-standards",
      count: tools.length,
      tools: tools.map(toolToPublicRecord),
    },
    {
      headers: {
        "Cache-Control": cacheControl.data,
        "CDN-Cache-Control": cacheControl.dataCdn,
        "Content-Type": "application/json; charset=utf-8",
        "X-Robots-Tag": "index, follow",
      },
    },
  );
};
