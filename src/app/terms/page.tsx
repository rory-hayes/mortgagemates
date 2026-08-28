import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Terms" };
export default function TermsPage() {
  return <LegalPage eyebrow="Pilot terms" title="Matching is not advice." summary="These plain-language pilot boundaries are not a substitute for solicitor-approved terms before taking payment from the public." sections={[
    { title: "The service", body: <p>MortgageMates helps eligible members prepare a profile, organise documents, consider one proposed co-buyer, and work through alignment questions. It does not list property, approve mortgages, recommend a legal structure, guarantee a match, or guarantee a successful purchase.</p> },
    { title: "How proposals are made", body: <p>MortgageMates applies non-negotiable eligibility rules, then uses an automated AI ranking to make no more than one considered proposal. A score is an explainable compatibility signal based on the ranges and preferences supplied; it is not proof of identity, affordability, creditworthiness, personal safety, legal suitability, future property performance, or a recommendation to buy.</p> },
    { title: "Your responsibilities", body: <p>You must provide accurate information, protect your account, avoid uploading unlawful or malicious material, treat other members respectfully, and obtain independent mortgage and legal advice. Do not rely on a compatibility summary or document status as proof of affordability, creditworthiness, or suitability.</p> },
    { title: "Introductions and €49 fee", body: <p>The pilot intends to charge each member only after mutual interest. Contact unlock also requires individual identity verification. Refund, cancellation, payment-provider, and consumer-rights terms require final legal approval before paid public use.</p> },
    { title: "Co-ownership risk", body: <p>Joint ownership can expose each buyer to payment default, disputes, changed circumstances, loss, tax consequences, and difficulty selling. Exit periods in the app are discussion preferences, not enforceable break clauses. Only appropriately instructed professionals can advise and document the arrangement.</p> },
  ]} />;
}
