import { z } from "zod";

export const trialLocations = [
  "Dún Laoghaire",
  "Blackrock",
  "Dundrum",
  "Bray",
  "Swords",
  "Maynooth",
] as const;

export const trialPropertyTypes = ["House", "Townhouse", "Apartment"] as const;
export const trialTimelines = ["3–6 months", "6–12 months", "12–18 months"] as const;
export const trialHorizons = ["3 years", "5–7 years", "7–10 years", "10+ years"] as const;

const depositRanges = {
  "Under €20,000": { min: 0, max: 19_999 },
  "€20,000–€34,999": { min: 20_000, max: 34_999 },
  "€35,000–€49,999": { min: 35_000, max: 49_999 },
  "€50,000–€74,999": { min: 50_000, max: 74_999 },
  "€75,000+": { min: 75_000, max: 110_000 },
} as const;

const borrowingRanges = {
  "Under €180,000": { min: 0, max: 179_999 },
  "€180,000–€219,999": { min: 180_000, max: 219_999 },
  "€220,000–€259,999": { min: 220_000, max: 259_999 },
  "€260,000–€319,999": { min: 260_000, max: 319_999 },
  "€320,000+": { min: 320_000, max: 400_000 },
} as const;

const monthlyRanges = {
  "Under €1,000": { min: 0, max: 999 },
  "€1,000–€1,199": { min: 1_000, max: 1_199 },
  "€1,200–€1,399": { min: 1_200, max: 1_399 },
  "€1,400–€1,699": { min: 1_400, max: 1_699 },
  "€1,700+": { min: 1_700, max: 2_100 },
} as const;

export const trialDepositLabels = Object.keys(depositRanges) as [keyof typeof depositRanges, ...(keyof typeof depositRanges)[]];
export const trialBorrowingLabels = Object.keys(borrowingRanges) as [keyof typeof borrowingRanges, ...(keyof typeof borrowingRanges)[]];
export const trialMonthlyLabels = Object.keys(monthlyRanges) as [keyof typeof monthlyRanges, ...(keyof typeof monthlyRanges)[]];

export const TrialProfileInputSchema = z.strictObject({
  targetLocation: z.enum(trialLocations),
  propertyType: z.enum(trialPropertyTypes),
  depositRange: z.enum(trialDepositLabels),
  borrowingRange: z.enum(trialBorrowingLabels),
  monthlyRange: z.enum(trialMonthlyLabels),
  purchaseTimeline: z.enum(trialTimelines),
  ownershipHorizon: z.enum(trialHorizons),
  householdRhythm: z.enum(["quiet", "balanced", "lively"]),
  workFromHome: z.enum(["rarely", "some_days", "most_days"]),
  pets: z.enum(["none", "open_to_pets", "has_pets"]),
});

export type TrialProfileInput = z.infer<typeof TrialProfileInputSchema>;

export type MatchingProfile = {
  targetLocations: string[];
  propertyTypes: string[];
  deposit: { label: string; min: number; max: number };
  borrowing: { label: string; min: number; max: number };
  monthlyHousingBudget: { label: string; min: number; max: number };
  purchaseTimeline: (typeof trialTimelines)[number];
  ownershipHorizon: (typeof trialHorizons)[number];
  household: {
    noise: "quiet" | "balanced" | "lively";
    workFromHome: "rarely" | "some_days" | "most_days";
    guests: "rarely" | "sometimes" | "often";
    pets: "none" | "open_to_pets" | "has_pets";
  };
  priorities: string[];
};

export type FictionalCandidate = {
  candidateId: string;
  firstName: string;
  ageBand: string;
  occupation: string;
  descriptor: string;
  profile: MatchingProfile;
};

function moneyRange<T extends Record<string, { min: number; max: number }>>(
  options: T,
  label: keyof T,
) {
  return { label: String(label), ...options[label] };
}

export function moneyRangeFromLabel(
  kind: "deposit" | "borrowing" | "monthly",
  label: string,
) {
  const options: Record<string, { min: number; max: number }> = kind === "deposit"
    ? depositRanges
    : kind === "borrowing"
      ? borrowingRanges
      : monthlyRanges;
  const value = options[label];
  return value ? { label, ...value } : null;
}

export function matchingProfileFromTrial(input: TrialProfileInput): MatchingProfile {
  return {
    targetLocations: [input.targetLocation],
    propertyTypes: [input.propertyType],
    deposit: moneyRange(depositRanges, input.depositRange),
    borrowing: moneyRange(borrowingRanges, input.borrowingRange),
    monthlyHousingBudget: moneyRange(monthlyRanges, input.monthlyRange),
    purchaseTimeline: input.purchaseTimeline,
    ownershipHorizon: input.ownershipHorizon,
    household: {
      noise: input.householdRhythm,
      workFromHome: input.workFromHome,
      guests: input.householdRhythm === "quiet" ? "rarely" : input.householdRhythm === "lively" ? "often" : "sometimes",
      pets: input.pets,
    },
    priorities: ["Transport links", "Sustainable monthly costs"],
  };
}

