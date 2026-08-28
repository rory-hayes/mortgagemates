"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3Icon, SparklesIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function AiMatchLauncher() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/matching/run", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { outcome?: string; message?: string; error?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? "Matching could not run.");
      if (payload?.outcome === "proposed") {
        router.refresh();
        return;
      }
      setMessage(payload?.message ?? "No strong proposal is available yet.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Matching could not run.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Button className="w-full" disabled={pending} onClick={run}>
        {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
        {pending ? "Considering the eligible pool…" : "Find my AI match"}
      </Button>
      {message ? <Alert><Clock3Icon /><AlertTitle>No proposal today</AlertTitle><AlertDescription>{message} You remain in the eligible pool.</AlertDescription></Alert> : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
