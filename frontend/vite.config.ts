import { defineConfig } from "vite";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  server: {
    proxy: {
      "/api":
        loadEnv(mode, process.cwd(), "CARE_API_PROXY").CARE_API_PROXY ||
        "http://127.0.0.1:8000",
    },
  },
}));
