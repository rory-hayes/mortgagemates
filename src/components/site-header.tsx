import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [["How it works", "/#how-it-works"], ["Document ready", "/#documents"], ["Safety", "/#safety"], ["For professionals", "/#professionals"]] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="content-grid flex h-20 items-center justify-between gap-6">
        <BrandMark />
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-semibold text-foreground/78 transition-colors hover:text-primary">{label}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>Log in</Link>
          <Link href="/eligibility" className={cn(buttonVariants({ size: "lg" }))}>Check my eligibility</Link>
        </div>
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="icon" className="sm:hidden" aria-label="Open navigation" />}><MenuIcon /></SheetTrigger>
          <SheetContent side="right">
            <SheetHeader><SheetTitle>MortgageMates</SheetTitle><SheetDescription>A careful path to co-buying.</SheetDescription></SheetHeader>
            <nav className="flex flex-col gap-2 px-4" aria-label="Mobile navigation">
              {links.map(([label, href]) => <Link key={href} href={href} className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}>{label}</Link>)}
              <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Log in</Link>
              <Link href="/eligibility" className={cn(buttonVariants())}>Check my eligibility</Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
