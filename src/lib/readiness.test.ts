import { describe, expect, it } from "vitest";
import { calculateReadiness, effectiveDocumentStatus, latestDocumentsByRequirement } from "@/lib/readiness";

describe("document readiness", () => {
  it("counts only required accepted documents", () => {
    const result = calculateReadiness(["id", "payslips", "bank"], [
      { requirement_id: "id", status: "accepted", created_at: "2026-08-25T10:00:00Z" },
      { requirement_id: "payslips", status: "under_review", created_at: "2026-08-25T10:00:00Z" },
      { requirement_id: "gift", status: "accepted", created_at: "2026-08-25T10:00:00Z" },
    ]);
    expect(result).toEqual({ accepted: 1, uploaded: 2, required: 3, percent: 33 });
  });

  it("uses the newest upload for each requirement", () => {
    const latest = latestDocumentsByRequirement([
      { requirement_id: "bank", status: "needs_update", created_at: "2026-08-20T10:00:00Z" },
      { requirement_id: "bank", status: "accepted", created_at: "2026-08-25T10:00:00Z" },
    ]);
    expect(latest.get("bank")?.status).toBe("accepted");
  });

  it("returns zero percent for an empty checklist", () => {
    expect(calculateReadiness([], [])).toEqual({ accepted: 0, uploaded: 0, required: 0, percent: 0 });
  });

  it("does not count an expired accepted document", () => {
    const document = {
      requirement_id: "bank",
      status: "accepted",
      expiry_date: "2026-08-25",
      created_at: "2026-08-20T10:00:00Z",
    };
    expect(calculateReadiness(["bank"], [document], new Date("2026-08-26T12:00:00Z"))).toEqual({
      accepted: 0,
      uploaded: 1,
      required: 1,
      percent: 0,
    });
    expect(effectiveDocumentStatus(document, new Date("2026-08-26T12:00:00Z"))).toBe("expired");
  });
});
