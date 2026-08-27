import { redirect } from "next/navigation";
import { ContactSettings } from "@/components/portal/contact-settings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contact settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: contact } = await supabase.from("contact_preferences").select("email, phone, preferred_channel").eq("user_id", user.id).single();
  if (!contact) redirect("/portal");
  return <ContactSettings initial={contact} />;
}
