import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safePortalRedirect } from "@/lib/redirects";
import { publicRequestOrigin, publicSiteOrigin } from "@/lib/site-origin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredOrigin = publicSiteOrigin();
  let origin: string;
  try {
    origin = publicRequestOrigin(request);
  } catch {
    return NextResponse.redirect(new URL("/login?error=origin", configuredOrigin));
  }
  const code = requestUrl.searchParams.get("code");
  const next = safePortalRedirect(requestUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
