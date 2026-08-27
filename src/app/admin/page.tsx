import { notFound, redirect } from "next/navigation";
import { MatchWorkspace } from "@/components/admin/match-workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Match workspace" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") notFound();
  const [{ data: members }, { data: matches }, { data: documents }, { data: reports }, { data: shares }] = await Promise.all([
    supabase.from("profiles").select("id, first_name, age_band, onboarding_status, onboarding_review_note, matching_status, buyer_preferences(target_locations, borrowing_range, deposit_range, purchase_timeline, property_types, ownership_expectations)").eq("role", "buyer").order("updated_at", { ascending: false }),
    supabase.from("matches").select("status"),
    supabase.from("buyer_documents").select("id, user_id, requirement_id, storage_path, original_filename, status, expiry_date, review_note, created_at").order("created_at", { ascending: true }),
    supabase.from("reports").select("id, reporter_id, reported_user_id, match_id, reason, status, created_at, resolution_note").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }),
    supabase.from("document_shares").select("id, user_id, recipient_type, provider_name, document_ids, status, consented_at").eq("status", "requested").order("consented_at", { ascending: true }),
  ]);
  const metrics = { ready: (members ?? []).filter((member) => member.matching_status === "ready").length, review: (members ?? []).filter((member) => member.onboarding_status === "ready_for_review").length, proposals: (matches ?? []).filter((match) => match.status === "proposed").length, mutual: (matches ?? []).filter((match) => match.status === "mutual_interest").length };
  return <MatchWorkspace members={(members ?? []) as never[]} documents={documents ?? []} reports={reports ?? []} shares={shares ?? []} metrics={metrics} />;
}
