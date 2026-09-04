import type { APIRoute } from "astro";
import { getToolBySlug } from "../../../../lib/content";

const variants = {
  hero: {
    source: "ogImageUrl",
    fallback: "/og-default.png",
    width: 1200,
    height: 630,
    fit: "contain",
    quality: 78,
  },
  "hero-small": {
    source: "ogImageUrl",
    fallback: "/og-default.png",
    width: 640,
    height: 336,
    fit: "contain",
    quality: 74,
  },
  card: {
    source: "logoUrl",
    fallback: "/favicon.svg",
    width: 96,
    height: 96,
    fit: "contain",
    quality: 76,
  },
} as const;

const MAX_TRANSFORMED_BYTES = 350_000;

function fallbackResponse(path: string) {
  return new Response(null, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      Location: path,
      "X-Robots-Tag": "noindex",
    },
  });
}

export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug ?? "";
  const variantName = params.variant as keyof typeof variants;
  const variant = variants[variantName];

  if (!variant) {
    return new Response("Unknown image variant", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" },
    });
  }

  const tool = await getToolBySlug(slug);
  const sourceUrl = tool?.entry[variant.source];

  if (!sourceUrl) {
    return fallbackResponse(variant.fallback);
  }

  const accept = request.headers.get("accept") ?? "";
  const format = accept.includes("image/avif")
    ? "avif"
    : accept.includes("image/webp")
      ? "webp"
      : undefined;

  let response: Response;

  try {
    response = await fetch(sourceUrl, {
      headers: {
        Accept: format ? `image/${format},image/*;q=0.8` : "image/*",
        "User-Agent": "agentfirst.directory image optimizer/1.0",
      },
      cf: {
        image: {
          width: variant.width,
          height: variant.height,
          fit: variant.fit,
          quality: variant.quality,
          ...(format ? { format } : {}),
        },
      },
    } as RequestInit & { cf: { image: Record<string, unknown> } });
  } catch {
    return fallbackResponse(variant.fallback);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (
    !response.ok ||
    !contentType.startsWith("image/") ||
    (contentLength > 0 && contentLength > MAX_TRANSFORMED_BYTES)
  ) {
    await response.body?.cancel();
    return fallbackResponse(variant.fallback);
  }

  let body: ArrayBuffer;

  try {
    body = await response.arrayBuffer();
  } catch {
    return fallbackResponse(variant.fallback);
  }

  if (body.byteLength > MAX_TRANSFORMED_BYTES) {
    return fallbackResponse(variant.fallback);
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=2592000, stale-if-error=604800");
  headers.set("CDN-Cache-Control", "public, s-maxage=2592000, stale-if-error=604800");
  headers.set("Vary", "Accept");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex");
  headers.delete("Set-Cookie");

  headers.set("Content-Length", String(body.byteLength));

  return new Response(body, { status: response.status, headers });
};
