import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your profile" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("first_name, age_band, occupation_sector, onboarding_step, onboarding_status, onboarding_review_note").eq("id", user.id).single(),
    supabase.from("buyer_preferences").select("*").eq("user_id", user.id).single(),
  ]);
  if (!profile || !preferences) redirect("/login");
  return <OnboardingWizard userId={user.id} initial={{ profile, preferences }} />;
}
