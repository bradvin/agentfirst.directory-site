import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  adapter: cloudflare({ imageService: "passthrough" }),
  session: {
    driver: sessionDrivers.lruCache(),
  },
  site: "https://agentfirst.directory",
  output: "server",
  trailingSlash: "never",
});
