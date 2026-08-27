"use client";

import { useState } from "react";
import { MailIcon, PhoneIcon, SaveIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type Contact = { email: string | null; phone: string | null; preferred_channel: string };

export function ContactSettings({ initial }: { initial: Contact }) {
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [preferred, setPreferred] = useState(initial.preferred_channel);
  const [pending, setPending] = useState(false);
  const channels = [{ value: "email", label: "Email" }, { value: "phone", label: "Phone" }];

  async function save() {
    setPending(true);
    const { error } = await createClient().rpc("update_contact_preferences", { p_email: email, p_phone: phone, p_preferred_channel: preferred });
    setPending(false);
    if (error) toast.error(error.message);
    else toast.success("Contact preferences saved.");
  }

  return <main className="content-grid py-8"><div className="mx-auto flex max-w-2xl flex-col gap-6"><div><p className="eyebrow">Member settings</p><h1 className="text-5xl font-medium text-primary">Contact details</h1><p className="mt-2 text-muted-foreground">These details remain private until both members complete every introduction gate.</p></div><Alert><ShieldCheckIcon /><AlertTitle>Locked by default</AlertTitle><AlertDescription>Your co-buyer sees these details only after mutual opt-in, two identity verifications, and two completed payments.</AlertDescription></Alert><Card><CardHeader><CardTitle>How your match can reach you</CardTitle><CardDescription>Use details you check regularly. Updates are recorded in the audit trail.</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="contact-email"><MailIcon className="size-4" />Email</FieldLabel><Input id="contact-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field><FieldLabel htmlFor="contact-phone"><PhoneIcon className="size-4" />Phone</FieldLabel><Input id="contact-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional unless phone is preferred" /></Field><Field><FieldLabel htmlFor="preferred-channel">Preferred channel</FieldLabel><Select items={channels} value={preferred} onValueChange={(value) => setPreferred(String(value))}><SelectTrigger id="preferred-channel" className="w-full"><SelectValue>{channels.find((item) => item.value === preferred)?.label}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{channels.map((channel) => <SelectItem key={channel.value} value={channel.value}>{channel.label}</SelectItem>)}</SelectGroup></SelectContent></Select><FieldDescription>Phone requires a phone number; email is always required for pilot notices.</FieldDescription></Field></FieldGroup></CardContent><CardFooter><Button disabled={pending || !email.trim()} onClick={save}>{pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}Save contact details</Button></CardFooter></Card></div></main>;
}
