import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, LockKeyholeIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";

import { InvestorTrialMatcher } from "@/components/trial/investor-trial-matcher";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Investor AI matching trial",
  description: "Try MortgageMates' live, bounded AI co-buyer matching flow with fictional profiles.",
};

export default function InvestorTrialPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b bg-card">
          <div className="content-grid flex flex-col gap-7 py-14 lg:py-20">
            <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "w-fit px-0 hover:bg-transparent")}><ArrowLeftIcon data-icon="inline-start" />Back to MortgageMates</Link>
            <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
              <div className="flex max-w-3xl flex-col items-start gap-5">
                <div className="flex flex-wrap gap-2"><Badge variant="secondary"><SparklesIcon /> Live AI</Badge><Badge variant="outline">Investor trial</Badge><Badge variant="outline">Six fictional profiles</Badge></div>
                <h1 className="text-6xl leading-[0.98] font-medium text-primary sm:text-7xl">See how one considered match is made.</h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">Set a hypothetical home-buying brief. MortgageMates filters non-negotiable rules, asks AI to rank only eligible profiles, and returns no more than one proposal.</p>
              </div>
              <Alert><LockKeyholeIcon /><AlertTitle>A safe product trial</AlertTitle><AlertDescription>No sign-up, real buyer data, documents, mortgage decision, payment, or human review is involved.</AlertDescription></Alert>
            </div>
          </div>
        </section>
        <section className="paper-grid py-10 lg:py-14">
          <div className="content-grid"><InvestorTrialMatcher /></div>
        </section>
        <section className="border-t bg-secondary/55 py-12">
          <div className="content-grid"><Alert className="mx-auto max-w-4xl bg-card"><ShieldCheckIcon /><AlertTitle>What this proves—and what it does not</AlertTitle><AlertDescription>This trial proves the live model-ranking flow, hard eligibility gates, one-proposal rule, and explainable result shape. It does not prove real member supply, mortgage eligibility, identity, document approval, willingness to co-buy, or completed introductions.</AlertDescription></Alert></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
