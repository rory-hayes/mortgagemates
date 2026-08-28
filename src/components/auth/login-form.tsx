"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, KeyRoundIcon, UserPlusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, passwordPolicyError } from "@/lib/auth-password";

type AuthMode = "login" | "signup";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const email = username.trim().toLowerCase();

    if (mode === "signup") {
      if (!firstName.trim()) {
        setError("Enter your first name.");
        return;
      }
      const policyError = passwordPolicyError(password);
      if (policyError) {
        setError(policyError);
        return;
      }
      if (password !== confirmPassword) {
        setError("The passwords do not match.");
        return;
      }
    }

    setPending(true);
    const supabase = createClient();

    try {
      const { data, error: authError } = mode === "signup"
        ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName.trim() } },
        })
        : await supabase.auth.signInWithPassword({ email, password });

      setPending(false);

      if (authError) {
        setError(mode === "login"
          ? "The username or password is incorrect."
          : "We could not create the account. Check the details or try logging in.");
        return;
      }
      if (!data.session) {
        selectMode("login");
        setNotice("Account created. Confirm your email address, then return here and log in with your password. The email only verifies your username; it does not sign you in.");
        return;
      }

      router.replace("/portal");
      router.refresh();
    } catch {
      setPending(false);
      setError("Secure account access is temporarily unavailable. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-3xl">Your private member portal</CardTitle>
            <CardDescription className="mt-2">Sign in with your username and password. Your email address is your username.</CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" aria-label="Account access options">
            <Button type="button" variant={mode === "login" ? "default" : "ghost"} onClick={() => selectMode("login")} aria-pressed={mode === "login"} disabled={pending}>Log in</Button>
            <Button type="button" variant={mode === "signup" ? "default" : "ghost"} onClick={() => selectMode("signup")} aria-pressed={mode === "signup"} disabled={pending}>Create account</Button>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {mode === "signup" ? (
              <Field>
                <FieldLabel htmlFor="first-name">First name</FieldLabel>
                <Input id="first-name" autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Rory" />
                <FieldDescription>Used for your profile. Your surname is not shown in matching.</FieldDescription>
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input id="username" name="username" type="email" inputMode="email" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="you@example.ie" />
              <FieldDescription>Use your email address as your username.</FieldDescription>
            </Field>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} />
              {mode === "signup" ? <FieldDescription>{PASSWORD_REQUIREMENTS.join(", ")}.</FieldDescription> : null}
            </Field>
            {mode === "signup" ? (
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                <Input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(error)} />
              </Field>
            ) : null}
            {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
            {notice ? <Alert><AlertDescription>{notice}</AlertDescription></Alert> : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : mode === "login" ? <KeyRoundIcon data-icon="inline-start" /> : <UserPlusIcon data-icon="inline-start" />}
            {pending ? (mode === "login" ? "Logging in…" : "Creating account…") : (mode === "login" ? "Log in securely" : "Create secure account")}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">Creating an account does not submit your profile. You will explicitly accept the <Link className="underline" href="/terms">terms</Link>, <Link className="underline" href="/privacy">privacy notice</Link>, and risk acknowledgement before review.</p>
        </CardFooter>
      </Card>
    </form>
  );
}
