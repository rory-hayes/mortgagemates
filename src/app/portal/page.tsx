import { redirect } from "next/navigation";
import { MemberDashboard } from "@/components/portal/member-dashboard";
import { createClient } from "@/lib/supabase/server";
import { calculateReadiness } from "@/lib/readiness";

export const metadata = { title: "Dashboard" };

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: requirements }, { data: documents }, { data: matches }] = await Promise.all([
    supabase.from("profiles").select("id, first_name, onboarding_status, onboarding_step, matching_status").eq("id", user.id).single(),
    supabase.from("document_requirements").select("id").eq("required", true).eq("active", true),
    supabase.from("buyer_documents").select("id, status, requirement_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("matches").select("id, status, compatibility").in("status", ["proposed", "mutual_interest", "unlocked"]).order("proposed_at", { ascending: false }).limit(1),
  ]);
  if (!profile) redirect("/login");
  const match = matches?.[0] ?? null;
  const { data: existingDecision } = match ? await supabase.from("match_decisions").select("decision").eq("match_id", match.id).eq("user_id", user.id).maybeSingle() : { data: null };
  const readiness = calculateReadiness((requirements ?? []).map((item) => item.id), documents ?? []);
  return <MemberDashboard profile={profile} documentStats={readiness} match={match as { id: string; status: string; compatibility: Record<string, unknown> } | null} decision={existingDecision?.decision ?? null} />;
}
