import { NextResponse } from "next/server";
import { publicRequestOrigin } from "@/lib/site-origin";
import { createStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { matchId } = await request.json() as { matchId?: string };
    if (!matchId) return NextResponse.json({ error: "Match required." }, { status: 400 });

    const [{ data: match }, { data: participantsReady }] = await Promise.all([
      supabase.from("matches").select("id, status, user_a, user_b").eq("id", matchId).single(),
      supabase.rpc("match_participants_are_ready", { p_match_id: matchId }),
    ]);
    if (!match || ![match.user_a, match.user_b].includes(user.id) || match.status !== "mutual_interest" || participantsReady !== true) {
      return NextResponse.json({ error: "Verification is not available for this introduction." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: introduction } = await admin
      .from("introductions")
      .select("identity_a_status, identity_b_status, identity_session_a_id, identity_session_b_id")
      .eq("match_id", match.id)
      .single();
    if (!introduction) return NextResponse.json({ error: "Verification is not available for this introduction." }, { status: 403 });

    const side = match.user_a === user.id ? "a" : "b";
    const status = side === "a" ? introduction.identity_a_status : introduction.identity_b_status;
    const storedSessionId = side === "a" ? introduction.identity_session_a_id : introduction.identity_session_b_id;
    if (status === "verified") return NextResponse.json({ error: "Identity verification is already complete." }, { status: 409 });

    const stripe = createStripe();
    if (storedSessionId) {
      const stored = await stripe.identity.verificationSessions.retrieve(storedSessionId);
      if (["requires_input", "processing"].includes(stored.status) && stored.url) return NextResponse.json({ url: stored.url });
      if (stored.status === "verified") return NextResponse.json({ error: "Verification is complete and is being confirmed." }, { status: 409 });
    }

    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      return_url: `${publicRequestOrigin(request)}/portal?identity=returned`,
      metadata: { user_id: user.id, match_id: match.id },
    }, { idempotencyKey: `mortgagemates:identity:${match.id}:${user.id}:${storedSessionId ? `after-${storedSessionId}` : "initial"}` });
    if (!session.url) throw new Error("Stripe did not return a verification URL.");

    const { error: updateError } = await admin.rpc("register_stripe_gate_attempt", {
      p_match_id: match.id,
      p_user_id: user.id,
      p_gate: "identity",
      p_session_id: session.id,
    });
    if (updateError) throw new Error(`Could not persist verification session: ${updateError.message}`);
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Identity verification is not available yet. Please try again later." }, { status: 503 });
  }
}
