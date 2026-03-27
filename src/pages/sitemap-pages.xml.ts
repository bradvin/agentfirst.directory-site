import { cacheControl } from "../lib/cache";
import { getSitemapStaticEntries } from "../lib/content";
import { renderSitemap } from "../lib/sitemap";

export function GET() {
  return new Response(renderSitemap(getSitemapStaticEntries()), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cacheControl.sitemap,
    },
  });
}
