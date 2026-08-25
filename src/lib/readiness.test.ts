import { describe, expect, it } from "vitest";
import { calculateReadiness, latestDocumentsByRequirement } from "@/lib/readiness";

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
});