function candidate(
  candidateId: string,
  firstName: string,
  ageBand: string,
  occupation: string,
  descriptor: string,
  profile: MatchingProfile,
): FictionalCandidate {
  return { candidateId, firstName, ageBand, occupation, descriptor, profile };
}

export const fictionalCandidates: FictionalCandidate[] = [
  candidate("candidate_harbour", "Aisling", "32–37", "Public service", "Quiet weekdays, coastal walks, and a practical shared-home routine.", {
    targetLocations: ["Dún Laoghaire", "Blackrock"], propertyTypes: ["House", "Townhouse"],
    deposit: moneyRange(depositRanges, "€50,000–€74,999"), borrowing: moneyRange(borrowingRanges, "€260,000–€319,999"), monthlyHousingBudget: moneyRange(monthlyRanges, "€1,400–€1,699"),
    purchaseTimeline: "6–12 months", ownershipHorizon: "5–7 years", household: { noise: "balanced", workFromHome: "some_days", guests: "sometimes", pets: "open_to_pets" }, priorities: ["DART access", "Outdoor space", "Separate work area"],
  }),
  candidate("candidate_village", "Conor", "35–40", "Technology", "A tidy, low-key home base with good transport and room to work.", {
    targetLocations: ["Dundrum", "Blackrock"], propertyTypes: ["Apartment", "Townhouse"],
    deposit: moneyRange(depositRanges, "€35,000–€49,999"), borrowing: moneyRange(borrowingRanges, "€320,000+"), monthlyHousingBudget: moneyRange(monthlyRanges, "€1,700+"),
    purchaseTimeline: "3–6 months", ownershipHorizon: "3 years", household: { noise: "quiet", workFromHome: "most_days", guests: "rarely", pets: "none" }, priorities: ["Luas access", "Energy efficiency", "Home office"],
  }),
  candidate("candidate_coast", "Maeve", "29–34", "Healthcare", "Social at weekends, calm during the week, and open to a pet-friendly home.", {
    targetLocations: ["Bray", "Dún Laoghaire"], propertyTypes: ["House", "Apartment"],
    deposit: moneyRange(depositRanges, "€20,000–€34,999"), borrowing: moneyRange(borrowingRanges, "€220,000–€259,999"), monthlyHousingBudget: moneyRange(monthlyRanges, "€1,200–€1,399"),
    purchaseTimeline: "12–18 months", ownershipHorizon: "7–10 years", household: { noise: "balanced", workFromHome: "rarely", guests: "sometimes", pets: "has_pets" }, priorities: ["Commuter rail", "Green space", "Storage"],
  }),
  candidate("candidate_north", "Darragh", "33–38", "Engineering", "A lively but organised household near reliable commuter links.", {
    targetLocations: ["Swords", "Maynooth"], propertyTypes: ["House", "Townhouse"],
    deposit: moneyRange(depositRanges, "€50,000–€74,999"), borrowing: moneyRange(borrowingRanges, "€260,000–€319,999"), monthlyHousingBudget: moneyRange(monthlyRanges, "€1,400–€1,699"),
    purchaseTimeline: "6–12 months", ownershipHorizon: "5–7 years", household: { noise: "lively", workFromHome: "some_days", guests: "often", pets: "open_to_pets" }, priorities: ["Bus links", "Garden", "Parking"],
  }),
  candidate("candidate_campus", "Niamh", "30–35", "Education", "A calm long-term home with straightforward costs and shared expectations.", {
    targetLocations: ["Maynooth", "Dundrum"], propertyTypes: ["Apartment", "Townhouse"],
    deposit: moneyRange(depositRanges, "€35,000–€49,999"), borrowing: moneyRange(borrowingRanges, "€180,000–€219,999"), monthlyHousingBudget: moneyRange(monthlyRanges, "€1,000–€1,199"),
    purchaseTimeline: "12–18 months", ownershipHorizon: "10+ years", household: { noise: "quiet", workFromHome: "some_days", guests: "rarely", pets: "none" }, priorities: ["Rail access", "Low running costs", "Storage"],
  }),
  candidate("candidate_gardens", "Eoin", "36–41", "Financial services", "A balanced routine and a clear preference for a medium-term house purchase.", {
    targetLocations: ["Swords", "Bray"], propertyTypes: ["House", "Apartment"],
    deposit: moneyRange(depositRanges, "€75,000+"), borrowing: moneyRange(borrowingRanges, "€320,000+"), monthlyHousingBudget: moneyRange(monthlyRanges, "€1,700+"),
    purchaseTimeline: "3–6 months", ownershipHorizon: "7–10 years", household: { noise: "balanced", workFromHome: "rarely", guests: "sometimes", pets: "open_to_pets" }, priorities: ["Fast commute", "Outdoor space", "Two bathrooms"],
  }),
];
