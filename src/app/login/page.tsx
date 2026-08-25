import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { LoginForm } from "@/components/auth/login-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="content-grid grid min-h-screen gap-12 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
      <section className="flex max-w-lg flex-col items-start gap-8"><BrandMark /><div className="flex flex-col gap-4"><p className="eyebrow">Secure member access</p><h1 className="text-6xl leading-none font-medium text-primary">Prepared before you’re introduced.</h1><p className="text-lg leading-8 text-muted-foreground">Build your profile and private document pack at your own pace. Nothing is shown to another buyer without the matching and consent gates.</p></div><div className="flex gap-3 text-sm"><ShieldCheckIcon className="size-5 text-primary" /><p>Supabase authentication, private row-level access, and a non-public document bucket.</p></div><Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}><ArrowLeftIcon data-icon="inline-start" />Back to home</Link></section>
      <section className="mx-auto w-full max-w-xl"><LoginForm /><p className="mt-5 text-center text-sm text-muted-foreground">Want to look around first? <Link href="/preview" className="font-semibold text-primary underline underline-offset-4">Open the sample portal</Link></p></section>
    </main>
  );
}
