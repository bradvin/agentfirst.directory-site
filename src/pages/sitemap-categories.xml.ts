import { cacheControl } from "../lib/cache";
import { getSitemapCategoryEntries } from "../lib/content";
import { renderSitemap } from "../lib/sitemap";

export async function GET() {
  const entries = await getSitemapCategoryEntries();

  return new Response(renderSitemap(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cacheControl.sitemap,
    },
  });
}
