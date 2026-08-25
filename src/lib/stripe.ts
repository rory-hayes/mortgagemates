import "server-only";

import Stripe from "stripe";

export function createStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured for this deployment.");
  return new Stripe(key);
}
