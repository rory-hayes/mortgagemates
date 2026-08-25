import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { Separator } from "@/components/ui/separator";

const groups = [
  { title: "Company", links: [["How it works", "/#how-it-works"], ["Document ready", "/#documents"], ["Pricing", "/#pricing"]] },
  { title: "Support", links: [["Safety", "/#safety"], ["Contact", "mailto:hello@mortgagemates.ie"], ["Accessibility", "/accessibility"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Complaints", "/complaints"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="content-grid grid gap-10 py-12 md:grid-cols-[1.5fr_2fr]">
        <div className="flex max-w-sm flex-col gap-4"><BrandMark /><p className="text-sm leading-6 text-muted-foreground">A matching and preparation service for two owner-occupier buyers. We are not a lender, broker, solicitor, or financial adviser.</p></div>
        <div className="grid grid-cols-3 gap-6">
          {groups.map((group) => <div key={group.title} className="flex flex-col gap-3"><p className="text-sm font-semibold">{group.title}</p>{group.links.map(([label, href]) => <Link key={href} href={href} className="text-sm text-muted-foreground hover:text-primary">{label}</Link>)}</div>)}
        </div>
      </div>
      <Separator />
      <div className="content-grid flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>© 2026 MortgageMates. Pilot service.</p><p>Independent legal and mortgage advice is essential before buying together.</p></div>
    </footer>
  );
}
