import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Complaints" };
export default function ComplaintsPage() {
  return <LegalPage eyebrow="Complaints and safety" title="Raise a concern early." summary="For the pilot, contact hello@mortgagemates.ie. Do not use the service for an emergency." sections={[
    { title: "What to include", body: <p>Your account email, the date, what happened, the outcome you want, and any relevant match or introduction reference. Do not email identity or financial documents unless the support team provides a secure method.</p> },
    { title: "Safety reports", body: <p>Reports involving pressure, discrimination, harassment, suspected fraud, or misuse of personal information pause relevant matching activity while reviewed. If there is an immediate risk, contact emergency services or An Garda Síochána.</p> },
    { title: "Response process", body: <p>The pilot team acknowledges, reviews, records, and responds to complaints. Formal response targets, escalation routes, regulated-service boundaries, and external redress wording must be approved before commercial launch.</p> },
  ]} />;
}
