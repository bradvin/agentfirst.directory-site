export const canonicalOrigin = "https://agentfirst.directory";

const canonicalHost = new URL(canonicalOrigin).hostname;
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

const supportedSharedCacheContentTypes = [
  "text/html",
  "application/xml",
  "application/json",
  "application/rss+xml",
  "text/csv",
  "text/plain",
  "text/xml",
] as const;

export interface RequestCacheDecision {
  isLocal: boolean;
  methodCanBeCached: boolean;
  containsPrivateRequestData: boolean;
  canUseSharedCache: boolean;
  forceRefresh: boolean;
}

export interface ResponseCacheDecision {
  isCacheableResponse: boolean;
  mustRemainPrivate: boolean;
}

export function isLocalHost(hostname: string): boolean {
  return localHosts.has(hostname) || hostname.endsWith(".localhost");
}

/** Returns the production canonical URL, or undefined when no redirect is needed. */
export function getCanonicalRedirectLocation(url: URL): string | undefined {
  if (
    isLocalHost(url.hostname) ||
    (url.protocol === "https:" && url.hostname === canonicalHost && url.port === "")
  ) {
    return undefined;
  }

  const location = new URL(canonicalOrigin);
  location.pathname = url.pathname;
  location.search = url.search;
  return location.toString();
}

export function hasCacheDirective(header: string, directive: string): boolean {
  return header
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .some((value) => value === directive || value.startsWith(`${directive}=`));
}

function hasZeroMaxAge(header: string): boolean {
  return header
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .some((value) => /^max-age\s*=\s*0$/.test(value));
}

export function getRequestCacheDecision(
  url: URL,
  method: string,
  headers: Headers,
  hasCachePolicy: boolean,
): RequestCacheDecision {
  const isLocal = isLocalHost(url.hostname);
  const methodCanBeCached = method === "GET" || method === "HEAD";
  const requestCacheControl = headers.get("Cache-Control") ?? "";
  const containsPrivateRequestData = Boolean(
    url.search ||
      headers.get("Authorization") ||
      headers.get("Cookie") ||
      headers.get("Range") ||
      hasCacheDirective(requestCacheControl, "no-store"),
  );
  const canUseSharedCache = Boolean(
    hasCachePolicy && !isLocal && methodCanBeCached && !containsPrivateRequestData,
  );
  const forceRefresh =
    hasCacheDirective(requestCacheControl, "no-cache") ||
    hasZeroMaxAge(requestCacheControl) ||
    headers.get("Pragma")?.toLowerCase() === "no-cache";

  return {
    isLocal,
    methodCanBeCached,
    containsPrivateRequestData,
    canUseSharedCache,
    forceRefresh,
  };
}

export function getResponseCacheDecision(
  requestDecision: RequestCacheDecision,
  hasCachePolicy: boolean,
  status: number,
  headers: Headers,
): ResponseCacheDecision {
  const contentType = (headers.get("Content-Type") ?? "").toLowerCase();
  const responseCacheControl = headers.get("Cache-Control") ?? "";
  const responseForbidsSharedCache =
    hasCacheDirective(responseCacheControl, "private") ||
    hasCacheDirective(responseCacheControl, "no-store");
  const variesOnEverything = (headers.get("Vary") ?? "")
    .split(",")
    .some((value) => value.trim() === "*");
  const hasSupportedContentType = supportedSharedCacheContentTypes.some((value) =>
    contentType.startsWith(value),
  );
  const responseHasCookie = headers.has("Set-Cookie");
  const isCacheableResponse = Boolean(
    hasCachePolicy &&
      requestDecision.canUseSharedCache &&
      status === 200 &&
      !responseForbidsSharedCache &&
      !responseHasCookie &&
      !variesOnEverything &&
      hasSupportedContentType,
  );
  const mustRemainPrivate = Boolean(
    !requestDecision.isLocal &&
      hasCachePolicy &&
      (!requestDecision.methodCanBeCached ||
        requestDecision.containsPrivateRequestData ||
        status !== 200 ||
        responseForbidsSharedCache ||
        responseHasCookie ||
        variesOnEverything ||
        !hasSupportedContentType),
  );

  return { isCacheableResponse, mustRemainPrivate };
}
