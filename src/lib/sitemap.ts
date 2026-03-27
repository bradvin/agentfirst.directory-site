import type { SitemapEntry } from "./content";
import { absoluteUrl } from "./seo";

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeLastModified(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
}

export function renderSitemap(entries: SitemapEntry[]) {
  const urls = entries
    .map((entry) => {
      const lastModified = normalizeLastModified(entry.lastModified);
      return [
        "  <url>",
        `    <loc>${xmlEscape(absoluteUrl(entry.path))}</loc>`,
        lastModified ? `    <lastmod>${xmlEscape(lastModified)}</lastmod>` : "",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
}

export function renderSitemapIndex(paths: string[]) {
  const entries = paths
    .map(
      (path) => [
        "  <sitemap>",
        `    <loc>${xmlEscape(absoluteUrl(path))}</loc>`,
        "  </sitemap>",
      ].join("\n"),
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</sitemapindex>",
  ].join("\n");
}
