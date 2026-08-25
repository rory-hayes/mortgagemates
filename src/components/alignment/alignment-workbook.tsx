"use client";

import { useMemo, useState } from "react";
import { ArrowRightIcon, CheckCircle2Icon, FileKey2Icon, SaveIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const modules = [
  { id: "money", title: "Money & monthly costs", question: "How should regular housing costs be split?", options: ["Equal monthly split", "Proportional to income", "By ownership share", "Discuss with solicitors"] },
  { id: "ownership", title: "Ownership shares", question: "How should unequal deposits affect ownership?", options: ["Equal shares", "Proportional shares", "Protected initial deposits", "Discuss with solicitors"] },
  { id: "exit", title: "Selling & exit plans", question: "What minimum ownership period feels realistic?", options: ["3 years", "5 years", "7 years", "10+ years"] },
  { id: "missed_payments", title: "Missed payments", question: "What should happen if one person cannot pay temporarily?", options: ["Shared emergency buffer", "Recorded loan between owners", "Immediate legal advice", "Discuss with solicitors"] },
  { id: "household", title: "Guests, pets & work", question: "How should changes to the household be agreed?", options: ["Both must agree", "Notice and discussion", "Personal discretion", "Case by case"] },
  { id: "repairs", title: "Repairs & decisions", question: "How should major repairs be approved?", options: ["Both must agree", "Spending threshold", "By ownership share", "Independent quote process"] },
] as const;

type ExistingResponse = { module: string; question_id: string; response: { choice?: string; notes?: string }; share_with_match: boolean };

export function AlignmentWorkbook({ matchId, userId, initialResponses }: { matchId: string; userId: string; initialResponses: ExistingResponse[] }) {
  const initialMap = useMemo(() => Object.fromEntries(initialResponses.map((item) => [item.module, item])), [initialResponses]);
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { choice: string; notes: string; share: boolean }>>(() => Object.fromEntries(modules.map((module) => [module.id, { choice: initialMap[module.id]?.response.choice ?? "", notes: initialMap[module.id]?.response.notes ?? "", share: initialMap[module.id]?.share_with_match ?? false }])));
  const [saving, setSaving] = useState(false);
  const activeModule = modules[active];
  const complete = Object.values(answers).filter((answer) => answer.choice).length;

  async function save() {
    setSaving(true);
    const answer = answers[activeModule.id];
    const { error } = await createClient().from("alignment_responses").upsert({ match_id: matchId, user_id: userId, module: activeModule.id, question_id: `${activeModule.id}-primary`, response: { choice: answer.choice, notes: answer.notes }, share_with_match: answer.share }, { onConflict: "match_id,user_id,question_id" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Private answer saved.");
  }

  return <main className="content-grid flex flex-col gap-8 py-8"><div><p className="eyebrow">Alignment workbook</p><h1 className="max-w-2xl text-5xl font-medium text-primary">Plan the difficult conversations early.</h1><p className="mt-3 text-muted-foreground">Private answers first. Compare only when both people decide they are ready.</p></div><div className="grid gap-5 lg:grid-cols-[300px_1fr]"><Card><CardHeader><CardTitle>Topics</CardTitle><CardDescription>{complete} of {modules.length} opening prompts answered</CardDescription><Progress value={(complete / modules.length) * 100} /></CardHeader><CardContent className="flex flex-col gap-1">{modules.map((item, index) => <button type="button" key={item.id} onClick={() => setActive(index)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm", active === index ? "bg-secondary font-semibold text-primary" : "hover:bg-muted")}><span className="flex size-7 items-center justify-center rounded-full border">{answers[item.id].choice ? <CheckCircle2Icon className="size-4" /> : index + 1}</span><span className="flex-1">{item.title}</span></button>)}</CardContent></Card><Card><CardHeader><p className="eyebrow">{activeModule.title}</p><CardTitle className="text-3xl">{activeModule.question}</CardTitle><CardDescription>Choose the answer closest to your current view. It is a conversation starting point, not a binding term.</CardDescription></CardHeader><CardContent className="flex flex-col gap-8"><ToggleGroup aria-label={activeModule.question} value={answers[activeModule.id].choice ? [answers[activeModule.id].choice] : []} onValueChange={(value) => setAnswers({ ...answers, [activeModule.id]: { ...answers[activeModule.id], choice: value[0] ?? "" } })} className="grid grid-cols-1 gap-3 sm:grid-cols-2">{activeModule.options.map((option) => <ToggleGroupItem key={option} value={option} className="min-h-16 justify-start px-4 text-left">{option}</ToggleGroupItem>)}</ToggleGroup><Field><FieldLabel htmlFor="alignment-notes">What would the other buyer need to understand?</FieldLabel><Textarea id="alignment-notes" className="min-h-36" value={answers[activeModule.id].notes} onChange={(event) => setAnswers({ ...answers, [activeModule.id]: { ...answers[activeModule.id], notes: event.target.value } })} placeholder="Add practical context or concerns…" /><FieldDescription>Keep names, account details, and sensitive financial information out of this answer.</FieldDescription></Field><Field orientation="horizontal"><Checkbox id="share-answer" checked={answers[activeModule.id].share} onCheckedChange={(checked) => setAnswers({ ...answers, [activeModule.id]: { ...answers[activeModule.id], share: checked === true } })} /><div><FieldLabel htmlFor="share-answer">Ready to compare this answer</FieldLabel><FieldDescription>The matched buyer can see it only after you tick this box.</FieldDescription></div></Field><Alert><FileKey2Icon /><AlertTitle>Preparation, not legal drafting</AlertTitle><AlertDescription>Your solicitors—not MortgageMates—must advise on and draft any co-ownership agreement.</AlertDescription></Alert></CardContent><CardFooter className="justify-between gap-3"><Button variant="outline" disabled={saving} onClick={save}>{saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}Save private answer</Button><Button disabled={active === modules.length - 1} onClick={() => setActive(active + 1)}>Next topic <ArrowRightIcon data-icon="inline-end" /></Button></CardFooter></Card></div><Alert><ShieldCheckIcon /><AlertTitle>Both people should get independent advice</AlertTitle><AlertDescription>The workbook helps surface expectations about costs, shares, decisions, default, and exit. It does not decide what is fair or legally suitable.</AlertDescription></Alert></main>;
}
