export const cacheControl = {
  homepage: "public, s-maxage=300, stale-while-revalidate=86400",
  category: "public, s-maxage=900, stale-while-revalidate=86400",
  tool: "public, s-maxage=3600, stale-while-revalidate=86400",
  sitemap: "public, s-maxage=300, stale-while-revalidate=3600",
  data: "public, max-age=300, stale-while-revalidate=3600",
  dataCdn: "public, s-maxage=900, stale-while-revalidate=86400",
} as const;

export interface SharedCachePolicy {
  cacheControl: (typeof cacheControl)[keyof typeof cacheControl];
  cdnCacheControl: string;
  edgeTtlSeconds: number;
}

export const sharedCachePolicies = {
  homepage: {
    cacheControl: cacheControl.homepage,
    cdnCacheControl: "public, max-age=300, stale-while-revalidate=86400",
    edgeTtlSeconds: 300,
  },
  category: {
    cacheControl: cacheControl.category,
    cdnCacheControl: "public, max-age=900, stale-while-revalidate=86400",
    edgeTtlSeconds: 900,
  },
  tool: {
    cacheControl: cacheControl.tool,
    cdnCacheControl: "public, max-age=3600, stale-while-revalidate=86400",
    edgeTtlSeconds: 3_600,
  },
  sitemap: {
    cacheControl: cacheControl.sitemap,
    cdnCacheControl: "public, max-age=300, stale-while-revalidate=3600",
    edgeTtlSeconds: 300,
  },
  data: {
    cacheControl: cacheControl.data,
    cdnCacheControl: cacheControl.dataCdn,
    edgeTtlSeconds: 900,
  },
} as const satisfies Record<string, SharedCachePolicy>;

const sitemapPaths = new Set([
  "/sitemap-index.xml",
  "/sitemap-pages.xml",
  "/sitemap-categories.xml",
  "/sitemap-tools.xml",
]);

const dataPaths = new Set([
  "/api/tools.json",
  "/data/agent-first-tools.csv",
  "/feed.xml",
  "/llms-full.txt",
  "/llms.txt",
]);

/** Returns the shared-cache policy for the site's intentionally cacheable SSR routes. */
export function getSharedCachePolicy(pathname: string): SharedCachePolicy | undefined {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  if (normalizedPath === "/") return sharedCachePolicies.homepage;
  if (normalizedPath === "/open-source-ai-agent-tools") return sharedCachePolicies.category;
  if (/^\/category\/[^/]+$/.test(normalizedPath)) return sharedCachePolicies.category;
  if (/^\/tools\/[^/]+$/.test(normalizedPath)) return sharedCachePolicies.tool;
  if (sitemapPaths.has(normalizedPath)) return sharedCachePolicies.sitemap;
  if (dataPaths.has(normalizedPath)) return sharedCachePolicies.data;

  return undefined;
}

export function setCacheControl(headers: Headers, value: string) {
  headers.set("Cache-Control", value);
}
