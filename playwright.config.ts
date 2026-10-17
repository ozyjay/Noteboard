import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:web",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "browser",
      testMatch: ["browser/**/*.spec.ts", "model-discovery.spec.ts"],
    },
    { name: "desktop", testMatch: "desktop.spec.ts" },
  ],
});
