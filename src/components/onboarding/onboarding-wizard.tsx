"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LockKeyholeIcon, SaveIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const steps = ["Eligibility", "Your plans", "Finances", "Home & locations", "Living together", "Ownership expectations"] as const;
const incomeOptions = ["Under €40,000", "€40,000–€49,999", "€50,000–€59,999", "€60,000–€74,999", "€75,000–€99,999", "€100,000+"];
const depositOptions = ["Under €20,000", "€20,000–€34,999", "€35,000–€49,999", "€50,000–€74,999", "€75,000+"];
const borrowingOptions = ["Under €180,000", "€180,000–€219,999", "€220,000–€259,999", "€260,000–€319,999", "€320,000+"];
const monthlyOptions = ["Under €1,000", "€1,000–€1,199", "€1,200–€1,399", "€1,400–€1,699", "€1,700+"];
const locations = ["Dublin City", "South Dublin", "Dún Laoghaire–Rathdown", "Fingal", "Kildare", "Meath", "Wicklow", "Louth"];
const propertyTypes = ["Apartment", "Terraced house", "Semi-detached house", "Townhouse"];

type WizardState = {
  firstName: string; ageBand: string; occupationSector: string;
  firstTimeBuyer: boolean; irishResident: boolean; ownerOccupier: boolean; unrelated: boolean;
  timeline: string; bio: string;
  income: string; deposit: string; borrowing: string; monthly: string;
  locations: string[]; propertyTypes: string[];
  household: { noise: string; workFromHome: string; guests: string; pets: string };
  ownership: { horizon: string; shares: string; earlyExit: string; missedPayments: string };
};

type InitialData = { profile: { first_name: string | null; age_band: string | null; occupation_sector: string | null; onboarding_step: number }; preferences: Record<string, unknown> };

function RangeSelect({ id, label, value, options, onChange, description }: { id: string; label: string; value: string; options: string[]; onChange: (value: string) => void; description?: string }) {
  const items = options.map((option) => ({ label: option, value: option }));
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Select items={items} value={value || null} onValueChange={(nextValue) => onChange(String(nextValue ?? ""))}><SelectTrigger id={id} className="w-full"><SelectValue>{value || "Select a range"}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select>{description ? <FieldDescription>{description}</FieldDescription> : null}</Field>;
}

