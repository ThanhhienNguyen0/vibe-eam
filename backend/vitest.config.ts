import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Built test copies in dist must never be collected after npm run build.
    include: ["src/**/*.test.ts"],
  },
});
