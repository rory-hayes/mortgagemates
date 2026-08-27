"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, MailIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { normalizePublicSiteOrigin } from "@/lib/public-origin";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    let callback: string;
    try {
      const siteOrigin = normalizePublicSiteOrigin(window.location.origin);
      callback = new URL("/auth/callback", siteOrigin).toString();
    } catch {
      setPending(false);
      setError("Secure sign-in is not configured for this deployment.");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback, data: { first_name: firstName.trim() || undefined } },
    });
    setPending(false);
    if (authError) setError(authError.message);
    else setSent(true);
  }

  if (sent) {
    return <Alert><CheckCircle2Icon /><AlertTitle>Check your inbox</AlertTitle><AlertDescription>We sent a secure sign-in link to {email}. It expires shortly and can only be used once.</AlertDescription></Alert>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle className="text-3xl">Your private member portal</CardTitle><CardDescription>Use a secure email link—no password to remember. New members can add their name now.</CardDescription></CardHeader>
        <CardContent>
          <FieldGroup>
            <Field><FieldLabel htmlFor="first-name">First name</FieldLabel><Input id="first-name" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Rory" /><FieldDescription>Used for your profile. Your surname is not shown in matching.</FieldDescription></Field>
            <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="email">Email address</FieldLabel><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} placeholder="you@example.ie" />{error ? <FieldError>{error}</FieldError> : null}</Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3"><Button type="submit" size="lg" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : <MailIcon data-icon="inline-start" />}{pending ? "Sending secure link…" : "Email me a secure link"}<ArrowRightIcon data-icon="inline-end" /></Button><p className="text-center text-xs text-muted-foreground">Sending a link does not submit your profile. You will explicitly accept the <Link className="underline" href="/terms">terms</Link>, <Link className="underline" href="/privacy">privacy notice</Link>, and risk acknowledgement before review.</p></CardFooter>
      </Card>
    </form>
  );
}
