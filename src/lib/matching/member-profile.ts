import {
  moneyRangeFromLabel,
  trialHorizons,
  trialTimelines,
  type MatchingProfile,
} from "@/lib/matching/trial-data";

export type DatabaseBuyerPreferences = {
  deposit_range: string | null;
  borrowing_range: string | null;
  monthly_housing_budget_range: string | null;
  target_locations: string[];
  property_types: string[];
  must_haves: string[];
  purchase_timeline: string | null;
  household_preferences: Record<string, unknown>;
  ownership_expectations: Record<string, unknown>;
};

export function matchingProfileFromDatabase(
  preferences: DatabaseBuyerPreferences | null,
): MatchingProfile | null {
  if (!preferences) return null;
  const deposit = moneyRangeFromLabel("deposit", preferences.deposit_range ?? "");
  const borrowing = moneyRangeFromLabel("borrowing", preferences.borrowing_range ?? "");
  const monthlyHousingBudget = moneyRangeFromLabel(
    "monthly",
    preferences.monthly_housing_budget_range ?? "",
  );
  const purchaseTimeline = preferences.purchase_timeline;
  const ownershipHorizon = String(
    preferences.ownership_expectations?.horizon ?? "",
  );
  if (
    !deposit ||
    !borrowing ||
    !monthlyHousingBudget ||
    !trialTimelines.includes(purchaseTimeline as (typeof trialTimelines)[number]) ||
    !trialHorizons.includes(ownershipHorizon as (typeof trialHorizons)[number]) ||
    !Array.isArray(preferences.target_locations) ||
    preferences.target_locations.length === 0 ||
    !Array.isArray(preferences.property_types) ||
    preferences.property_types.length === 0
  ) {
    return null;
  }

  const household = preferences.household_preferences ?? {};
  return {
    targetLocations: preferences.target_locations.slice(0, 8),
    propertyTypes: preferences.property_types.slice(0, 5),
    deposit,
    borrowing,
    monthlyHousingBudget,
    purchaseTimeline: purchaseTimeline as (typeof trialTimelines)[number],
    ownershipHorizon: ownershipHorizon as (typeof trialHorizons)[number],
    household: {
      noise: householdNoise(household.noise),
      workFromHome: workFromHome(household.workFromHome),
      guests: guestFrequency(household.guests),
      pets: petPreference(household.pets),
    },
    priorities: Array.isArray(preferences.must_haves) && preferences.must_haves.length
      ? preferences.must_haves.map(String).slice(0, 5)
      : ["Sustainable monthly costs", "Reliable transport"],
  };
}

export function passesDeterministicMatchingGates(
  requester: MatchingProfile,
  candidate: MatchingProfile,
) {
  return (
    requester.targetLocations.some((item) => candidate.targetLocations.includes(item)) &&
    requester.propertyTypes.some((item) => candidate.propertyTypes.includes(item)) &&
    requester.purchaseTimeline === candidate.purchaseTimeline &&
    requester.ownershipHorizon === candidate.ownershipHorizon
  );
}

function householdNoise(value: unknown): MatchingProfile["household"]["noise"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("quiet")) return "quiet";
  if (text.includes("lively")) return "lively";
  return "balanced";
}

function workFromHome(value: unknown): MatchingProfile["household"]["workFromHome"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("rare")) return "rarely";
  if (text.includes("4") || text.includes("5") || text.includes("most")) return "most_days";
  return "some_days";
}

function guestFrequency(value: unknown): MatchingProfile["household"]["guests"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("rare")) return "rarely";
  if (text.includes("frequent") || text.includes("often")) return "often";
  return "sometimes";
}

function petPreference(value: unknown): MatchingProfile["household"]["pets"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("existing") || text.includes("bring") || text.includes("has")) return "has_pets";
  if (text.includes("open")) return "open_to_pets";
  return "none";
}
