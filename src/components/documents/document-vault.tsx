"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2Icon, DownloadIcon, FileClockIcon, FileTextIcon, FolderLockIcon, SendIcon, ShieldCheckIcon, Trash2Icon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { latestDocumentsByRequirement } from "@/lib/readiness";

export type Requirement = { id: string; label: string; description: string; category: string; required: boolean; applies_when: string | null; validity_days: number | null };
export type BuyerDocument = { id: string; requirement_id: string; storage_path: string; original_filename: string; status: string; expiry_date: string | null; review_note: string | null; created_at: string };
type PairReadiness = { user_id: string; first_name: string | null; accepted_count: number; required_count: number; readiness_percent: number; is_ready: boolean };

const statusCopy: Record<string, string> = { uploaded: "Uploaded", under_review: "Under review", accepted: "Accepted", needs_update: "Needs update", expired: "Expired" };

export function DocumentVault({ userId, requirements, initialDocuments, pairReadiness = [] }: { userId: string; requirements: Requirement[]; initialDocuments: BuyerDocument[]; pairReadiness?: PairReadiness[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const latest = useMemo(() => latestDocumentsByRequirement(documents), [documents]);
  const required = requirements.filter((item) => item.required);
  const accepted = required.filter((item) => latest.get(item.id)?.status === "accepted").length;
  const uploaded = required.filter((item) => latest.has(item.id)).length;
  const percent = required.length ? Math.round((accepted / required.length) * 100) : 0;

  async function upload(requirement: Requirement, file?: File) {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return toast.error("Use a PDF, JPEG, or PNG file.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Files must be 10 MB or smaller.");
    setBusyId(requirement.id);
    const supabase = createClient();
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const path = `${userId}/${requirement.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("buyer-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setBusyId(null); return toast.error(uploadError.message); }
    const { data, error } = await supabase.from("buyer_documents").insert({ user_id: userId, requirement_id: requirement.id, storage_path: path, original_filename: file.name, mime_type: file.type, size_bytes: file.size }).select("id, requirement_id, storage_path, original_filename, status, expiry_date, review_note, created_at").single();
    if (error) { await supabase.storage.from("buyer-documents").remove([path]); toast.error(error.message); }
    else { setDocuments((current) => [data as BuyerDocument, ...current.filter((doc) => doc.requirement_id !== requirement.id)]); toast.success(`${requirement.label} uploaded privately.`); }
    setBusyId(null);
    if (inputRefs.current[requirement.id]) inputRefs.current[requirement.id]!.value = "";
  }

  async function download(document: BuyerDocument) {
    setBusyId(document.requirement_id);
    const { data, error } = await createClient().storage.from("buyer-documents").createSignedUrl(document.storage_path, 60);
    setBusyId(null);
    if (error) toast.error(error.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(document: BuyerDocument) {
    setBusyId(document.requirement_id);
    const supabase = createClient();
    const { error: storageError } = await supabase.storage.from("buyer-documents").remove([document.storage_path]);
    if (!storageError) {
      const { error } = await supabase.from("buyer_documents").delete().eq("id", document.id);
      if (error) toast.error(error.message);
      else { setDocuments((current) => current.filter((item) => item.id !== document.id)); toast.success("Document removed."); }
    } else toast.error(storageError.message);
    setBusyId(null);
  }

  return <main className="content-grid flex flex-col gap-8 py-8"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow">Private document vault</p><h1 className="text-5xl font-medium text-primary">Be ready before you match.</h1><p className="mt-2 max-w-2xl text-muted-foreground">The other buyer sees readiness only. Files stay private until you explicitly request a professional handoff.</p></div><ProfessionalShare userId={userId} documents={documents} disabled={accepted < required.length} /></div><Alert><ShieldCheckIcon /><AlertTitle>Preparation status is not lender approval</AlertTitle><AlertDescription>This checklist is indicative. A regulated broker, lender, and solicitor will confirm the documents they need and whether they are acceptable.</AlertDescription></Alert><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle>Mortgage-readiness checklist</CardTitle><CardDescription>{uploaded} of {required.length} required items uploaded · {accepted} accepted</CardDescription></div><Badge variant="secondary"><FolderLockIcon /> Private bucket</Badge></div></CardHeader><CardContent className="flex flex-col gap-3">{requirements.map((requirement) => { const document = latest.get(requirement.id); return <div key={requirement.id} className="grid items-center gap-4 rounded-xl border bg-background p-4 sm:grid-cols-[1fr_auto]"><div className="flex min-w-0 gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">{document?.status === "accepted" ? <CheckCircle2Icon className="size-5" /> : <FileTextIcon className="size-5" />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{requirement.label}</p><Badge variant={document?.status === "accepted" ? "secondary" : "outline"}>{document ? statusCopy[document.status] ?? document.status : requirement.required ? "Needed" : "Optional"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{requirement.description}{requirement.applies_when ? ` ${requirement.applies_when}.` : ""}</p>{document ? <p className="mt-2 truncate text-xs text-muted-foreground">{document.original_filename}{document.review_note ? ` · ${document.review_note}` : ""}</p> : null}</div></div><div className="flex justify-end gap-2"><Input ref={(node) => { inputRefs.current[requirement.id] = node; }} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => upload(requirement, event.target.files?.[0])} />{document ? <><Button size="sm" variant="outline" disabled={busyId === requirement.id} onClick={() => download(document)}><DownloadIcon data-icon="inline-start" />View</Button><Button size="sm" variant="ghost" disabled={busyId === requirement.id} onClick={() => remove(document)} aria-label={`Remove ${requirement.label}`}><Trash2Icon /></Button></> : <Button size="sm" disabled={busyId === requirement.id} onClick={() => inputRefs.current[requirement.id]?.click()}>{busyId === requirement.id ? <Spinner data-icon="inline-start" /> : <UploadCloudIcon data-icon="inline-start" />}Upload</Button>}</div></div>; })}</CardContent><CardFooter className="border-t text-xs text-muted-foreground">Allowed: PDF, JPEG, or PNG · Maximum 10 MB per file · Avoid password-protected PDFs.</CardFooter></Card><div className="flex flex-col gap-5"><Card><CardHeader><CardTitle>Verified readiness</CardTitle><CardDescription>Accepted, required, and current items</CardDescription></CardHeader><CardContent><p className="text-4xl font-semibold text-primary">{percent}%</p><Progress className="mt-4" value={percent} /><div className="mt-5 flex flex-col gap-3 text-sm"><p className="flex justify-between"><span>Accepted</span><strong>{accepted}</strong></p><p className="flex justify-between"><span>Uploaded or under review</span><strong>{uploaded - accepted}</strong></p><p className="flex justify-between"><span>Still needed</span><strong>{required.length - uploaded}</strong></p></div></CardContent></Card>{pairReadiness.length ? <Card><CardHeader><CardTitle>Matched-pair readiness</CardTitle><CardDescription>Status only—never the files.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{pairReadiness.map((member) => <div key={member.user_id}><div className="mb-2 flex justify-between text-sm"><span>{member.user_id === userId ? "You" : member.first_name ?? "Co-buyer"}</span><strong>{member.readiness_percent}%</strong></div><Progress value={member.readiness_percent} /></div>)}</CardContent></Card> : null}<Alert><FileClockIcon /><AlertTitle>Expiry tracking</AlertTitle><AlertDescription>Items marked with an expiry date return to “needs update” when they are no longer current.</AlertDescription></Alert></div></div></main>;
}

function ProfessionalShare({ userId, documents, disabled }: { userId: string; documents: BuyerDocument[]; disabled: boolean }) {
  const [open, setOpen] = useState(false); const [providerType, setProviderType] = useState("mortgage_broker"); const [providerName, setProviderName] = useState(""); const [pending, setPending] = useState(false);
  const items = [{ label: "Mortgage broker", value: "mortgage_broker" }, { label: "Solicitor", value: "solicitor" }];
  async function requestShare() { setPending(true); const { error } = await createClient().from("document_shares").insert({ user_id: userId, recipient_type: providerType, provider_name: providerName.trim(), document_ids: documents.filter((doc) => doc.status === "accepted").map((doc) => doc.id) }); setPending(false); if (error) toast.error(error.message); else { toast.success("Consent recorded. The pilot team will verify the handoff details."); setOpen(false); } }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="outline" disabled={disabled} />}><SendIcon data-icon="inline-start" />Prepare professional handoff</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Consent to a professional handoff</DialogTitle><DialogDescription>This records which accepted documents you want prepared for one named professional. It does not email or grant access automatically.</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel>Professional type</FieldLabel><Select items={items} value={providerType} onValueChange={(value) => setProviderType(String(value))}><SelectTrigger className="w-full"><SelectValue>{items.find((item) => item.value === providerType)?.label}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="provider-name">Firm or professional name</FieldLabel><Input id="provider-name" value={providerName} onChange={(event) => setProviderName(event.target.value)} placeholder="Name supplied by you" /><FieldDescription>The pilot team verifies the recipient before any transfer.</FieldDescription></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={pending || providerName.trim().length < 2} onClick={requestShare}>{pending ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}Record consent</Button></DialogFooter></DialogContent></Dialog>;
}
