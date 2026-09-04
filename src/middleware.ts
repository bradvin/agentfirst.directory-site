import { defineMiddleware } from "astro:middleware";
import { getSharedCachePolicy, type SharedCachePolicy } from "./lib/cache";
import {
  getCanonicalRedirectLocation,
  getRequestCacheDecision,
  getResponseCacheDecision,
  isLocalHost,
} from "./lib/middleware-policy";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://giscus.app https://static.cloudflareinsights.com",
  "frame-src https://giscus.app",
  "connect-src 'self' https://giscus.app https://api.github.com https://github.com https://cloudflareinsights.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = {
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

function addResponseHeaders(
  response: Response,
  url: URL,
  cachePolicy?: SharedCachePolicy,
  privateResponse = false,
): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }

  if (!isLocalHost(url.hostname)) {
    headers.set("Content-Security-Policy", contentSecurityPolicy);

    if (url.protocol === "https:") {
      headers.set("Strict-Transport-Security", "max-age=31536000");
    }
  }

  if (privateResponse) {
    headers.set("Cache-Control", "private, no-store");
    headers.delete("CDN-Cache-Control");
  } else if (cachePolicy) {
    headers.set("Cache-Control", cachePolicy.cacheControl);
    headers.set("CDN-Cache-Control", cachePolicy.cdnCacheControl);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function canonicalRedirect(url: URL, location: string): Response {
  const response = new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": "public, max-age=3600",
      Location: location,
    },
  });

  return addResponseHeaders(response, url);
}

function getDefaultCache(): Cache | undefined {
  try {
    return (caches as CacheStorage & { readonly default: Cache }).default;
  } catch {
    return undefined;
  }
}

function cacheKeyFor(url: URL): Request {
  return new Request(url.toString(), { method: "GET" });
}

function withoutBody(response: Response): Response {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function prepareForEdgeCache(response: Response, cachePolicy: SharedCachePolicy): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${cachePolicy.edgeTtlSeconds}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const canonicalRedirectLocation = getCanonicalRedirectLocation(url);

  if (canonicalRedirectLocation) {
    return canonicalRedirect(url, canonicalRedirectLocation);
  }

  const cachePolicy = getSharedCachePolicy(url.pathname);
  const requestCacheDecision = getRequestCacheDecision(
    url,
    request.method,
    request.headers,
    Boolean(cachePolicy),
  );
  const edgeCache = requestCacheDecision.canUseSharedCache ? getDefaultCache() : undefined;
  const cacheKey = edgeCache ? cacheKeyFor(url) : undefined;

  if (edgeCache && cacheKey && !requestCacheDecision.forceRefresh) {
    const cachedResponse = await edgeCache.match(cacheKey).catch(() => undefined);

    if (cachedResponse) {
      const response = addResponseHeaders(cachedResponse, url, cachePolicy);
      return request.method === "HEAD" ? withoutBody(response) : response;
    }
  }

  const response = await next();
  const { isCacheableResponse, mustRemainPrivate } = getResponseCacheDecision(
    requestCacheDecision,
    Boolean(cachePolicy),
    response.status,
    response.headers,
  );
  const responseWithHeaders = addResponseHeaders(
    response,
    url,
    isCacheableResponse ? cachePolicy : undefined,
    mustRemainPrivate,
  );

  if (edgeCache && cacheKey && isCacheableResponse && request.method === "GET") {
    const cacheableResponse = prepareForEdgeCache(responseWithHeaders.clone(), cachePolicy!);
    context.locals.cfContext.waitUntil(edgeCache.put(cacheKey, cacheableResponse).catch(() => undefined));
  }

  return responseWithHeaders;
});
