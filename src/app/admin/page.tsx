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
  const [{ data: members }, { data: matches }] = await Promise.all([
    supabase.from("profiles").select("id, first_name, age_band, onboarding_status, matching_status, buyer_preferences(target_locations, borrowing_range, deposit_range, purchase_timeline, property_types, ownership_expectations)").in("onboarding_status", ["ready_for_review", "under_review", "approved"]).order("updated_at", { ascending: false }),
    supabase.from("matches").select("status"),
  ]);
  const metrics = { ready: (members ?? []).filter((member) => member.matching_status === "ready").length, review: (members ?? []).filter((member) => member.onboarding_status === "ready_for_review").length, proposals: (matches ?? []).filter((match) => match.status === "proposed").length, mutual: (matches ?? []).filter((match) => match.status === "mutual_interest").length };
  return <MatchWorkspace members={(members ?? []) as never[]} metrics={metrics} />;
}
