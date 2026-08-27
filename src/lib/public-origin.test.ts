import { describe, expect, it } from "vitest";
import { normalizePublicSiteOrigin, resolvePublicRequestOrigin } from "@/lib/public-origin";

describe("normalizePublicSiteOrigin", () => {
  it("normalizes a public HTTPS origin", () => {
    expect(normalizePublicSiteOrigin("https://mortgagemates.vercel.app/")).toBe("https://mortgagemates.vercel.app");
  });

  it.each([
    undefined,
    "http://mortgagemates.vercel.app",
    "https://localhost",
    "https://localhost./",
    "https://app.localhost",
    "https://127.0.0.1",
    "https://8.8.8.8",
    "https://[::1]",
    "https://mortgagemates.vercel.app/path",
    "https://user:pass@mortgagemates.vercel.app",
  ])("rejects non-public or non-origin value %s", (value) => {
    expect(() => normalizePublicSiteOrigin(value)).toThrow();
  });
});

describe("resolvePublicRequestOrigin", () => {
  const configured = "https://mortgagemates.vercel.app";
  const deploymentHost = "mortgagemates-abc-rorys-projects.vercel.app";

  it("accepts the configured public origin", () => {
    expect(resolvePublicRequestOrigin(configured, configured, deploymentHost)).toBe(configured);
  });

  it("accepts only the current Vercel deployment origin as an alternative", () => {
    const deployment = `https://${deploymentHost}`;
    expect(resolvePublicRequestOrigin(configured, deployment, deploymentHost)).toBe(deployment);
    expect(() => resolvePublicRequestOrigin(configured, "https://mortgagemates-other.vercel.app", deploymentHost)).toThrow();
  });

  it.each([
    "http://mortgagemates-abc-rorys-projects.vercel.app",
    "https://localhost",
    "https://127.0.0.1",
  ])("rejects unsafe request origin %s", (origin) => {
    expect(() => resolvePublicRequestOrigin(configured, origin, deploymentHost)).toThrow();
  });
});
