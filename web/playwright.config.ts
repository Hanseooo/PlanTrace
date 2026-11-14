import { defineConfig, devices } from "@playwright/test";

// BASE_URL set: test that deployed web app and its api; start nothing.
// Unset: start the api on :8000 and build and start the web app on :3000.
const externalBaseUrl = process.env.BASE_URL;
const LOCAL_WEB = "http://localhost:3000";
const LOCAL_API = "http://localhost:8000";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseUrl ?? LOCAL_WEB,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: "uv run --directory ../api uvicorn app.main:app --port 8000",
          url: `${LOCAL_API}/plans`,
          env: { CORS_ORIGINS: LOCAL_WEB },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "npm run build && npm run start",
          url: LOCAL_WEB,
          // NEXT_PUBLIC_* is baked in at build time.
          env: { NEXT_PUBLIC_API_URL: LOCAL_API },
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
