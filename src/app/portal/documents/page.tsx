import { redirect } from "next/navigation";
import { DocumentVault, type BuyerDocument, type Requirement } from "@/components/documents/document-vault";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Document vault" };

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: requirements }, { data: documents }, { data: matches }, { data: shares }] = await Promise.all([
    supabase.from("document_requirements").select("id, label, description, category, required, applies_when, validity_days").eq("active", true).order("sort_order"),
    supabase.from("buyer_documents").select("id, requirement_id, storage_path, original_filename, status, expiry_date, review_note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("matches").select("id").in("status", ["proposed", "mutual_interest", "unlocked"]).limit(1),
    supabase.from("document_shares").select("id, recipient_type, provider_name, document_ids, status, consented_at, revoked_at").order("consented_at", { ascending: false }),
  ]);
  const matchId = matches?.[0]?.id;
  const { data: readiness } = matchId ? await supabase.rpc("get_match_document_readiness", { p_match_id: matchId }) : { data: [] };
  return <DocumentVault userId={user.id} requirements={(requirements ?? []) as Requirement[]} initialDocuments={(documents ?? []) as BuyerDocument[]} initialShares={shares ?? []} pairReadiness={(readiness ?? []) as never[]} />;
}
