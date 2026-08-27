import { describe, expect, it } from "vitest";
import { safePortalRedirect } from "@/lib/redirects";

describe("safePortalRedirect", () => {
  it("preserves legitimate portal destinations", () => {
    expect(safePortalRedirect("/portal/documents?from=login")).toBe("/portal/documents?from=login");
  });

  it.each([
    "https://attacker.example",
    "//attacker.example/path",
    "/portal/..//attacker.example",
    "/portal/%2e%2e//attacker.example",
    "/privacy",
    "/portal\\@attacker.example",
    "javascript:alert(1)",
  ])("rejects unsafe destination %s", (value) => {
    expect(safePortalRedirect(value)).toBe("/portal");
  });
});
