import path from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname, "..");

export default defineConfig({
  root: projectRoot,
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.join(projectRoot, "client", "src"),
      "@shared": path.join(projectRoot, "shared"),
    },
  },
  test: {
    environment: "node",
    include: [
      "shared/booth*.test.ts",
      "client/src/**/booth*.test.ts",
      "client/src/**/Booth*.test.ts",
    ],
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
  },
});
