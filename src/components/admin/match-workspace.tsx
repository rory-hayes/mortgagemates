"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3Icon, ExternalLinkIcon, FileCheck2Icon, HandshakeIcon, SearchIcon, ShieldAlertIcon, ShieldCheckIcon, SparklesIcon, UserCheckIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Preferences = { target_locations: string[]; borrowing_range: string | null; deposit_range: string | null; purchase_timeline: string | null; property_types: string[]; ownership_expectations: Record<string, string> };
type AdminMember = { id: string; first_name: string | null; age_band: string | null; onboarding_status: string; onboarding_review_note: string | null; matching_status: string; buyer_preferences: Preferences | null };
type AdminDocument = { id: string; user_id: string; requirement_id: string; storage_path: string; original_filename: string; status: string; expiry_date: string | null; review_note: string | null; created_at: string };
type AdminReport = { id: string; reporter_id: string; reported_user_id: string | null; match_id: string | null; reason: string; status: string; created_at: string; resolution_note: string | null };
type AdminShare = { id: string; user_id: string; recipient_type: string; provider_name: string; document_ids: string[]; status: string; consented_at: string };
type Metrics = { ready: number; review: number; proposals: number; mutual: number };

export function MatchWorkspace({ members, documents, reports, shares, metrics }: { members: AdminMember[]; documents: AdminDocument[]; reports: AdminReport[]; shares: AdminShare[]; metrics: Metrics }) {
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const router = useRouter();
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const filtered = useMemo(() => members.filter((member) => (member.first_name ?? "").toLowerCase().includes(search.toLowerCase())), [members, search]);
  const matchingPool = useMemo(() => filtered.filter((member) => member.onboarding_status === "approved" && member.matching_status === "ready"), [filtered]);

  async function runRpc(key: string, name: string, args: Record<string, unknown>, success: string) {
    setPendingKey(key);
    const { error } = await createClient().rpc(name, args);
    setPendingKey(null);
    if (error) toast.error(error.message);
    else { toast.success(success); router.refresh(); }
  }

  async function viewDocument(document: AdminDocument) {
    setPendingKey(`view-${document.id}`);
    const supabase = createClient();
    const { error: reviewError } = await supabase.rpc("admin_review_document", {
      p_document_id: document.id,
      p_status: "under_review",
      p_note: null,
      p_expiry_date: null,
    });
    if (reviewError) { setPendingKey(null); toast.error(reviewError.message); return; }
    const { data, error } = await supabase.storage.from("buyer-documents").createSignedUrl(document.storage_path, 60);
    setPendingKey(null);
    if (error) toast.error(error.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return <main className="content-grid flex flex-col gap-7 py-8">
    <div><div className="flex items-center gap-2"><p className="eyebrow">Operations</p><Badge variant="outline">Admin only</Badge></div><h1 className="text-5xl font-medium text-primary">Pilot operations</h1><p className="text-muted-foreground">Review profiles, documents, safety, and handoffs. Buyer pairing is automated and cannot be selected here.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Profiles ready", metrics.ready, UserCheckIcon], ["Awaiting review", metrics.review, Clock3Icon], ["Active proposals", metrics.proposals, HandshakeIcon], ["Mutual opt-ins", metrics.mutual, UsersIcon]].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof UsersIcon; return <Card key={String(label)}><CardHeader><MetricIcon className="size-5 text-primary" /><CardDescription>{String(label)}</CardDescription><CardTitle className="text-4xl">{String(value)}</CardTitle></CardHeader></Card>; })}</div>
    <Tabs defaultValue="profiles">
      <TabsList className="h-auto max-w-full flex-wrap"><TabsTrigger value="profiles">Profiles ({metrics.review})</TabsTrigger><TabsTrigger value="documents">Documents ({documents.filter((item) => ["uploaded", "under_review"].includes(item.status)).length})</TabsTrigger><TabsTrigger value="matching">AI matching ({metrics.ready})</TabsTrigger><TabsTrigger value="reports">Safety ({reports.length})</TabsTrigger><TabsTrigger value="shares">Handoffs ({shares.length})</TabsTrigger></TabsList>
      <div className="relative max-w-md"><SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search first names" aria-label="Search members by first name" /></div>
      <TabsContent value="profiles"><ProfileQueue members={filtered} notes={notes} setNotes={setNotes} pendingKey={pendingKey} runRpc={runRpc} /></TabsContent>
      <TabsContent value="documents"><DocumentQueue documents={documents} memberById={memberById} notes={notes} setNotes={setNotes} expiryDates={expiryDates} setExpiryDates={setExpiryDates} pendingKey={pendingKey} runRpc={runRpc} viewDocument={viewDocument} /></TabsContent>
      <TabsContent value="matching"><AutomatedMatchingStatus members={matchingPool} /></TabsContent>
      <TabsContent value="reports"><ReportQueue reports={reports} memberById={memberById} notes={notes} setNotes={setNotes} pendingKey={pendingKey} runRpc={runRpc} /></TabsContent>
      <TabsContent value="shares"><ShareQueue shares={shares} memberById={memberById} pendingKey={pendingKey} runRpc={runRpc} /></TabsContent>
    </Tabs>
  </main>;
}

type NotesProps = { notes: Record<string, string>; setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>; pendingKey: string | null; runRpc: (key: string, name: string, args: Record<string, unknown>, success: string) => Promise<void> };

function ProfileQueue({ members, notes, setNotes, pendingKey, runRpc }: { members: AdminMember[] } & NotesProps) {
  const queue = members.filter((member) => ["ready_for_review", "under_review", "changes_requested", "approved", "paused"].includes(member.onboarding_status));
  if (!queue.length) return <QueueEmpty title="No profiles in this view" description="New review submissions will appear here." />;
  return <div className="grid gap-4 lg:grid-cols-2">{queue.map((member) => {
    const note = notes[member.id] ?? member.onboarding_review_note ?? "";
    const canStartReview = member.onboarding_status === "ready_for_review";
    const canRequestChanges = member.onboarding_status !== "changes_requested";
    const canApprove = member.onboarding_status === "under_review";
    return <Card key={member.id}>
      <CardHeader><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Avatar><AvatarFallback>{member.first_name?.[0] ?? "M"}</AvatarFallback></Avatar><div><CardTitle>{member.first_name ?? "Member"}</CardTitle><CardDescription>{member.age_band ?? "Age band missing"} · {member.matching_status.replaceAll("_", " ")}</CardDescription></div></div><Badge variant={member.onboarding_status === "approved" ? "secondary" : "outline"}>{member.onboarding_status.replaceAll("_", " ")}</Badge></div></CardHeader>
      <CardContent><Field><FieldLabel htmlFor={`profile-note-${member.id}`}>Review note</FieldLabel><Textarea id={`profile-note-${member.id}`} value={note} onChange={(event) => setNotes((current) => ({ ...current, [member.id]: event.target.value }))} maxLength={1000} placeholder="Specific decision rationale or changes required…" /><FieldDescription>Approval and change requests require at least 10 characters.</FieldDescription></Field></CardContent>
      <CardFooter className="flex-wrap gap-2">
        {canStartReview ? <Button variant="outline" disabled={pendingKey === member.id} onClick={() => runRpc(member.id, "admin_review_profile", { p_user_id: member.id, p_status: "under_review", p_note: note || null }, "Profile marked under review.")}>Start review</Button> : null}
        {canRequestChanges ? <Button variant="outline" disabled={note.trim().length < 10 || pendingKey === member.id} onClick={() => runRpc(member.id, "admin_review_profile", { p_user_id: member.id, p_status: "changes_requested", p_note: note }, "Changes requested.")}>Request changes</Button> : null}
        {canApprove ? <Button disabled={note.trim().length < 10 || pendingKey === member.id} onClick={() => runRpc(member.id, "admin_review_profile", { p_user_id: member.id, p_status: "approved", p_note: note }, "Profile approved; document readiness recalculated.")}>{pendingKey === member.id ? <Spinner data-icon="inline-start" /> : <UserCheckIcon data-icon="inline-start" />}Approve</Button> : null}
      </CardFooter>
    </Card>;
  })}</div>;
}

function DocumentQueue({ documents, memberById, notes, setNotes, expiryDates, setExpiryDates, pendingKey, runRpc, viewDocument }: { documents: AdminDocument[]; memberById: Map<string, AdminMember>; expiryDates: Record<string, string>; setExpiryDates: React.Dispatch<React.SetStateAction<Record<string, string>>>; viewDocument: (document: AdminDocument) => Promise<void> } & NotesProps) {
  const queue = documents.filter((document) => ["uploaded", "under_review"].includes(document.status));
  if (!queue.length) return <QueueEmpty title="No documents awaiting action" description="Uploads and member updates will appear here." />;
  return <Card><CardHeader><CardTitle>Document review queue</CardTitle><CardDescription>Open the private file, start review to lock its bytes, then record a reasoned outcome.</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Requirement</TableHead><TableHead>File</TableHead><TableHead>Review details</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{queue.map((document) => <TableRow key={document.id}><TableCell>{memberById.get(document.user_id)?.first_name ?? "Member"}</TableCell><TableCell>{document.requirement_id.replaceAll("-", " ")}</TableCell><TableCell><Button size="sm" variant="outline" disabled={pendingKey === `view-${document.id}`} onClick={() => viewDocument(document)}>{pendingKey === `view-${document.id}` ? <Spinner data-icon="inline-start" /> : <ExternalLinkIcon data-icon="inline-start" />}Open</Button><p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">{document.original_filename}</p></TableCell><TableCell><Input type="date" aria-label={`Expiry date for ${document.original_filename}`} value={expiryDates[document.id] ?? document.expiry_date ?? ""} onChange={(event) => setExpiryDates((current) => ({ ...current, [document.id]: event.target.value }))} /><Textarea className="mt-2 min-h-16" aria-label={`Review note for ${document.original_filename}`} value={notes[document.id] ?? document.review_note ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Reason if an update is needed" /></TableCell><TableCell><div className="flex flex-col gap-2">{document.status === "uploaded" ? <Button size="sm" variant="outline" disabled={pendingKey === document.id} onClick={() => runRpc(document.id, "admin_review_document", { p_document_id: document.id, p_status: "under_review", p_note: notes[document.id] ?? null, p_expiry_date: null }, "Review started; the uploaded file is now locked.")}>Start review</Button> : <Button size="sm" disabled={pendingKey === document.id} onClick={() => runRpc(document.id, "admin_review_document", { p_document_id: document.id, p_status: "accepted", p_note: notes[document.id] ?? null, p_expiry_date: expiryDates[document.id] || null }, "Document accepted and readiness recalculated.")}><FileCheck2Icon data-icon="inline-start" />Accept</Button>}<Button size="sm" variant="outline" disabled={(notes[document.id] ?? "").trim().length < 5 || pendingKey === document.id} onClick={() => runRpc(document.id, "admin_review_document", { p_document_id: document.id, p_status: "needs_update", p_note: notes[document.id], p_expiry_date: null }, "Member asked to update the document.")}>Needs update</Button></div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}

function AutomatedMatchingStatus({ members }: { members: AdminMember[] }) {
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><Card><CardHeader><CardTitle>Approved, ready members</CardTitle><CardDescription>Members in this pool can run the automated engine. The model receives only sanitised ranges and preferences.</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Areas</TableHead><TableHead>Borrowing range</TableHead><TableHead>Timing</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.id}><TableCell>{member.first_name ?? "Member"}<p className="text-xs text-muted-foreground">{member.age_band ?? "Age band missing"}</p></TableCell><TableCell className="max-w-56 truncate">{member.buyer_preferences?.target_locations?.join(", ") || "—"}</TableCell><TableCell>{member.buyer_preferences?.borrowing_range ?? "—"}</TableCell><TableCell>{member.buyer_preferences?.purchase_timeline ?? "—"}</TableCell><TableCell><Badge variant="secondary">Eligible pool</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card><Card><CardHeader><SparklesIcon className="size-6 text-primary" /><CardTitle className="mt-3">No manual pair selection</CardTitle><CardDescription>Operations staff cannot choose or send a buyer pair.</CardDescription></CardHeader><CardContent><Alert><ShieldCheckIcon /><AlertTitle>Bounded automation</AlertTitle><AlertDescription>The database rechecks approval, current documents, availability, safety blocks, shared area, property type, timing, and ownership horizon. AI then ranks only eligible people and can propose one result at 70 or above.</AlertDescription></Alert></CardContent></Card></div>;
}

function ReportQueue({ reports, memberById, notes, setNotes, pendingKey, runRpc }: { reports: AdminReport[]; memberById: Map<string, AdminMember> } & NotesProps) {
  if (!reports.length) return <QueueEmpty title="No open safety reports" description="New member concerns will pause matching and appear here." />;
  return <div className="grid gap-4 lg:grid-cols-2">{reports.map((report) => <Card key={report.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Safety concern</CardTitle><CardDescription>{memberById.get(report.reporter_id)?.first_name ?? "Member"} reported {report.reported_user_id ? memberById.get(report.reported_user_id)?.first_name ?? "a member" : "a member"} · {new Date(report.created_at).toLocaleDateString("en-IE")}</CardDescription></div><Badge variant="destructive">{report.status}</Badge></div></CardHeader><CardContent><Alert><ShieldAlertIcon /><AlertTitle>Member statement</AlertTitle><AlertDescription>{report.reason}</AlertDescription></Alert><Field className="mt-4"><FieldLabel htmlFor={`report-note-${report.id}`}>Resolution note</FieldLabel><Textarea id={`report-note-${report.id}`} value={notes[report.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Investigation, decision, and follow-up…" /></Field></CardContent><CardFooter className="gap-2"><Button variant="outline" disabled={(notes[report.id] ?? "").trim().length < 10 || pendingKey === report.id} onClick={() => runRpc(report.id, "admin_resolve_report", { p_report_id: report.id, p_status: "dismissed", p_note: notes[report.id] }, "Report dismissed and readiness recalculated.")}>Dismiss</Button><Button disabled={(notes[report.id] ?? "").trim().length < 10 || pendingKey === report.id} onClick={() => runRpc(report.id, "admin_resolve_report", { p_report_id: report.id, p_status: "resolved", p_note: notes[report.id] }, "Report resolved; reported member remains paused.")}>Resolve and retain pause</Button></CardFooter></Card>)}</div>;
}

function ShareQueue({ shares, memberById, pendingKey, runRpc }: { shares: AdminShare[]; memberById: Map<string, AdminMember>; pendingKey: string | null; runRpc: NotesProps["runRpc"] }) {
  if (!shares.length) return <QueueEmpty title="No handoff requests" description="Named, consented professional handoffs will appear here." />;
  return <Card><CardHeader><CardTitle>Professional handoff requests</CardTitle><CardDescription>Confirm the named recipient out of band. Recording “shared” does not itself transmit a file.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{shares.map((share) => <div key={share.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center"><div className="flex-1"><p className="font-semibold">{memberById.get(share.user_id)?.first_name ?? "Member"} → {share.provider_name}</p><p className="text-sm text-muted-foreground">{share.recipient_type.replaceAll("_", " ")} · {share.document_ids.length} documents · consented {new Date(share.consented_at).toLocaleDateString("en-IE")}</p></div><div className="flex gap-2"><Button variant="outline" disabled={pendingKey === share.id} onClick={() => runRpc(share.id, "admin_update_document_share", { p_share_id: share.id, p_status: "expired" }, "Handoff request expired.")}>Expire</Button><Button disabled={pendingKey === share.id} onClick={() => runRpc(share.id, "admin_update_document_share", { p_share_id: share.id, p_status: "shared" }, "Handoff recorded as shared.")}>Mark shared</Button></div></div>)}</CardContent></Card>;
}

function QueueEmpty({ title, description }: { title: string; description: string }) {
  return <Alert><ShieldCheckIcon /><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription></Alert>;
}
