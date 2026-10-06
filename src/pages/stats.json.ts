import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { publicStatsResponse, readPublicStats } from "../lib/public-stats";

// Public requests only read the stored aggregate projection, never the upstream API.
export const GET: APIRoute = async () => publicStatsResponse(await readPublicStats(env.DB));
