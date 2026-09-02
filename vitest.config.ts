import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "e2e/lib/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Allow unit tests to import server-only modules (admin helpers, etc.).
      "server-only": path.resolve(__dirname, "./test/server-only-stub.ts"),
    },
  },
});
