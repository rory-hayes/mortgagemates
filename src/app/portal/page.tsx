import { redirect } from "next/navigation";
import { MemberDashboard } from "@/components/portal/member-dashboard";
import { createClient } from "@/lib/supabase/server";
import { calculateReadiness } from "@/lib/readiness";

export const metadata = { title: "Dashboard" };

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.rpc("expire_stale_matches");
  const [{ data: profile }, { data: requirements }, { data: documents }, { data: matches }] = await Promise.all([
    supabase.from("profiles").select("id, first_name, onboarding_status, onboarding_review_note, onboarding_step, matching_status").eq("id", user.id).single(),
    supabase.from("document_requirements").select("id").eq("required", true).eq("active", true),
    supabase.from("buyer_documents").select("id, status, requirement_id, expiry_date, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("matches").select("id, status, compatibility, user_a, user_b, expires_at").in("status", ["proposed", "mutual_interest", "unlocked"]).order("proposed_at", { ascending: false }).limit(1),
  ]);
  if (!profile) redirect("/login");
  const match = matches?.[0] ?? null;
  const [{ data: existingDecision }, { data: introduction }, { data: unlockedContact }] = match ? await Promise.all([
    supabase.from("match_decisions").select("decision").eq("match_id", match.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("introductions").select("status, identity_a_status, identity_b_status, payment_a_status, payment_b_status").eq("match_id", match.id).maybeSingle(),
    match.status === "unlocked" ? supabase.rpc("get_unlocked_contact", { p_match_id: match.id }) : Promise.resolve({ data: null }),
  ]) : [{ data: null }, { data: null }, { data: null }];
  const readiness = calculateReadiness((requirements ?? []).map((item) => item.id), documents ?? []);
  const side = match?.user_a === user.id ? "a" : "b";
  const gates = introduction ? { identity: side === "a" ? introduction.identity_a_status : introduction.identity_b_status, payment: side === "a" ? introduction.payment_a_status : introduction.payment_b_status } : null;
  const contact = Array.isArray(unlockedContact) ? unlockedContact[0] ?? null : null;
  return <MemberDashboard profile={profile} documentStats={readiness} match={match as { id: string; status: string; compatibility: Record<string, unknown>; user_a: string; user_b: string; expires_at: string } | null} decision={existingDecision?.decision ?? null} gates={gates} contact={contact} />;
}
