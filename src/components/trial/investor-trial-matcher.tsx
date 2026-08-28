"use client";

import { useState } from "react";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CheckIcon,
  CircleGaugeIcon,
  Clock3Icon,
  HomeIcon,
  MapPinIcon,
  MessageCircleQuestionIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { MortgageMatesGatewayResponse } from "@/lib/matching/gateway-contract";
import {
  trialBorrowingLabels,
  trialDepositLabels,
  trialHorizons,
  trialLocations,
  trialMonthlyLabels,
  trialPropertyTypes,
  trialTimelines,
  type MatchingProfile,
  type TrialProfileInput,
} from "@/lib/matching/trial-data";

type TrialCandidate = {
  firstName: string;
  ageBand: string;
  occupation: string;
  descriptor: string;
  profile: MatchingProfile;
};

type TrialResponse = {
  result: MortgageMatesGatewayResponse;
  candidate: TrialCandidate | null;
};

const defaultProfile: TrialProfileInput = {
  targetLocation: "Dún Laoghaire",
  propertyType: "House",
  depositRange: "€50,000–€74,999",
  borrowingRange: "€260,000–€319,999",
  monthlyRange: "€1,400–€1,699",
  purchaseTimeline: "6–12 months",
  ownershipHorizon: "5–7 years",
  householdRhythm: "balanced",
  workFromHome: "some_days",
  pets: "open_to_pets",
};

const householdOptions = [
  { value: "quiet", label: "Mostly quiet" },
  { value: "balanced", label: "A balanced rhythm" },
  { value: "lively", label: "Lively and social" },
] as const;

const workOptions = [
  { value: "rarely", label: "Rarely at home" },
  { value: "some_days", label: "Some days at home" },
  { value: "most_days", label: "Most days at home" },
] as const;

const petOptions = [
  { value: "none", label: "No pets" },
  { value: "open_to_pets", label: "Open to pets" },
  { value: "has_pets", label: "Would bring a pet" },
] as const;

