import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: { command: "node node_modules/next/dist/bin/next start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000, env: { DATABASE_PATH: "./data/e2e-final.sqlite" } },
});
