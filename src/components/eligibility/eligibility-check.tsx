"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const questions = [
  ["firstTimeBuyer", "Are you a first-time buyer?", "The pilot is deliberately narrow while we test the model."],
  ["ownerOccupier", "Will you live in the property as your main home?", "The pilot does not support investment or buy-to-let purchases."],
  ["unrelated", "Are you open to buying with one unrelated co-buyer?", "MortgageMates currently supports exactly two buyers."],
  ["region", "Are you looking in Greater Dublin or a commuter county?", "Dublin, Kildare, Meath, Wicklow, or Louth for the first pilot."],
  ["timeline", "Are you aiming to buy within 18 months?", "A nearer purchase window keeps introductions practical."],
] as const;

export function EligibilityCheck() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answered = Object.keys(answers).length;
  const complete = answered === questions.length;
  const eligible = useMemo(() => complete && Object.values(answers).every((answer) => answer === "yes"), [answers, complete]);

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader><p className="eyebrow">Two-minute check</p><h1 className="font-heading text-4xl font-medium tracking-tight text-primary">Is this pilot right for you?</h1><CardDescription>These questions establish fit; they are not a mortgage or affordability assessment.</CardDescription><Progress value={(answered / questions.length) * 100} /></CardHeader>
      <CardContent>
        <FieldGroup>
          {questions.map(([key, title, description], index) => <Field key={key} orientation="responsive"><div className="flex flex-1 gap-3"><span className="font-heading text-2xl text-muted-foreground">{index + 1}</span><div><FieldTitle id={`${key}-label`}>{title}</FieldTitle><FieldDescription>{description}</FieldDescription></div></div><ToggleGroup aria-labelledby={`${key}-label`} value={answers[key] ? [answers[key]] : []} onValueChange={(value) => setAnswers((current) => ({ ...current, [key]: value[0] ?? "" }))}><ToggleGroupItem value="yes">Yes</ToggleGroupItem><ToggleGroupItem value="no">No</ToggleGroupItem></ToggleGroup></Field>)}
        </FieldGroup>
        {complete ? eligible ? <Alert className="mt-6"><CheckCircle2Icon /><AlertTitle>You fit the pilot criteria</AlertTitle><AlertDescription>You can create a private profile next. This does not mean you qualify for a mortgage.</AlertDescription></Alert> : <Alert variant="destructive" className="mt-6"><CircleAlertIcon /><AlertTitle>This pilot is not the right fit yet</AlertTitle><AlertDescription>We are keeping the first version narrow. You can still explore the sample portal and see how the model works.</AlertDescription></Alert> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3"><Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}><ArrowLeftIcon data-icon="inline-start" />Back</Link>{complete && eligible ? <Link href="/login" className={cn(buttonVariants())}>Create my profile <ArrowRightIcon data-icon="inline-end" /></Link> : <Button disabled={!complete} variant="outline" onClick={() => setAnswers({})}>{complete ? "Start again" : `${questions.length - answered} left`}</Button>}</CardFooter>
    </Card>
  );
}
