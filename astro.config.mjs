import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  adapter: cloudflare(),
  site: "https://agentfirst.directory",
  output: "server",
  trailingSlash: "never",
});
