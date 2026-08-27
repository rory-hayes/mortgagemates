import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { introductionGateMode } from "@/lib/introduction-gate-mode";
import { normalizePublicSiteOrigin } from "@/lib/public-origin";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], display: "swap" });
const isMockGateDeployment = introductionGateMode() === "mock";

export const metadata: Metadata = {
  metadataBase: new URL(normalizePublicSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL)),
  title: { default: "MortgageMates — A careful path to co-buying", template: "%s · MortgageMates" },
  description: "Meet one financially aligned co-buyer, prepare your documents, and move forward with independent professionals.",
  robots: isMockGateDeployment ? { index: false, follow: false } : { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE">
      <body className={`${manrope.variable} ${newsreader.variable} font-sans`}>
        {isMockGateDeployment ? <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950">MVP demo — identity and €49 payment steps are simulated. No verification occurs and no money is charged.</div> : null}
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
