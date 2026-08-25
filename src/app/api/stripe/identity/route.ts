import { NextResponse } from "next/server";
import { createStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { matchId } = await request.json() as { matchId?: string };
    if (!matchId) return NextResponse.json({ error: "Match required." }, { status: 400 });
    const { data: match } = await supabase.from("matches").select("id, status, user_a, user_b").eq("id", matchId).single();
    if (!match || ![match.user_a, match.user_b].includes(user.id) || match.status !== "mutual_interest") return NextResponse.json({ error: "Verification is not available for this introduction." }, { status: 403 });
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const session = await createStripe().identity.verificationSessions.create({ type: "document", return_url: `${origin}/portal?identity=returned`, metadata: { user_id: user.id, match_id: match.id } });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Identity verification is not available yet. Please try again later." }, { status: 503 });
  }
}
