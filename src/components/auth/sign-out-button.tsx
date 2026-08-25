"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  return <Button variant="ghost" size="sm" onClick={async () => { await createClient().auth.signOut(); router.replace("/"); router.refresh(); }}><LogOutIcon data-icon="inline-start" />Log out</Button>;
}
