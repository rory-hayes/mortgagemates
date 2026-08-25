import { BrandMark } from "@/components/brand/brand-mark";
import { EligibilityCheck } from "@/components/eligibility/eligibility-check";

export const metadata = { title: "Eligibility" };

export default function EligibilityPage() {
  return <main className="content-grid min-h-screen py-8"><BrandMark /><div className="py-12"><EligibilityCheck /></div></main>;
}
