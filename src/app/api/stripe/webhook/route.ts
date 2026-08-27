import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const supportedEvents = new Set(["checkout.session.completed", "identity.verification_session.verified"]);

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = createStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  if (!supportedEvents.has(event.type)) return NextResponse.json({ received: true, ignored: true });

  try {
    const object = event.data.object as Stripe.Checkout.Session | Stripe.Identity.VerificationSession;
    const matchId = object.metadata?.match_id;
    const userId = object.metadata?.user_id;
    if (!matchId || !userId) throw new Error("Stripe metadata is incomplete.");
    if (event.type === "checkout.session.completed" && (object as Stripe.Checkout.Session).payment_status !== "paid") {
      throw new Error("Checkout completed without a paid status.");
    }

    const { error } = await createAdminClient().rpc("apply_stripe_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_object_id: object.id,
      p_match_id: matchId,
      p_user_id: userId,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed and will be retried." }, { status: 500 });
  }
}
