import { describe, expect, it } from "vitest";

import {
  fictionalCandidates,
  matchingProfileFromTrial,
  TrialProfileInputSchema,
} from "@/lib/matching/trial-data";

describe("investor matching trial data", () => {
  it("contains only bounded fictional profiles with unique opaque IDs", () => {
    expect(fictionalCandidates).toHaveLength(6);
    expect(new Set(fictionalCandidates.map((item) => item.candidateId)).size).toBe(6);
    for (const candidate of fictionalCandidates) {
      expect(candidate.candidateId).toMatch(/^candidate_[a-z]+$/);
      expect(candidate.profile.targetLocations.length).toBeGreaterThan(0);
      expect(candidate.profile.propertyTypes.length).toBeGreaterThan(0);
    }
  });

  it("turns the default investor form shape into model-ready ranges", () => {
    const input = TrialProfileInputSchema.parse({
      targetLocation: "Dún Laoghaire",
      propertyType: "House",
      depositRange: "€35,000–€49,999",
      borrowingRange: "€220,000–€259,999",
      monthlyRange: "€1,200–€1,399",
      purchaseTimeline: "6–12 months",
      ownershipHorizon: "5–7 years",
      householdRhythm: "balanced",
      workFromHome: "some_days",
      pets: "open_to_pets",
    });
    expect(matchingProfileFromTrial(input)).toMatchObject({
      deposit: { min: 35_000, max: 49_999 },
      borrowing: { min: 220_000, max: 259_999 },
      monthlyHousingBudget: { min: 1_200, max: 1_399 },
    });
  });
});
