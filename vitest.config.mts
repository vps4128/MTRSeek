import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * The parsers are plain TypeScript with no React and no Next.js in them, so
 * they run in a bare Node environment — no jsdom, no setup files.
 *
 * The `@/` alias is declared here rather than through a plugin so that the test
 * runner resolves imports by exactly the same rule `tsconfig.json` gives the
 * app; a parser that imports `@/lib/analysis/types` has to work in both.
 */
const root = fileURLToPath(new URL("./", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
