import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const accessUrl = process.env.PLAYWRIGHT_ACCESS_URL;
const publicRoutes = [
  "/",
  "/eligibility",
  "/preview",
  "/login",
  "/terms",
  "/privacy",
  "/complaints",
  "/accessibility",
] as const;

test.beforeEach(async ({ page }) => {
  if (accessUrl) await page.goto(accessUrl);
});

for (const route of publicRoutes) {
  test(`${route} has no automated WCAG A or AA violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("public navigation is keyboard reachable and visibly focused", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible");
  await expect(focused).toBeVisible();
  await expect(focused).toHaveAttribute("href", "/");
});

test("public routes do not emit browser errors or failed requests", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const isCancelledNextPrefetch =
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      new URL(request.url()).searchParams.has("_rsc");
    if (isCancelledNextPrefetch) return;
    errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });

  for (const route of publicRoutes) {
    await page.goto(route, { waitUntil: "networkidle" });
  }
  expect(errors, errors.join("\n")).toEqual([]);
});
