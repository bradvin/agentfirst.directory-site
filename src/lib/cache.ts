export const cacheControl = {
  homepage: "public, s-maxage=300, stale-while-revalidate=86400",
  category: "public, s-maxage=900, stale-while-revalidate=86400",
  tool: "public, s-maxage=3600, stale-while-revalidate=86400",
  sitemap: "public, s-maxage=300, stale-while-revalidate=3600",
} as const;

export function setCacheControl(headers: Headers, value: string) {
  headers.set("Cache-Control", value);
}
