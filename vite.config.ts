import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "maths",
              test: /node_modules[\\/]katex[\\/]/,
              priority: 20,
            },
            {
              name: "canvas",
              test: /node_modules[\\/](@xyflow[\\/]|d3-[^\\/]+[\\/]|zustand[\\/])/,
              priority: 20,
            },
            { name: "vendor", test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: { include: ["tests/**/*.test.{ts,tsx}"], environment: "node" },
});
