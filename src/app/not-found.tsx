import Link from "next/link";
import { HomeIcon } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return <main className="content-grid flex min-h-screen flex-col items-center justify-center gap-8 py-12 text-center"><BrandMark /><div><p className="eyebrow">Page not found</p><h1 className="mt-3 text-5xl font-medium text-primary">This door does not open.</h1><p className="mx-auto mt-4 max-w-md text-muted-foreground">The page may have moved, or the link may no longer be active.</p></div><Link href="/" className={cn(buttonVariants({ size: "lg" }))}><HomeIcon data-icon="inline-start" />Return home</Link></main>;
}
