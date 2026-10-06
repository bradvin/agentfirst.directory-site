import astroWorker from "@astrojs/cloudflare/entrypoints/server";
import { refreshPublicStats, type StatsCollectorEnv } from "./lib/stats-collector";

export default {
  fetch: astroWorker.fetch,
  scheduled(_event: ScheduledController, env: StatsCollectorEnv, ctx: ExecutionContext) {
    ctx.waitUntil(refreshPublicStats(env).then(() => undefined));
  },
};
