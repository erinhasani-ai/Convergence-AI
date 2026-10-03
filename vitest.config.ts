import { defineConfig } from "vitest/config";
import path from "node:path";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: r("tests/empty.ts") },
      { find: "@contracts", replacement: r("packages/contracts/src/index.ts") },
      { find: /^@platform\/(.*)$/, replacement: r("packages/platform/src/$1") },
      // VEHICLEOS_MODULES_DIR (optional) runs the acceptance tests against an alternate module implementation.
      { find: /^@modules\/(.*)$/, replacement: process.env.VEHICLEOS_MODULES_DIR ? `${process.env.VEHICLEOS_MODULES_DIR}/$1` : r("modules/$1") },
      { find: /^@fixtures\/(.*)$/, replacement: r("fixtures/$1") },
    ],
  },
  test: { include: ["tests/**/*.test.ts"] },
});
