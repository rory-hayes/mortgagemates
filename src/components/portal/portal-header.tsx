"use client";

import Link from "next/link";
import { FileCheck2Icon, LayoutDashboardIcon, MenuIcon, NotebookTabsIcon, SettingsIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const portalLinks = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/portal/onboarding", label: "Profile", icon: UserRoundIcon },
  { href: "/portal/documents", label: "Documents", icon: FileCheck2Icon },
  { href: "/portal/alignment", label: "Alignment", icon: NotebookTabsIcon },
  { href: "/portal/settings", label: "Settings", icon: SettingsIcon },
  { href: "/#safety", label: "Safety", icon: ShieldCheckIcon },
] as const;

export function PortalHeader({ firstName = "Member", preview = false }: { firstName?: string; preview?: boolean }) {
  const prefix = preview ? "/preview?view=" : "";
  const visibleLinks = preview ? portalLinks.filter((item) => ["Dashboard", "Documents", "Alignment"].includes(item.label)) : portalLinks.slice(0, 5);
  return (
    <header className="border-b bg-card">
      <div className="content-grid flex h-20 items-center justify-between gap-6">
        <BrandMark />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Member navigation">
          {visibleLinks.map((item) => <Link key={item.href} href={preview ? `${prefix}${item.label.toLowerCase()}` : item.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}><item.icon data-icon="inline-start" />{item.label}</Link>)}
        </nav>
        <div className="flex items-center gap-3">
          {preview ? <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}>Create real profile</Link> : null}
          <Avatar><AvatarFallback>{firstName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" aria-label="Open member navigation" />}><MenuIcon /></SheetTrigger>
            <SheetContent side="right"><SheetHeader><SheetTitle>Member portal</SheetTitle><SheetDescription>Profile, documents, matching, and preparation.</SheetDescription></SheetHeader><nav className="flex flex-col gap-2 px-4">{visibleLinks.map((item) => <Link key={item.href} href={preview ? `${prefix}${item.label.toLowerCase()}` : item.href} className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}><item.icon data-icon="inline-start" />{item.label}</Link>)}{preview ? <Link href="/#safety" className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}><ShieldCheckIcon data-icon="inline-start" />Safety</Link> : null}</nav></SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
