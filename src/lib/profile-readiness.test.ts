import { describe, expect, it } from "vitest";
import { profileIssuesForStep, profileSubmissionIssues, type BuyerProfileDraft } from "@/lib/profile-readiness";

const completeDraft: BuyerProfileDraft = {
  firstName: "Rory",
  ageBand: "35–39",
  firstTimeBuyer: true,
  irishResident: true,
    ownerOccupier: true,
    unrelated: true,
    pairOnly: true,
  timeline: "6–12 months",
  income: "€50,000–€59,999",
  deposit: "€35,000–€49,999",
  borrowing: "€220,000–€259,999",
  monthly: "€1,200–€1,399",
  locations: ["South Dublin"],
  propertyTypes: ["Terraced house"],
  household: { noise: "Quiet", workFromHome: "2–3 days", guests: "Occasional", pets: "Discuss" },
  ownership: { horizon: "5–7 years", shares: "Discuss", earlyExit: "Valuation", missedPayments: "Buffer" },
};

describe("profile readiness", () => {
  it("accepts a complete profile with explicit consent", () => {
    expect(profileSubmissionIssues(completeDraft, { terms: true, privacy: true, risk: true })).toEqual([]);
  });

  it("blocks incomplete eligibility and missing consent", () => {
    const issues = profileSubmissionIssues(
      { ...completeDraft, firstTimeBuyer: false },
      { terms: false, privacy: false, risk: false },
    );
    expect(issues).toContain("Confirm that you are a first-time buyer.");
    expect(issues).toContain("Accept the pilot terms.");
    expect(issues).toContain("Accept the privacy notice.");
    expect(issues).toContain("Acknowledge the financial and legal risks.");
  });

  it("validates each step before navigation", () => {
    expect(profileIssuesForStep({ ...completeDraft, locations: [] }, 4)).toEqual([
      "Choose at least one target location.",
    ]);
  });
});
