"use client";

import { useState } from "react";
import { CreditCardIcon, IdCardIcon, LockKeyholeIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function IntroductionGates({ matchId }: { matchId: string }) {
  const [pending, setPending] = useState<"identity" | "checkout" | null>(null);
  async function start(kind: "identity" | "checkout") {
    setPending(kind);
    const response = await fetch(`/api/stripe/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ matchId }) });
    const payload = await response.json() as { url?: string; error?: string };
    setPending(null);
    if (!response.ok || !payload.url) toast.error(payload.error ?? "This gate is not configured yet.");
    else window.location.assign(payload.url);
  }
  return <Card><CardHeader><CardTitle>Both people opted in</CardTitle><CardDescription>Complete the two individual gates before contact details unlock.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Button variant="outline" disabled={pending !== null} onClick={() => start("identity")}>{pending === "identity" ? <Spinner data-icon="inline-start" /> : <IdCardIcon data-icon="inline-start" />}Verify identity</Button><Button disabled={pending !== null} onClick={() => start("checkout")}>{pending === "checkout" ? <Spinner data-icon="inline-start" /> : <CreditCardIcon data-icon="inline-start" />}Pay €49</Button><Alert className="sm:col-span-2"><LockKeyholeIcon /><AlertTitle>Individual and private</AlertTitle><AlertDescription>Neither person sees the other’s identity document or payment details—only whether each gate is complete.</AlertDescription></Alert></CardContent></Card>;
}
