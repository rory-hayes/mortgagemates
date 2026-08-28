import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BadgeCheckIcon, BriefcaseBusinessIcon, CheckIcon, FileCheck2Icon, FileLock2Icon, FolderKeyIcon, HandshakeIcon, IdCardIcon, LandmarkIcon, MapPinIcon, ScaleIcon, ShieldCheckIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const process = [
  { icon: UsersIcon, title: "Tell us your plans", copy: "Share ranges, locations, timing, and how you expect to live and own together." },
  { icon: FileCheck2Icon, title: "Get document ready", copy: "Complete a guided, private checklist before an introduction slows down." },
  { icon: SparklesIcon, title: "AI ranks one fit", copy: "Hard rules filter the pool first. AI ranks only eligible people and may propose one strong fit." },
  { icon: HandshakeIcon, title: "Both choose to connect", copy: "Identity, payment, and consent gates protect both people before contact opens." },
] as const;

const matchRows = [
  ["Shared search area", "South Dublin · Dún Laoghaire", "South Dublin · Dún Laoghaire"],
  ["Personal purchase capacity", "€250k–€310k", "€270k–€320k"],
  ["Purchase timing", "Within 6–12 months", "Within 6–12 months"],
  ["Property", "2–3 bed house", "2–3 bed house or townhouse"],
  ["Household rhythm", "Quiet weekdays", "Quiet weekdays"],
  ["Ownership horizon", "5–7 years", "5–7 years"],
] as const;

