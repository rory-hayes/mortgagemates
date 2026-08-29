import { expect, test } from "@playwright/test";
import { normalizePublicSiteOrigin } from "../src/lib/public-origin";

const accessUrl = process.env.PLAYWRIGHT_ACCESS_URL;
const expectedOrigin = normalizePublicSiteOrigin(
  process.env.PLAYWRIGHT_BASE_URL ?? "https://mortgagemates.vercel.app",
);

test.beforeEach(async ({ page }) => {
  if (accessUrl) await page.goto(accessUrl);
});

test("public journey is navigable and uses the intended home image", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/MortgageMates/);
  await expect(page.getByRole("heading", { level: 1, name: /Buy together/i })).toBeVisible();
  const home = page.getByAltText(/red-brick Dublin end-terrace/i);
  await expect(home).toBeVisible();
  await expect(home).toHaveJSProperty("complete", true);
  await page.getByRole("link", { name: "Check my eligibility" }).first().click();
  await expect(page).toHaveURL(/\/eligibility$/);
  await expect(page.getByRole("heading", { level: 1, name: /Is this pilot right for you/i })).toBeVisible();
});

test("sample portal tabs stay addressable", async ({ page }) => {
  await page.goto("/preview");
  await expect(page.getByText("every person and document below is fictional")).toBeVisible();
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page).toHaveURL(/\/preview\?view=documents$/);
  await expect(page.getByRole("heading", { level: 1, name: /Be ready before you match/i })).toBeVisible();
  await page.getByRole("tab", { name: "Alignment" }).click();
  await expect(page).toHaveURL(/\/preview\?view=alignment$/);
  await page.getByRole("tab", { name: "Admin" }).click();
  await expect(page).toHaveURL(/\/preview\?view=admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Matching run monitor" })).toBeVisible();
  await expect(page.getByText(/administrators monitor safety/i)).toBeVisible();
  await expect(page.getByText("Recent automated runs")).toBeVisible();
  await expect(page.getByText("Pair review", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create proposal", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Propose", exact: true })).toHaveCount(0);
});

test("mobile sample documents expose every status and action without horizontal page overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile layout regression");
  await page.goto("/preview?view=documents", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Upload Salary certificate" })).toBeInViewport();
  await expect(page.getByText("Under review", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Upload|Download|No action) / })).toHaveCount(9);
  const pageWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
});

test("investor trial is public and its hard-gate hold is live", async ({ page, request }) => {
  await page.goto("/investor-trial");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /See how one considered match is made/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Run live AI match" })).toBeVisible();
  await expect(page.getByRole("combobox").nth(2)).toContainText(
    "€50,000–€74,999",
  );

  const response = await request.post("/api/investor-trial/match", {
    data: {
      targetLocation: "Blackrock",
      propertyType: "House",
      depositRange: "€35,000–€49,999",
      borrowingRange: "€220,000–€259,999",
      monthlyRange: "€1,200–€1,399",
      purchaseTimeline: "3–6 months",
      ownershipHorizon: "10+ years",
      householdRhythm: "quiet",
      workFromHome: "some_days",
      pets: "none",
    },
  });
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({
    result: {
      source: "rules",
      decision: "hold",
      eligibleCandidateCount: 0,
    },
    candidate: null,
  });
});

test("protected pages redirect to authentication", async ({ page }) => {
  await page.goto("/portal/settings");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: /Prepared before/i })).toBeVisible();
});

test("security headers and production-origin boundary are present", async ({ request }) => {
  if (accessUrl) await request.get(accessUrl);
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();
  expect(new URL(response.url()).origin).toBe(expectedOrigin);
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["strict-transport-security"]).toContain("max-age=");
  const body = await response.text();
  expect(body).toContain("MortgageMates");
  expect(body).not.toContain("localhost");
});

test("unknown routes use the branded not-found page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: /This door does not open/i })).toBeVisible();
});
