import { describe, expect, it } from "vitest";
import { parseIntroductionGateMode } from "@/lib/introduction-gate-mode";

describe("introduction gate mode", () => {
  it("defaults to real Stripe when the setting is absent or invalid", () => {
    expect(parseIntroductionGateMode(undefined)).toBe("stripe");
    expect(parseIntroductionGateMode("")).toBe("stripe");
    expect(parseIntroductionGateMode("MOCK")).toBe("stripe");
    expect(parseIntroductionGateMode("anything-else")).toBe("stripe");
  });

  it("enables mock mode only for the exact server setting", () => {
    expect(parseIntroductionGateMode("mock")).toBe("mock");
  });
});
