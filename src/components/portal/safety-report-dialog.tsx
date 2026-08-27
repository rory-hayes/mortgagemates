"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlagIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export function SafetyReportDialog({ matchId, reportedUserId }: { matchId: string; reportedUserId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit() {
    setPending(true);
    const { error } = await createClient().rpc("submit_safety_report", {
      p_match_id: matchId,
      p_reported_user_id: reportedUserId,
      p_reason: reason.trim(),
    });
    setPending(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Your concern was sent privately and matching has been paused.");
      setOpen(false);
      setReason("");
      router.refresh();
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant="ghost" size="sm" />}><FlagIcon data-icon="inline-start" />Report a concern</DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Report a safety concern</DialogTitle><DialogDescription>This immediately closes the active introduction and pauses the reported member while the pilot team reviews it. Use emergency services if anyone is in immediate danger.</DialogDescription></DialogHeader>
      <Field><FieldLabel htmlFor="safety-reason">What happened?</FieldLabel><Textarea id="safety-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} placeholder="Share the facts the safety team needs to investigate…" /><FieldDescription>{reason.trim().length}/1000 characters. This is visible only to the operations team.</FieldDescription></Field>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={pending || reason.trim().length < 10} onClick={submit}>{pending ? <Spinner data-icon="inline-start" /> : <FlagIcon data-icon="inline-start" />}Submit and pause match</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
