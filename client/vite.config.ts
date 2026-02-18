import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
