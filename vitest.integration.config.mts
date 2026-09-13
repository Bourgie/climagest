import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Los tests crean usuarios vía Supabase Auth (admin API); en paralelo se
    // dispara el rate limiting. Serializar los archivos evita flakiness.
    fileParallelism: false,
  },
});
