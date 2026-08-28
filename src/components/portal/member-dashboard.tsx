"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckCircle2Icon, Clock3Icon, FileCheck2Icon, LockKeyholeIcon, MailIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { IntroductionGates } from "@/components/portal/introduction-gates";
import { SafetyReportDialog } from "@/components/portal/safety-report-dialog";
import { AiMatchLauncher } from "@/components/portal/ai-match-launcher";
import type { IntroductionGateMode } from "@/lib/introduction-gate-mode";

type DashboardProps = {
  profile: { id: string; first_name: string | null; onboarding_status: string; onboarding_review_note: string | null; onboarding_step: number; matching_status: string };
  documentStats: { accepted: number; uploaded: number; required: number };
  match: { id: string; status: string; compatibility: Record<string, unknown>; user_a: string; user_b: string; expires_at: string; source: string; overall_score: number | null } | null;
  decision: string | null;
  gates: { identity: string; payment: string } | null;
  gateMode: IntroductionGateMode;
  contact: { first_name: string; email: string | null; phone: string | null; preferred_channel: string } | null;
};

export function MemberDashboard({ profile, documentStats, match, decision: initialDecision, gates, gateMode, contact }: DashboardProps) {
  const [decision, setDecision] = useState(initialDecision);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const readiness = documentStats.required ? Math.round((documentStats.accepted / documentStats.required) * 100) : 0;

  async function decide(value: "interested" | "declined") {
    if (!match) return;
    setPending(true);
    const { error } = await createClient().from("match_decisions").insert({ match_id: match.id, user_id: profile.id, decision: value });
    setPending(false);
    if (error) toast.error(error.message);
    else { setDecision(value); router.refresh(); }
  }

  const otherUserId = match ? (match.user_a === profile.id ? match.user_b : match.user_a) : null;
  const profileNeedsWork = ["draft", "changes_requested"].includes(profile.onboarding_status);

  const matchingReady = profile.matching_status === "ready";
  return <main className="content-grid flex flex-col gap-8 py-8"><div><p className="eyebrow">Member dashboard</p><h1 className="text-5xl font-medium text-primary">Good morning, {profile.first_name ?? "there"}.</h1><p className="mt-2 text-muted-foreground">Your preparation, matching, and next steps in one place.</p></div>{profileNeedsWork ? <Alert><Clock3Icon /><AlertTitle>{profile.onboarding_status === "changes_requested" ? "The reviewer needs a few changes" : "Your profile is not ready for review"}</AlertTitle><AlertDescription>{profile.onboarding_review_note ?? "Complete all six profile sections before entering the eligible matching pool."}</AlertDescription></Alert> : <Alert><ShieldCheckIcon /><AlertTitle>Profile status: {profile.onboarding_status.replaceAll("_", " ")}</AlertTitle><AlertDescription>We use sanitised ranges and preferences for matching. Names, contact details, and documents are never sent to the AI model.</AlertDescription></Alert>}<div className="grid gap-5 lg:grid-cols-[1fr_320px]"><Card><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle className="text-3xl">{match ? "One person worth considering" : "No proposal yet"}</CardTitle><CardDescription>{match ? `${match.source === "ai" ? "AI-ranked" : "Legacy"} proposal after the required eligibility gates passed.` : matchingReady ? "Your profile is ready. The engine can rank the currently eligible pool." : "Complete approval and document readiness to enter automated matching."}</CardDescription></div>{match ? <div className="flex flex-wrap justify-end gap-2">{match.overall_score ? <Badge variant="secondary"><SparklesIcon />{match.overall_score}% fit</Badge> : null}<Badge variant="outline">{match.status.replaceAll("_", " ")}</Badge></div> : null}</div></CardHeader><CardContent className="flex flex-col gap-5">{match ? <><div className="grid gap-4 sm:grid-cols-2">{Object.entries(match.compatibility).slice(0, 10).map(([key, value]) => <div key={key} className="flex gap-3"><MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs font-semibold capitalize text-muted-foreground">{key.replaceAll("_", " ")}</p><p className="mt-1 text-sm">{Array.isArray(value) ? value.join(" · ") : String(value)}</p></div></div>)}</div>{contact ? <Alert><CheckCircle2Icon /><AlertTitle>Contact details are unlocked</AlertTitle><AlertDescription><span className="mt-2 flex flex-col gap-2"><strong>{contact.first_name}</strong>{contact.email ? <a className="inline-flex items-center gap-2 underline" href={`mailto:${contact.email}`}><MailIcon className="size-4" />{contact.email}</a> : null}{contact.phone ? <a className="inline-flex items-center gap-2 underline" href={`tel:${contact.phone}`}><PhoneIcon className="size-4" />{contact.phone}</a> : null}<span>Preferred contact: {contact.preferred_channel}</span></span></AlertDescription></Alert> : <Alert><LockKeyholeIcon /><AlertTitle>Contact details stay locked</AlertTitle><AlertDescription>{gateMode === "mock" ? "Both buyers must complete the two clearly labelled pilot simulations. No identity is checked and no money is charged." : "Both buyers must opt in, verify identity, and complete the €49 introduction payment."}</AlertDescription></Alert>}</> : <div className="flex flex-col items-center gap-4 py-12 text-center"><span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary"><SparklesIcon className="size-6" /></span><div><p className="font-heading text-2xl">Preparation is progress.</p><p className="mt-2 max-w-md text-sm text-muted-foreground">There is no swipe feed. You will see one considered proposal only when MortgageMates’ AI finds a strong fit.</p></div></div>}</CardContent><CardFooter>{match?.status === "proposed" && !decision ? <div className="flex w-full justify-between gap-3"><Button variant="outline" disabled={pending} onClick={() => decide("declined")}>Not for me</Button><Button disabled={pending} onClick={() => decide("interested")}>I’m interested <ArrowRightIcon data-icon="inline-end" /></Button></div> : match && decision ? <Alert className="w-full"><CheckCircle2Icon /><AlertTitle>{decision === "interested" ? "Interest recorded privately" : "Proposal declined"}</AlertTitle><AlertDescription>{decision === "interested" ? "You will only be connected if the other member opts in too." : "You will return to the eligible pool after this proposal closes."}</AlertDescription></Alert> : !match && matchingReady ? <AiMatchLauncher /> : !match ? <Link href="/portal/onboarding" className={cn(buttonVariants())}>Complete my profile <ArrowRightIcon data-icon="inline-end" /></Link> : null}</CardFooter></Card><div className="flex flex-col gap-5"><Card><CardHeader><CardTitle>Document readiness</CardTitle><CardDescription>{documentStats.uploaded} uploaded · {documentStats.accepted} accepted</CardDescription></CardHeader><CardContent><div className="flex items-end justify-between"><p className="text-4xl font-semibold text-primary">{readiness}%</p><FileCheck2Icon className="size-6 text-primary" /></div><Progress className="mt-4" value={readiness} /></CardContent><CardFooter><Link href="/portal/documents" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Open private vault</Link></CardFooter></Card><Card><CardHeader><CardTitle>Profile progress</CardTitle><CardDescription>Step {profile.onboarding_step} of 6</CardDescription></CardHeader><CardContent><Progress value={(profile.onboarding_step / 6) * 100} /></CardContent><CardFooter><Link href="/portal/onboarding" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>Review profile</Link></CardFooter></Card></div></div>{match?.status === "mutual_interest" && gates ? <IntroductionGates matchId={match.id} identityStatus={gates.identity} paymentStatus={gates.payment} gateMode={gateMode} /> : null}{match && otherUserId ? <div className="flex justify-end"><SafetyReportDialog matchId={match.id} reportedUserId={otherUserId} /></div> : null}</main>;
}
