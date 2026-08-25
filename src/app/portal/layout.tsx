import { redirect } from "next/navigation";
import { PortalHeader } from "@/components/portal/portal-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();

  return <div className="min-h-screen"><PortalHeader firstName={profile?.first_name ?? "Member"} /><div className="content-grid flex justify-end pt-3"><SignOutButton /></div>{children}</div>;
}
