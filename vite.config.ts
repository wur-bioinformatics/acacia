import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import wasm from "vite-plugin-wasm";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  build: {
    target: "esnext",
  },
  plugins: [wasm(), react(), svgr(), tailwindcss()],
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.*", "src/**/types.ts", "src/**/*.d.ts"],
    },
  },
});
