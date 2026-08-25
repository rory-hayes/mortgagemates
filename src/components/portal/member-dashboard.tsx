"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, CheckCircle2Icon, Clock3Icon, FileCheck2Icon, LockKeyholeIcon, MapPinIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { IntroductionGates } from "@/components/portal/introduction-gates";

type DashboardProps = {
  profile: { id: string; first_name: string | null; onboarding_status: string; onboarding_step: number; matching_status: string };
  documentStats: { accepted: number; uploaded: number; required: number };
  match: { id: string; status: string; compatibility: Record<string, unknown> } | null;
  decision: string | null;
};

export function MemberDashboard({ profile, documentStats, match, decision: initialDecision }: DashboardProps) {
  const [decision, setDecision] = useState(initialDecision);
  const [pending, setPending] = useState(false);
  const readiness = documentStats.required ? Math.round((documentStats.accepted / documentStats.required) * 100) : 0;

  async function decide(value: "interested" | "declined") {
    if (!match) return;
    setPending(true);
    const { error } = await createClient().from("match_decisions").insert({ match_id: match.id, user_id: profile.id, decision: value });
    setPending(false);
    if (!error) setDecision(value);
  }

  return <main className="content-grid flex flex-col gap-8 py-8"><div><p className="eyebrow">Member dashboard</p><h1 className="text-5xl font-medium text-primary">Good morning, {profile.first_name ?? "there"}.</h1><p className="mt-2 text-muted-foreground">Your preparation, matching, and next steps in one place.</p></div>{profile.onboarding_status === "draft" ? <Alert><Clock3Icon /><AlertTitle>Your profile is not ready for review</AlertTitle><AlertDescription>Complete all six profile sections before the team can consider an introduction.</AlertDescription></Alert> : <Alert><ShieldCheckIcon /><AlertTitle>Profile status: {profile.onboarding_status.replaceAll("_", " ")}</AlertTitle><AlertDescription>We use your ranges and preferences for matching. Documents remain private.</AlertDescription></Alert>}<div className="grid gap-5 lg:grid-cols-[1fr_320px]"><Card><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle className="text-3xl">{match ? "One person worth considering" : "No proposal yet"}</CardTitle><CardDescription>{match ? "A manually reviewed introduction based on the details that matter." : "Complete your profile and document checklist while the team reviews the pilot pool."}</CardDescription></div>{match ? <Badge variant="outline">{match.status.replaceAll("_", " ")}</Badge> : null}</div></CardHeader><CardContent className="flex flex-col gap-5">{match ? <><div className="grid gap-4 sm:grid-cols-2">{Object.entries(match.compatibility).slice(0, 8).map(([key, value]) => <div key={key} className="flex gap-3"><MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs font-semibold capitalize text-muted-foreground">{key.replaceAll("_", " ")}</p><p className="mt-1 text-sm">{Array.isArray(value) ? value.join(" · ") : String(value)}</p></div></div>)}</div><Alert><LockKeyholeIcon /><AlertTitle>Contact details stay locked</AlertTitle><AlertDescription>Both buyers must opt in, verify identity, and complete the €49 introduction payment.</AlertDescription></Alert></> : <div className="flex flex-col items-center gap-4 py-12 text-center"><span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary"><SparklesIcon className="size-6" /></span><div><p className="font-heading text-2xl">Preparation is progress.</p><p className="mt-2 max-w-md text-sm text-muted-foreground">There is no swipe feed. You will see one considered proposal only when the team finds a fit.</p></div></div>}</CardContent><CardFooter>{match && !decision ? <div className="flex w-full justify-between gap-3"><Button variant="outline" disabled={pending} onClick={() => decide("declined")}>Not for me</Button><Button disabled={pending} onClick={() => decide("interested")}>I’m interested <ArrowRightIcon data-icon="inline-end" /></Button></div> : match && decision ? <Alert className="w-full"><CheckCircle2Icon /><AlertTitle>{decision === "interested" ? "Interest recorded privately" : "Proposal declined"}</AlertTitle><AlertDescription>{decision === "interested" ? "You will only be connected if the other member opts in too." : "You will return to the review pool after the team closes this proposal."}</AlertDescription></Alert> : <Link href="/portal/onboarding" className={cn(buttonVariants())}>Complete my profile <ArrowRightIcon data-icon="inline-end" /></Link>}</CardFooter></Card><div className="flex flex-col gap-5"><Card><CardHeader><CardTitle>Document readiness</CardTitle><CardDescription>{documentStats.uploaded} uploaded · {documentStats.accepted} accepted</CardDescription></CardHeader><CardContent><div className="flex items-end justify-between"><p className="text-4xl font-semibold text-primary">{readiness}%</p><FileCheck2Icon className="size-6 text-primary" /></div><Progress className="mt-4" value={readiness} /></CardContent><CardFooter><Link href="/portal/documents" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Open private vault</Link></CardFooter></Card><Card><CardHeader><CardTitle>Profile progress</CardTitle><CardDescription>Step {profile.onboarding_step} of 6</CardDescription></CardHeader><CardContent><Progress value={(profile.onboarding_step / 6) * 100} /></CardContent><CardFooter><Link href="/portal/onboarding" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>Review profile</Link></CardFooter></Card></div></div>{match?.status === "mutual_interest" ? <IntroductionGates matchId={match.id} /> : null}</main>;
}
