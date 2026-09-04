import type { APIRoute } from "astro";
import { cacheControl } from "../lib/cache";
import { getPublishedTools } from "../lib/content";
import { absoluteUrl } from "../lib/seo";
import { siteConfig } from "../lib/site";
import { xmlEscape } from "../lib/data-export";

function itemDate(tool: Awaited<ReturnType<typeof getPublishedTools>>[number]) {
  return tool.entry.contentModifiedAt ?? tool.entry.publishedAt ?? tool.entry.reviewedAt;
}

export const GET: APIRoute = async () => {
  const tools = (await getPublishedTools()).toSorted((left, right) =>
    (itemDate(right) ?? "").localeCompare(itemDate(left) ?? "") ||
    left.entry.name.localeCompare(right.entry.name),
  );
  const datedTools = tools.filter((tool) => itemDate(tool));
  const items = tools.slice(0, 50).map((tool) => {
    const link = absoluteUrl(`/tools/${tool.entry.slug}`);
    const date = itemDate(tool);
    return [
      "    <item>",
      `      <title>${xmlEscape(tool.entry.name)}</title>`,
      `      <link>${xmlEscape(link)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(link)}</guid>`,
      `      <description>${xmlEscape(tool.entry.description)}</description>`,
      date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>` : "",
      `      <category>${xmlEscape(tool.category.label)}</category>`,
      "    </item>",
    ].filter(Boolean).join("\n");
  }).join("\n");
  const latestDate = datedTools[0] ? itemDate(datedTools[0]) : undefined;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${xmlEscape(siteConfig.name)}</title>`,
    `    <link>${xmlEscape(siteConfig.url)}</link>`,
    `    <description>${xmlEscape(siteConfig.description)}</description>`,
    `    <language>en</language>`,
    `    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${absoluteUrl("/feed.xml")}" rel="self" type="application/rss+xml" />`,
    latestDate ? `    <lastBuildDate>${new Date(latestDate).toUTCString()}</lastBuildDate>` : "",
    items,
    "  </channel>",
    "</rss>",
  ].filter(Boolean).join("\n");

  return new Response(xml, {
    headers: {
      "Cache-Control": cacheControl.data,
      "CDN-Cache-Control": cacheControl.dataCdn,
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
