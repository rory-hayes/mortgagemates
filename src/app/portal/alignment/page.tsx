import Link from "next/link";
import { redirect } from "next/navigation";
import { NotebookTabsIcon } from "lucide-react";
import { AlignmentWorkbook } from "@/components/alignment/alignment-workbook";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Alignment workbook" };

export default async function AlignmentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: matches } = await supabase.from("matches").select("id, status").in("status", ["mutual_interest", "unlocked"]).order("proposed_at", { ascending: false }).limit(1);
  const match = matches?.[0];
  if (!match) return <main className="content-grid py-12"><Empty className="border bg-card"><EmptyHeader><EmptyMedia variant="icon"><NotebookTabsIcon /></EmptyMedia><EmptyTitle>The workbook opens after mutual interest</EmptyTitle><EmptyDescription>Both people need to opt in before the private alignment questions become available.</EmptyDescription></EmptyHeader><EmptyContent><Link href="/portal" className={cn(buttonVariants())}>Back to dashboard</Link></EmptyContent></Empty></main>;
  const { data: responses } = await supabase.from("alignment_responses").select("module, question_id, response, share_with_match").eq("match_id", match.id).eq("user_id", user.id);
  return <AlignmentWorkbook matchId={match.id} userId={user.id} initialResponses={(responses ?? []) as never[]} />;
}
