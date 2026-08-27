import { NextResponse } from "next/server";
import { publicRequestOrigin } from "@/lib/site-origin";
import { introductionGateMode } from "@/lib/introduction-gate-mode";
import { completeMockIntroductionGate } from "@/lib/mock-introduction-gate";
import { createStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CHECKOUT_CONFIG_VERSION = "v2-card-no-link";

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
      return NextResponse.json({ error: "Payment is not available for this introduction." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: introduction } = await admin
      .from("introductions")
      .select("payment_a_status, payment_b_status, checkout_session_a_id, checkout_session_b_id")
      .eq("match_id", match.id)
      .single();
    if (!introduction) return NextResponse.json({ error: "Payment is not available for this introduction." }, { status: 403 });

    const side = match.user_a === user.id ? "a" : "b";
    const status = side === "a" ? introduction.payment_a_status : introduction.payment_b_status;
    const storedSessionId = side === "a" ? introduction.checkout_session_a_id : introduction.checkout_session_b_id;
    if (status === "paid") return NextResponse.json({ error: "This introduction payment is already complete." }, { status: 409 });

    if (introductionGateMode() === "mock") {
      await completeMockIntroductionGate({ gate: "checkout", matchId: match.id, userId: user.id });
      return NextResponse.json({
        mode: "mock",
        url: `${publicRequestOrigin(request)}/portal?mock=payment-complete`,
      });
    }

    const stripe = createStripe();
    if (storedSessionId) {
      const stored = await stripe.checkout.sessions.retrieve(storedSessionId);
      if (stored.status === "open" && stored.url) return NextResponse.json({ url: stored.url });
      if (stored.payment_status === "paid") return NextResponse.json({ error: "Payment is complete and is being confirmed." }, { status: 409 });
    }

    const origin = publicRequestOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      wallet_options: { link: { display: "never" } },
      customer_email: user.email,
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 4900, product_data: { name: "MortgageMates introduction", description: "Identity-gated contact, alignment workbook, and professional handoff preparation." } } }],
      success_url: `${origin}/portal?payment=success`,
      cancel_url: `${origin}/portal?payment=cancelled`,
      client_reference_id: user.id,
      metadata: { user_id: user.id, match_id: match.id },
    }, { idempotencyKey: `mortgagemates:checkout:${CHECKOUT_CONFIG_VERSION}:${match.id}:${user.id}:${storedSessionId ? `after-${storedSessionId}` : "initial"}` });
    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");

    const { error: updateError } = await admin.rpc("register_stripe_gate_attempt", {
      p_match_id: match.id,
      p_user_id: user.id,
      p_gate: "checkout",
      p_session_id: session.id,
    });
    if (updateError) throw new Error(`Could not persist Checkout session: ${updateError.message}`);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout unavailable:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Payment is not available yet. Please try again later." }, { status: 503 });
  }
}
