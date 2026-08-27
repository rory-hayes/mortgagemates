import { defineConfig, devices } from "@playwright/test";
import { normalizePublicSiteOrigin } from "./src/lib/public-origin";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://mortgagemates.vercel.app";
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const publicTarget = normalizePublicSiteOrigin(baseURL);
const accessUrl = process.env.PLAYWRIGHT_ACCESS_URL;
if (accessUrl) normalizePublicSiteOrigin(new URL(accessUrl).origin);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: publicTarget,
    extraHTTPHeaders: protectionBypass ? { "x-vercel-protection-bypass": protectionBypass } : undefined,
    trace: protectionBypass ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
