import { describe, expect, it } from "vitest";

import {
  matchingProfileFromDatabase,
  passesDeterministicMatchingGates,
  type DatabaseBuyerPreferences,
} from "@/lib/matching/member-profile";

const preferences: DatabaseBuyerPreferences = {
  deposit_range: "€35,000–€49,999",
  borrowing_range: "€220,000–€259,999",
  monthly_housing_budget_range: "€1,200–€1,399",
  target_locations: ["Dún Laoghaire–Rathdown", "South Dublin"],
  property_types: ["Terraced house", "Townhouse"],
  must_haves: [],
  purchase_timeline: "6–12 months",
  household_preferences: {
    noise: "Balanced",
    workFromHome: "2–3 days",
    guests: "Occasional",
    pets: "Open to discussing",
  },
  ownership_expectations: { horizon: "5–7 years" },
};

describe("member matching profile", () => {
  it("converts database labels into a sanitised model profile", () => {
    expect(matchingProfileFromDatabase(preferences)).toMatchObject({
      deposit: { min: 35_000, max: 49_999 },
      borrowing: { min: 220_000, max: 259_999 },
      purchaseTimeline: "6–12 months",
      ownershipHorizon: "5–7 years",
      household: {
        noise: "balanced",
        workFromHome: "some_days",
        guests: "sometimes",
        pets: "open_to_pets",
      },
    });
  });

  it("fails closed when a required range cannot be mapped", () => {
    expect(
      matchingProfileFromDatabase({ ...preferences, borrowing_range: "unknown" }),
    ).toBeNull();
  });

  it("requires all four hard compatibility gates", () => {
    const requester = matchingProfileFromDatabase(preferences)!;
    const compatible = matchingProfileFromDatabase({
      ...preferences,
      target_locations: ["South Dublin"],
      property_types: ["Townhouse"],
    })!;
    expect(passesDeterministicMatchingGates(requester, compatible)).toBe(true);
    expect(
      passesDeterministicMatchingGates(requester, {
        ...compatible,
        ownershipHorizon: "7–10 years",
      }),
    ).toBe(false);
  });
});
