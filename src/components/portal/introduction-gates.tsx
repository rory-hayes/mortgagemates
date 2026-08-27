"use client";

import { useState } from "react";
import { CreditCardIcon, IdCardIcon, LockKeyholeIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { IntroductionGateMode } from "@/lib/introduction-gate-mode";

export function IntroductionGates({ matchId, identityStatus, paymentStatus, gateMode }: { matchId: string; identityStatus: string; paymentStatus: string; gateMode: IntroductionGateMode }) {
  const [pending, setPending] = useState<"identity" | "checkout" | null>(null);
  async function start(kind: "identity" | "checkout") {
    setPending(kind);
    const response = await fetch(`/api/stripe/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ matchId }) });
    const payload = await response.json() as { url?: string; error?: string };
    setPending(null);
    if (!response.ok || !payload.url) toast.error(payload.error ?? "This gate is not configured yet.");
    else window.location.assign(payload.url);
  }
  const identityComplete = identityStatus === "verified";
  const paymentComplete = paymentStatus === "paid";
  const isMock = gateMode === "mock";
  return <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>{isMock ? "Pilot simulation" : "Both people opted in"}</CardTitle>{isMock ? <Badge variant="secondary">Mock mode</Badge> : null}</div><CardDescription>{isMock ? "Exercise the complete introduction flow without contacting Stripe." : "Complete the two individual gates before contact details unlock."}</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Button variant="outline" disabled={pending !== null || identityComplete} onClick={() => start("identity")}>{pending === "identity" ? <Spinner data-icon="inline-start" /> : <IdCardIcon data-icon="inline-start" />}{identityComplete ? "Identity gate complete" : isMock ? "Simulate identity step" : "Verify identity"}</Button><Button disabled={pending !== null || paymentComplete} onClick={() => start("checkout")}>{pending === "checkout" ? <Spinner data-icon="inline-start" /> : <CreditCardIcon data-icon="inline-start" />}{paymentComplete ? "Payment gate complete" : isMock ? "Simulate payment step" : "Pay €49"}</Button><Alert className="sm:col-span-2"><LockKeyholeIcon /><AlertTitle>{isMock ? "Simulation only — no Stripe transaction" : "Individual and private"}</AlertTitle><AlertDescription>{isMock ? "For MVP testing only. No identity document is collected, no identity verification occurs, and no money is charged." : "Neither person sees the other’s identity document or payment details—only whether each gate is complete."}</AlertDescription></Alert></CardContent></Card>;
}