export function InvestorTrialMatcher() {
  const [profile, setProfile] = useState<TrialProfileInput>(defaultProfile);
  const [response, setResponse] = useState<TrialResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runMatch() {
    setPending(true);
    setError(null);
    setResponse(null);
    try {
      const result = await fetch("/api/investor-trial/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = (await result.json().catch(() => null)) as
        | TrialResponse
        | { error?: string }
        | null;
      if (!result.ok || !payload || !("result" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "The matching trial could not be completed.",
        );
      }
      setResponse(payload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The matching trial could not be completed.",
      );
    } finally {
      setPending(false);
    }
  }

  function update<K extends keyof TrialProfileInput>(
    key: K,
    value: TrialProfileInput[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
      <Card className="h-fit">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="secondary">Fictional buyer brief</Badge>
            <span className="text-xs text-muted-foreground">No account or documents needed</span>
          </div>
          <CardTitle className="mt-3 text-3xl">Set the home-buying brief</CardTitle>
          <CardDescription>
            Change the sample preferences to see whether the engine makes one considered proposal or holds.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FieldGroup>
            <FieldSet>
              <FieldTitle>Home search</FieldTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <TrialSelect label="Preferred area" value={profile.targetLocation} options={trialLocations} onChange={(value) => update("targetLocation", value as TrialProfileInput["targetLocation"])} />
                <TrialSelect label="Property type" value={profile.propertyType} options={trialPropertyTypes} onChange={(value) => update("propertyType", value as TrialProfileInput["propertyType"])} />
              </div>
            </FieldSet>

            <FieldSet>
              <FieldTitle>Buying ranges</FieldTitle>
              <FieldDescription>Ranges only. This is not a mortgage or affordability assessment.</FieldDescription>
              <div className="grid gap-4 sm:grid-cols-2">
                <TrialSelect label="Deposit available" value={profile.depositRange} options={trialDepositLabels} onChange={(value) => update("depositRange", value as TrialProfileInput["depositRange"])} />
                <TrialSelect label="Personal borrowing estimate" value={profile.borrowingRange} options={trialBorrowingLabels} onChange={(value) => update("borrowingRange", value as TrialProfileInput["borrowingRange"])} />
                <TrialSelect label="Monthly housing budget" value={profile.monthlyRange} options={trialMonthlyLabels} onChange={(value) => update("monthlyRange", value as TrialProfileInput["monthlyRange"])} />
                <TrialSelect label="Purchase window" value={profile.purchaseTimeline} options={trialTimelines} onChange={(value) => update("purchaseTimeline", value as TrialProfileInput["purchaseTimeline"])} />
                <TrialSelect label="Minimum ownership horizon" value={profile.ownershipHorizon} options={trialHorizons} onChange={(value) => update("ownershipHorizon", value as TrialProfileInput["ownershipHorizon"])} className="sm:col-span-2" />
              </div>
            </FieldSet>

            <FieldSet>
              <FieldTitle>Household fit</FieldTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <TrialSelect label="Household rhythm" value={profile.householdRhythm} options={householdOptions} onChange={(value) => update("householdRhythm", value as TrialProfileInput["householdRhythm"])} />
                <TrialSelect label="Working from home" value={profile.workFromHome} options={workOptions} onChange={(value) => update("workFromHome", value as TrialProfileInput["workFromHome"])} />
                <TrialSelect label="Pets" value={profile.pets} options={petOptions} onChange={(value) => update("pets", value as TrialProfileInput["pets"])} className="sm:col-span-2" />
              </div>
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t bg-muted/25">
          <Button className="w-full" size="lg" disabled={pending} onClick={runMatch}>
            {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
            {pending ? "Ranking eligible profiles…" : "Run live AI match"}
            {!pending ? <ArrowRightIcon data-icon="inline-end" /> : null}
          </Button>
        </CardFooter>
      </Card>

      <div className="flex min-w-0 flex-col gap-5" aria-live="polite">
        <MatchingLogic />
        {error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>The trial could not run</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {pending ? <PendingResult /> : null}
        {!pending && response ? <MatchResult response={response} onReset={() => setResponse(null)} /> : null}
        {!pending && !response && !error ? <EmptyResult /> : null}
      </div>
    </div>
  );
}

function TrialSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly T[] | readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const items = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <Field className={className}>
      <FieldLabel>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(String(next) as T)}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue>{items.find((item) => item.value === value)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function MatchingLogic() {
  const stages = [
    { icon: ShieldCheckIcon, title: "Hard gates first", copy: "Shared area, property type, purchase window, and ownership horizon." },
    { icon: CircleGaugeIcon, title: "AI ranks eligible people", copy: "Financial, home-search, timing, and household fit—without names or documents." },
    { icon: BadgeCheckIcon, title: "Zero or one proposal", copy: "A score below 70 is held back. There is no swipe feed." },
  ];
  return (
    <Card className="bg-primary text-primary-foreground">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-primary-foreground/60 uppercase">Matching logic</p>
            <CardTitle className="mt-2 text-3xl">Rules decide who is eligible. AI decides who fits best.</CardTitle>
          </div>
          <SparklesIcon className="hidden size-7 shrink-0 text-secondary sm:block" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {stages.map((stage, index) => (
          <div key={stage.title} className="rounded-xl border border-primary-foreground/16 bg-primary-foreground/6 p-4">
            <div className="mb-4 flex items-center justify-between">
              <stage.icon className="size-5 text-secondary" />
              <span className="font-heading text-2xl text-primary-foreground/35">0{index + 1}</span>
            </div>
            <p className="text-sm font-semibold">{stage.title}</p>
            <p className="mt-2 text-xs leading-5 text-primary-foreground/68">{stage.copy}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyResult() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary"><SparklesIcon className="size-6" /></span>
        <div>
          <h2 className="font-heading text-3xl text-primary">Ready when you are.</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">The live model will see a sanitised brief and six fictional candidate profiles. It will never receive their names, ages, occupations, or documents.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingResult() {
  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-5 p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary"><Spinner className="size-6" /></span>
        <div>
          <h2 className="font-heading text-3xl text-primary">Considering the eligible pool</h2>
          <p className="mt-2 text-sm text-muted-foreground">Filtering hard gates, then ranking the remaining fictional profiles.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MatchResult({ response, onReset }: { response: TrialResponse; onReset: () => void }) {
  const { result, candidate } = response;
  if (result.decision === "hold" || !candidate) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="outline" className="w-fit">No proposal made</Badge>
          <CardTitle className="mt-3 text-4xl">The engine held this brief.</CardTitle>
          <CardDescription>{result.summary}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Alert><ShieldCheckIcon /><AlertTitle>Holding is a valid result</AlertTitle><AlertDescription>{result.eligibleCandidateCount === 0 ? "Nobody in the fictional pool passed every hard gate." : "Eligible people existed, but the AI score did not reach the proposal threshold."}</AlertDescription></Alert>
          <ResultList title="What would need discussion" items={result.tradeoffs} icon={MessageCircleQuestionIcon} />
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <GatewayProof result={result} />
          <Button variant="outline" onClick={onReset}><RefreshCwIcon data-icon="inline-start" />Change the brief</Button>
        </CardFooter>
      </Card>
    );
  }

  const scoreRows = [
    ["Financial fit", result.dimensionScores.financialFit],
    ["Home-search fit", result.dimensionScores.homeSearchFit],
    ["Timing & exit fit", result.dimensionScores.timingAndExitFit],
    ["Household fit", result.dimensionScores.householdFit],
  ] as const;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-card">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary"><SparklesIcon /> AI proposal</Badge>
              <Badge variant="outline">Fictional profile</Badge>
            </div>
            <CardTitle className="mt-4 text-4xl">{candidate.firstName}, {candidate.ageBand}</CardTitle>
            <CardDescription>{candidate.occupation} · {candidate.descriptor}</CardDescription>
          </div>
          <div className="rounded-xl bg-primary px-5 py-4 text-center text-primary-foreground">
            <p className="text-4xl font-semibold">{result.overallScore}</p>
            <p className="text-[11px] tracking-wide text-primary-foreground/65 uppercase">match score</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-7 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileFact icon={MapPinIcon} label="Search areas" value={candidate.profile.targetLocations.join(" · ")} />
          <ProfileFact icon={HomeIcon} label="Property types" value={candidate.profile.propertyTypes.join(" · ")} />
          <ProfileFact icon={BanknoteIcon} label="Personal borrowing range" value={candidate.profile.borrowing.label} />
          <ProfileFact icon={Clock3Icon} label="Purchase & ownership" value={`${candidate.profile.purchaseTimeline} · ${candidate.profile.ownershipHorizon}`} />
          <ProfileFact icon={UsersIcon} label="Household rhythm" value={`${sentence(candidate.profile.household.noise)} · ${sentence(candidate.profile.household.workFromHome.replaceAll("_", " "))} working from home`} />
        </div>

        <div className="grid gap-x-6 gap-y-4 border-y py-6 sm:grid-cols-2">
          {scoreRows.map(([label, value]) => (
            <div key={label}>
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold">{label}</span><span className="text-muted-foreground">{value}/100</span></div>
              <Progress value={value} />
            </div>
          ))}
        </div>

        <Alert><BadgeCheckIcon /><AlertTitle>Why this person was selected</AlertTitle><AlertDescription>{result.summary}</AlertDescription></Alert>
        <div className="grid gap-6 lg:grid-cols-2">
          <ResultList title="Strong alignment" items={result.reasons} icon={CheckIcon} />
          <ResultList title="Worth discussing" items={result.tradeoffs} icon={MessageCircleQuestionIcon} />
        </div>
        <ResultList title="Opening questions for both buyers" items={result.openingQuestions} icon={MessageCircleQuestionIcon} />
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-4 border-t sm:flex-row sm:items-center sm:justify-between">
        <GatewayProof result={result} />
        <Button variant="outline" onClick={onReset}><RefreshCwIcon data-icon="inline-start" />Change the brief</Button>
      </CardFooter>
    </Card>
  );
}

function ProfileFact({ icon: Icon, label, value }: { icon: typeof HomeIcon; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value}</p></div></div>;
}

function ResultList({ title, items, icon: Icon }: { title: string; items: string[]; icon: typeof CheckIcon }) {
  return <div><h3 className="font-sans text-sm font-semibold tracking-normal">{title}</h3><ul className="mt-3 flex flex-col gap-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground"><Icon className="mt-1 size-4 shrink-0 text-primary" />{item}</li>)}</ul></div>;
}

function GatewayProof({ result }: { result: MortgageMatesGatewayResponse }) {
  return <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-600 opacity-35" /><span className="relative inline-flex size-2 rounded-full bg-emerald-700" /></span>{result.source === "cloud" ? "Live result via Pursuit AI Gateway" : "Hard-gate result · no model call needed"}<span className="hidden sm:inline">· {result.eligibleCandidateCount} eligible</span></div>;
}

function sentence(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
