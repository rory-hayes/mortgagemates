import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Accessibility" };
export default function AccessibilityPage() {
  return <LegalPage eyebrow="Accessibility" title="A portal everyone can prepare with." summary="MortgageMates aims to meet WCAG 2.2 AA across the public and member experience." sections={[
    { title: "What is included", body: <p>Keyboard-operable navigation and dialogs, visible focus styles, semantic headings and form labels, descriptive error messages, reduced dependence on colour, responsive layouts, and alternative text for meaningful imagery.</p> },
    { title: "Known pilot limits", body: <p>Third-party identity, payment, and document-viewing surfaces may have their own accessibility characteristics. The product still requires assistive-technology testing and an independent audit before broad launch.</p> },
    { title: "Tell us what is not working", body: <p>Email hello@mortgagemates.ie with the page, browser or assistive technology used, and the problem encountered. Do not include sensitive documents in the message.</p> },
  ]} />;
}
