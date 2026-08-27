export type BuyerProfileDraft = {
  firstName: string;
  ageBand: string;
  firstTimeBuyer: boolean;
  irishResident: boolean;
  ownerOccupier: boolean;
  unrelated: boolean;
  pairOnly: boolean;
  timeline: string;
  income: string;
  deposit: string;
  borrowing: string;
  monthly: string;
  locations: string[];
  propertyTypes: string[];
  household: { noise: string; workFromHome: string; guests: string; pets: string };
  ownership: { horizon: string; shares: string; earlyExit: string; missedPayments: string };
};

export function profileIssuesForStep(draft: BuyerProfileDraft, step: number) {
  const issues: string[] = [];

  if (step === 1) {
    if (!draft.firstName.trim()) issues.push("Add your first name.");
    if (!draft.ageBand) issues.push("Choose your age band.");
    if (!draft.firstTimeBuyer) issues.push("Confirm that you are a first-time buyer.");
    if (!draft.irishResident) issues.push("Confirm that you are resident in Ireland.");
    if (!draft.ownerOccupier) issues.push("Confirm that you will live in the property.");
    if (!draft.unrelated) issues.push("Confirm that you are open to one unrelated co-buyer.");
    if (!draft.pairOnly) issues.push("Confirm that you want to buy as a pair.");
  }
  if (step === 2 && !draft.timeline) issues.push("Choose when you want to buy.");
  if (step === 3) {
    if (!draft.income) issues.push("Choose your income range.");
    if (!draft.deposit) issues.push("Choose your deposit range.");
    if (!draft.borrowing) issues.push("Choose your estimated borrowing range.");
    if (!draft.monthly) issues.push("Choose your monthly housing budget range.");
  }
  if (step === 4) {
    if (draft.locations.length === 0) issues.push("Choose at least one target location.");
    if (draft.propertyTypes.length === 0) issues.push("Choose at least one property type.");
  }
  if (step === 5 && Object.values(draft.household).some((value) => !value)) {
    issues.push("Answer every living-together question.");
  }
  if (step === 6 && Object.values(draft.ownership).some((value) => !value)) {
    issues.push("Answer every ownership-expectations question.");
  }
  return issues;
}

export function profileSubmissionIssues(
  draft: BuyerProfileDraft,
  consent: { terms: boolean; privacy: boolean; risk: boolean },
) {
  const issues = Array.from(
    new Set(Array.from({ length: 6 }, (_, index) => profileIssuesForStep(draft, index + 1)).flat()),
  );
  if (!consent.terms) issues.push("Accept the pilot terms.");
  if (!consent.privacy) issues.push("Accept the privacy notice.");
  if (!consent.risk) issues.push("Acknowledge the financial and legal risks.");
  return issues;
}
