import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildHash =
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_REF ||
  process.env.BUILD_ID ||
  "dev";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:4000" } },
  define: {
    __BUILD__: JSON.stringify(buildHash)
  }
});
