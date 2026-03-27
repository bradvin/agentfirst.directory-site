import { cacheControl } from "../lib/cache";
import { renderSitemapIndex } from "../lib/sitemap";

const SITEMAP_PATHS = [
  "/sitemap-pages.xml",
  "/sitemap-tools.xml",
  "/sitemap-categories.xml",
];

export function GET() {
  return new Response(renderSitemapIndex(SITEMAP_PATHS), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cacheControl.sitemap,
    },
  });
}
