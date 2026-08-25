import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ inverse = false, compact = false, className }: { inverse?: boolean; compact?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="MortgageMates home" className={cn("inline-flex items-center gap-3", className)}>
      <svg viewBox="0 0 58 38" aria-hidden="true" className="h-9 w-14 shrink-0">
        <path d="M2 20 16.5 5.5 29 18 41.5 5.5 56 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 15.5V35h17V20.5M33 20.5V35h17V15.5M25 35V24h8v11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-heading text-[1.35rem] font-medium tracking-tight", inverse ? "text-sidebar-foreground" : "text-primary")}>MortgageMates</span>
          <span className={cn("mt-1 text-[0.58rem] font-semibold tracking-[0.18em] uppercase", inverse ? "text-sidebar-foreground/70" : "text-muted-foreground")}>Co-buying, Ireland</span>
        </span>
      )}
    </Link>
  );
}