const faqs = [
  ["Is MortgageMates a mortgage broker?", "No. MortgageMates is a matching and preparation service. A regulated mortgage broker must assess what each person can borrow and arrange any mortgage."],
  ["Can another member see my documents?", "No. Your vault is private. A matched buyer sees only a readiness status. Documents are shared with a broker or solicitor only after your explicit consent."],
  ["Does a completed checklist mean a lender will approve me?", "No. It means the agreed preparation checklist is current. Your broker and lender will confirm their own requirements and make all affordability and lending decisions."],
  ["How does the AI choose a match?", "Hard rules first require a shared search area and property type, the same purchase window and ownership horizon, current documents, approval, availability, and no open safety block. AI then ranks only those eligible profiles using sanitised financial ranges, home preferences, timing, and household expectations. Names, contact details, and documents are not sent to the model."],
  ["When is the €49 charged?", "Only after both people independently choose to proceed with the introduction. The charge covers identity verification, contact unlock, the alignment workbook, and handoff preparation."],
  ["What if we do not agree on an exit plan?", "You should not proceed until both people have independent legal advice and a co-ownership agreement they understand. The workbook surfaces the questions; your solicitors advise and draft the legal agreement."],
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b">
          <div className="content-grid grid min-h-[650px] gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-16">
            <div className="flex max-w-xl flex-col items-start gap-7">
              <Badge variant="outline">Ireland pilot · Greater Dublin</Badge>
              <div className="flex flex-col gap-5">
                <h1 className="max-w-[11ch] text-6xl leading-[0.96] font-medium text-primary sm:text-7xl">Buy together. Move forward separately.</h1>
                <p className="max-w-lg text-lg leading-8 text-muted-foreground">Meet one financially aligned co-buyer, arrive document-ready, and take the next step with independent professionals.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/eligibility" className={cn(buttonVariants({ size: "lg" }))}>Check my eligibility <ArrowRightIcon data-icon="inline-end" /></Link>
                <Link href="/investor-trial" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}><SparklesIcon data-icon="inline-start" />Try live AI matching</Link>
                <Link href="/preview" className={cn(buttonVariants({ variant: "link", size: "lg" }))}>Explore the sample portal</Link>
              </div>
              <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"><MapPinIcon className="mt-0.5 size-4 shrink-0" />For two unrelated owner-occupiers buying in Greater Dublin and commuter counties.</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-[0_24px_80px_-36px_rgba(21,61,53,0.55)]">
              <Image src="/images/mortgagemates-home.png" alt="A well-kept red-brick Dublin end-terrace home with a green door after rain" width={1600} height={1024} priority className="aspect-[16/11] h-full w-full object-cover" />
              <div className="absolute right-5 bottom-5 max-w-[240px] rounded-xl border bg-card/96 p-5 shadow-lg backdrop-blur"><BadgeCheckIcon className="mb-3 size-6 text-primary" /><p className="font-heading text-2xl leading-6">One serious introduction at a time.</p></div>
            </div>
          </div>
          <div className="content-grid pb-8">
            <div className="grid rounded-xl border bg-card sm:grid-cols-3">
              {[{ icon: ShieldCheckIcon, label: "Profile ranges, not bank statements" }, { icon: FileLock2Icon, label: "Private document vault" }, { icon: ScaleIcon, label: "Independent legal advice" }].map((item) => <div key={item.label} className="flex items-center justify-center gap-3 px-5 py-5 text-sm font-semibold sm:[&:not(:last-child)]:border-r"><item.icon className="size-5 text-primary" />{item.label}</div>)}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="paper-grid py-24">
          <div className="content-grid flex flex-col gap-12">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"><p className="eyebrow">How it works</p><h2 className="text-5xl font-medium text-primary">A careful path to co-buying</h2><p className="text-lg text-muted-foreground">Built to remove uncertainty before two people spend money, share documents, or exchange contact details.</p></div>
            <div className="grid gap-4 md:grid-cols-4">
              {process.map((step, index) => <Card key={step.title} className="bg-card/92"><CardHeader><div className="mb-3 flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary"><step.icon className="size-5" /></span><span className="font-heading text-3xl text-muted-foreground/60">0{index + 1}</span></div><CardTitle>{step.title}</CardTitle><CardDescription>{step.copy}</CardDescription></CardHeader></Card>)}
            </div>
          </div>
        </section>

        <section id="documents" className="border-y bg-card py-24">
          <div className="content-grid grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div className="flex flex-col items-start gap-6">
              <p className="eyebrow">Document ready</p><h2 className="max-w-[10ch] text-5xl font-medium text-primary">No match should stall on paperwork.</h2>
              <p className="text-lg leading-8 text-muted-foreground">Build your private readiness pack before an introduction. Track what is missing, under review, accepted, or due to expire—without exposing documents to a potential co-buyer.</p>
              <ul className="flex flex-col gap-3 text-sm">{["Guided checklist for identity, income, banking, deposit, and commitments", "PDF and image uploads in a private Supabase Storage vault", "Side-by-side readiness only after a match", "Explicit consent before professional handoff"].map((item) => <li key={item} className="flex gap-3"><CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />{item}</li>)}</ul>
              <Link href="/preview?view=documents" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>See the document tracker</Link>
            </div>
            <Card className="overflow-hidden">
              <CardHeader className="border-b"><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="text-3xl">Your mortgage-readiness pack</CardTitle><CardDescription>7 of 9 items uploaded · 6 accepted</CardDescription></div><Badge variant="secondary"><FolderKeyIcon /> Private vault</Badge></div></CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6"><div className="flex items-end justify-between"><div><p className="text-4xl font-semibold text-primary">67%</p><p className="text-sm text-muted-foreground">verified ready</p></div><p className="max-w-[220px] text-right text-xs leading-5 text-muted-foreground">Your matched buyer sees only this readiness status.</p></div><Progress value={67} /><div className="grid gap-3 sm:grid-cols-2">{[{ label: "Photo identification", status: "Accepted", icon: IdCardIcon }, { label: "Recent payslips", status: "Accepted", icon: FileCheck2Icon }, { label: "Bank statements", status: "Under review", icon: LandmarkIcon }, { label: "Salary certificate", status: "Needed", icon: BriefcaseBusinessIcon }].map((item) => <div key={item.label} className="flex items-center gap-3 rounded-lg border bg-background p-3"><span className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary"><item.icon className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.status}</p></div></div>)}</div></CardContent>
              <CardFooter className="border-t bg-muted/35 text-xs text-muted-foreground">Checklist requirements are indicative. Your broker and lender confirm what they need.</CardFooter>
            </Card>
          </div>
        </section>

        <section className="py-24">
          <div className="content-grid flex flex-col gap-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">AI-ranked example</p><h2 className="text-4xl font-medium text-primary">A promising fit in South Dublin</h2></div><Badge variant="outline"><SparklesIcon /> One considered proposal, not a swipe feed</Badge></div><Card><CardHeader className="grid gap-4 border-b sm:grid-cols-[1fr_0.8fr_1fr]"><div><p className="text-xs text-muted-foreground">You</p><CardTitle>Rory, 34–39</CardTitle></div><div className="hidden sm:block" /><div><p className="text-xs text-muted-foreground">Potential co-buyer</p><CardTitle>Aisling, 32–37</CardTitle></div></CardHeader><CardContent className="p-0"><div className="divide-y">{matchRows.map(([label, left, right]) => <div key={label} className="grid gap-2 px-6 py-4 text-sm sm:grid-cols-[1fr_0.8fr_1fr]"><p>{left}</p><p className="font-semibold text-muted-foreground sm:text-center">{label}</p><p>{right}</p></div>)}</div></CardContent><CardFooter className="grid w-full gap-3 border-t md:grid-cols-[auto_1fr_1fr]"><p className="font-heading text-xl">Worth discussing</p><Badge variant="outline">Working-from-home expectations</Badge><Badge variant="outline">Deposit contribution approach</Badge></CardFooter></Card></div>
        </section>

        <section id="safety" className="bg-primary py-24 text-primary-foreground"><div className="content-grid grid gap-12 lg:grid-cols-[0.7fr_1.3fr]"><div className="flex flex-col gap-5"><p className="text-xs font-semibold tracking-[0.18em] uppercase text-primary-foreground/60">Safety by design</p><h2 className="max-w-[11ch] text-5xl font-medium">Compatibility is the start, not the contract.</h2><p className="leading-7 text-primary-foreground/72">We help two people get ready and decide whether to talk. Regulated, independent professionals help them decide whether to buy.</p></div><div className="grid gap-8 sm:grid-cols-2">{[{ icon: ShieldCheckIcon, title: "Identity checks", copy: "Contact remains locked until both parties complete verification." }, { icon: LandmarkIcon, title: "Broker qualification", copy: "A regulated broker assesses borrowing capacity and mortgage options." }, { icon: ScaleIcon, title: "Separate legal advice", copy: "Each person should instruct their own solicitor before committing." }, { icon: FileCheck2Icon, title: "Co-ownership agreement", copy: "Solicitors advise on shares, expenses, decisions, default, and exit." }].map((item) => <div key={item.title} className="flex gap-4"><item.icon className="mt-1 size-6 shrink-0 text-secondary" /><div><h3 className="font-sans text-base font-semibold tracking-normal">{item.title}</h3><p className="mt-2 text-sm leading-6 text-primary-foreground/68">{item.copy}</p></div></div>)}</div></div></section>

        <section id="pricing" className="border-b py-24"><div className="content-grid grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center"><div className="flex flex-col gap-4"><p className="eyebrow">Simple pilot pricing</p><h2 className="text-5xl font-medium text-primary">€49 each, only after you both want to connect.</h2><p className="text-muted-foreground">No upfront matching fee. No charge for declining an introduction.</p></div><div className="grid gap-4 sm:grid-cols-2">{[{ icon: IdCardIcon, title: "Identity verification", copy: "A secure identity gate before contact." }, { icon: UsersIcon, title: "Direct contact", copy: "Unlocked only when both are ready." }, { icon: FileCheck2Icon, title: "Alignment workbook", copy: "Structured prompts for hard conversations." }, { icon: BriefcaseBusinessIcon, title: "Professional handoff", copy: "Consent-led document preparation for advisers." }].map((item) => <Card key={item.title}><CardHeader><item.icon className="size-6 text-primary" /><CardTitle className="mt-3">{item.title}</CardTitle><CardDescription>{item.copy}</CardDescription></CardHeader></Card>)}</div></div></section>

        <section id="professionals" className="bg-secondary/55 py-20"><div className="content-grid"><Alert className="mx-auto max-w-4xl bg-card"><HandshakeIcon /><AlertTitle>Built for a cleaner broker and solicitor handoff</AlertTitle><AlertDescription>Members arrive with an organised checklist and explicit sharing consent. MortgageMates does not recommend a specific legal outcome, guarantee completeness, or take solicitor referral commission.</AlertDescription></Alert></div></section>
        <section className="py-24"><div className="content-grid grid gap-10 lg:grid-cols-[0.6fr_1fr]"><div><p className="eyebrow">Questions, answered plainly</p><h2 className="mt-3 text-5xl font-medium text-primary">Before you decide.</h2></div><Accordion>{faqs.map(([question, answer], index) => <AccordionItem key={question} value={`faq-${index}`}><AccordionTrigger>{question}</AccordionTrigger><AccordionContent>{answer}</AccordionContent></AccordionItem>)}</Accordion></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