export function OnboardingWizard({ userId, initial }: { userId: string; initial: InitialData }) {
  const prefs = initial.preferences;
  const [step, setStep] = useState(Math.min(Math.max(initial.profile.onboarding_step || 1, 1), 6));
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<WizardState>({
    firstName: initial.profile.first_name ?? "", ageBand: initial.profile.age_band ?? "", occupationSector: initial.profile.occupation_sector ?? "",
    firstTimeBuyer: Boolean(prefs.first_time_buyer), irishResident: Boolean(prefs.irish_resident), ownerOccupier: Boolean(prefs.owner_occupier), unrelated: Boolean(prefs.open_to_unrelated_cobuyer),
    timeline: String(prefs.purchase_timeline ?? ""), bio: String(prefs.bio ?? ""),
    income: String(prefs.income_range ?? ""), deposit: String(prefs.deposit_range ?? ""), borrowing: String(prefs.borrowing_range ?? ""), monthly: String(prefs.monthly_housing_budget_range ?? ""),
    locations: Array.isArray(prefs.target_locations) ? prefs.target_locations.map(String) : [], propertyTypes: Array.isArray(prefs.property_types) ? prefs.property_types.map(String) : [],
    household: { noise: "Quiet most of the time", workFromHome: "2–3 days", guests: "Occasional", pets: "Open to discussing", ...(typeof prefs.household_preferences === "object" && prefs.household_preferences ? prefs.household_preferences as WizardState["household"] : {}) },
    ownership: { horizon: "5–7 years", shares: "Discuss with solicitors", earlyExit: "Independent valuation and agreed notice", missedPayments: "Emergency buffer then legal process", ...(typeof prefs.ownership_expectations === "object" && prefs.ownership_expectations ? prefs.ownership_expectations as WizardState["ownership"] : {}) },
  });
  const router = useRouter();

  function toggleList(key: "locations" | "propertyTypes", item: string, checked: boolean) {
    setState((current) => ({ ...current, [key]: checked ? [...new Set([...current[key], item])] : current[key].filter((value) => value !== item) }));
  }

  async function save(complete: boolean) {
    setSaving(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    const [profileResult, preferencesResult] = await Promise.all([
      supabase.from("profiles").update({ first_name: state.firstName.trim(), age_band: state.ageBand || null, occupation_sector: state.occupationSector.trim() || null, onboarding_step: complete ? 6 : step, onboarding_status: complete ? "ready_for_review" : "draft", terms_accepted_at: complete ? now : undefined, privacy_accepted_at: complete ? now : undefined, last_active_at: now }).eq("id", userId),
      supabase.from("buyer_preferences").update({ first_time_buyer: state.firstTimeBuyer, irish_resident: state.irishResident, owner_occupier: state.ownerOccupier, open_to_unrelated_cobuyer: state.unrelated, purchase_timeline: state.timeline || null, income_range: state.income || null, deposit_range: state.deposit || null, borrowing_range: state.borrowing || null, monthly_housing_budget_range: state.monthly || null, target_locations: state.locations, property_types: state.propertyTypes, household_preferences: state.household, ownership_expectations: state.ownership, bio: state.bio.trim() || null, risk_acknowledged_at: complete ? now : null, ready_for_review_at: complete ? now : null }).eq("user_id", userId),
    ]);
    setSaving(false);
    const error = profileResult.error ?? preferencesResult.error;
    if (error) toast.error(error.message);
    else if (complete) { toast.success("Profile sent for review."); router.push("/portal"); router.refresh(); }
    else toast.success("Draft saved.");
  }

  return <main className="content-grid py-8"><div className="grid gap-7 lg:grid-cols-[250px_1fr]"><aside className="rounded-xl border bg-card p-5"><p className="eyebrow">Profile progress</p><div className="mt-6 flex flex-col gap-1">{steps.map((label, index) => <button type="button" key={label} onClick={() => setStep(index + 1)} className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm", step === index + 1 ? "bg-secondary font-semibold text-primary" : "text-muted-foreground hover:bg-muted")}><span className={cn("flex size-7 items-center justify-center rounded-full border text-xs", index + 1 < step ? "bg-primary text-primary-foreground" : "bg-card")}>{index + 1 < step ? <CheckIcon className="size-4" /> : index + 1}</span>{label}</button>)}</div><Progress className="mt-6" value={(step / 6) * 100} /></aside><Card><CardHeader><p className="eyebrow">Step {step} of 6</p><CardTitle className="text-4xl">{steps[step - 1]}</CardTitle><CardDescription>Your answers stay private and are shown to another member only as a structured compatibility summary.</CardDescription></CardHeader><CardContent>
    {step === 1 ? <FieldGroup><Field><FieldLabel htmlFor="first-name">First name</FieldLabel><Input id="first-name" value={state.firstName} onChange={(event) => setState({ ...state, firstName: event.target.value })} /></Field><div className="grid gap-5 sm:grid-cols-2"><RangeSelect id="age-band" label="Age band" value={state.ageBand} options={["25–29", "30–34", "35–39", "40–44", "45–49"]} onChange={(value) => setState({ ...state, ageBand: value })} /><Field><FieldLabel htmlFor="sector">Occupation sector</FieldLabel><Input id="sector" value={state.occupationSector} onChange={(event) => setState({ ...state, occupationSector: event.target.value })} placeholder="e.g. Public service" /></Field></div><FieldSet><FieldLegend variant="label">Pilot eligibility</FieldLegend><FieldDescription>All four must be true for this pilot.</FieldDescription><FieldGroup className="gap-3">{[["firstTimeBuyer", "I am a first-time buyer"], ["irishResident", "I am resident in Ireland"], ["ownerOccupier", "I will live in the property"], ["unrelated", "I am open to one unrelated co-buyer"]].map(([key, label]) => <Field key={key} orientation="horizontal"><Checkbox id={key} checked={state[key as keyof WizardState] as boolean} onCheckedChange={(checked) => setState({ ...state, [key]: checked === true })} /><FieldLabel htmlFor={key} className="font-normal">{label}</FieldLabel></Field>)}</FieldGroup></FieldSet></FieldGroup> : null}
    {step === 2 ? <FieldGroup><RangeSelect id="timeline" label="When do you want to buy?" value={state.timeline} options={["3–6 months", "6–12 months", "12–18 months"]} onChange={(value) => setState({ ...state, timeline: value })} /><Field><FieldLabel htmlFor="bio">A little about you</FieldLabel><Textarea id="bio" maxLength={600} value={state.bio} onChange={(event) => setState({ ...state, bio: event.target.value })} placeholder="Your routine, what home means to you, and what a good co-buying partnership looks like…" /><FieldDescription>{state.bio.length}/600 characters. No surname, employer, or contact details.</FieldDescription></Field></FieldGroup> : null}
    {step === 3 ? <FieldGroup><Alert><LockKeyholeIcon /><AlertTitle>Ranges only—not a mortgage assessment</AlertTitle><AlertDescription>Another member never sees exact figures or documents. A regulated broker must assess actual borrowing capacity.</AlertDescription></Alert><div className="grid gap-5 sm:grid-cols-2"><RangeSelect id="income" label="Gross annual income range" value={state.income} options={incomeOptions} onChange={(value) => setState({ ...state, income: value })} /><RangeSelect id="deposit" label="Deposit available range" value={state.deposit} options={depositOptions} onChange={(value) => setState({ ...state, deposit: value })} /><RangeSelect id="borrowing" label="Estimated personal borrowing range" value={state.borrowing} options={borrowingOptions} onChange={(value) => setState({ ...state, borrowing: value })} /><RangeSelect id="monthly" label="Monthly housing budget range" value={state.monthly} options={monthlyOptions} onChange={(value) => setState({ ...state, monthly: value })} /></div></FieldGroup> : null}
    {step === 4 ? <div className="grid gap-8 md:grid-cols-2"><FieldSet><FieldLegend>Target locations</FieldLegend><FieldDescription>Choose every area you would seriously consider.</FieldDescription><FieldGroup className="gap-3">{locations.map((location) => <Field key={location} orientation="horizontal"><Checkbox id={`location-${location}`} checked={state.locations.includes(location)} onCheckedChange={(checked) => toggleList("locations", location, checked === true)} /><FieldLabel htmlFor={`location-${location}`} className="font-normal">{location}</FieldLabel></Field>)}</FieldGroup></FieldSet><FieldSet><FieldLegend>Property types</FieldLegend><FieldDescription>Keep the shortlist realistic.</FieldDescription><FieldGroup className="gap-3">{propertyTypes.map((property) => <Field key={property} orientation="horizontal"><Checkbox id={`property-${property}`} checked={state.propertyTypes.includes(property)} onCheckedChange={(checked) => toggleList("propertyTypes", property, checked === true)} /><FieldLabel htmlFor={`property-${property}`} className="font-normal">{property}</FieldLabel></Field>)}</FieldGroup></FieldSet></div> : null}
    {step === 5 ? <FieldGroup>{[["noise", "Household rhythm", ["Quiet most of the time", "Balanced", "Lively and social"]], ["workFromHome", "Working from home", ["Rarely", "1 day", "2–3 days", "4–5 days"]], ["guests", "Overnight guests", ["Rare", "Occasional", "Frequent"]], ["pets", "Pets", ["No pets", "Open to discussing", "Existing pet"]]].map(([key, label, options]) => <Field key={String(key)}><FieldTitle id={`${key}-label`}>{String(label)}</FieldTitle><ToggleGroup aria-labelledby={`${key}-label`} value={[state.household[key as keyof WizardState["household"]]]} onValueChange={(value) => setState({ ...state, household: { ...state.household, [String(key)]: value[0] ?? state.household[key as keyof WizardState["household"]] } })} className="flex-wrap justify-start">{(options as string[]).map((option) => <ToggleGroupItem key={option} value={option}>{option}</ToggleGroupItem>)}</ToggleGroup></Field>)}</FieldGroup> : null}
    {step === 6 ? <FieldGroup>{[["horizon", "Intended minimum ownership horizon", ["3 years", "5–7 years", "7–10 years", "10+ years"]], ["shares", "How should unequal deposits be handled?", ["Equal ownership", "Proportional shares", "Discuss with solicitors"]], ["earlyExit", "If one person wants to leave early", ["Right to buy out first", "Sell on open market", "Independent valuation and agreed notice"]], ["missedPayments", "If one person misses payments", ["Emergency buffer then legal process", "Immediate legal process", "Discuss with solicitors"]]].map(([key, label, options]) => <Field key={String(key)}><FieldTitle id={`${key}-label`}>{String(label)}</FieldTitle><ToggleGroup aria-labelledby={`${key}-label`} value={[state.ownership[key as keyof WizardState["ownership"]]]} onValueChange={(value) => setState({ ...state, ownership: { ...state.ownership, [String(key)]: value[0] ?? state.ownership[key as keyof WizardState["ownership"]] } })} className="flex-wrap justify-start">{(options as string[]).map((option) => <ToggleGroupItem key={option} value={option}>{option}</ToggleGroupItem>)}</ToggleGroup></Field>)}<Alert><ShieldCheckIcon /><AlertTitle>Required acknowledgement</AlertTitle><AlertDescription>Matching cannot remove the financial and legal risks of joint ownership. Each buyer should obtain independent mortgage and legal advice before proceeding.</AlertDescription></Alert></FieldGroup> : null}
  </CardContent><CardFooter className="flex flex-wrap justify-between gap-3"><div className="flex gap-2"><Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}><ArrowLeftIcon data-icon="inline-start" />Back</Button><Button variant="ghost" disabled={saving} onClick={() => save(false)}>{saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}Save draft</Button></div>{step < 6 ? <Button onClick={() => setStep(step + 1)}>Continue <ArrowRightIcon data-icon="inline-end" /></Button> : <Button disabled={saving} onClick={() => save(true)}>{saving ? <Spinner data-icon="inline-start" /> : null}Send for review <ArrowRightIcon data-icon="inline-end" /></Button>}</CardFooter></Card></div></main>;
}
