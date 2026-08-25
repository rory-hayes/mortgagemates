import { NextResponse } from "next/server";
import { createStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  try {
    const event = createStripe().webhooks.constructEvent(await request.text(), signature, secret);
    const object = event.data.object as { metadata?: Record<string, string> };
    const matchId = object.metadata?.match_id;
    const userId = object.metadata?.user_id;
    if (matchId && userId && ["checkout.session.completed", "identity.verification_session.verified"].includes(event.type)) {
      const admin = createAdminClient();
      const { data: match } = await admin.from("matches").select("user_a, user_b").eq("id", matchId).single();
      if (match && [match.user_a, match.user_b].includes(userId)) {
        const side = match.user_a === userId ? "a" : "b";
        if (event.type === "checkout.session.completed") await admin.from("introductions").update({ [`payment_${side}_status`]: "paid" }).eq("match_id", matchId);
        if (event.type === "identity.verification_session.verified") {
          await Promise.all([admin.from("introductions").update({ [`identity_${side}_status`]: "verified" }).eq("match_id", matchId), admin.from("profiles").update({ identity_status: "verified" }).eq("id", userId)]);
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }
}
