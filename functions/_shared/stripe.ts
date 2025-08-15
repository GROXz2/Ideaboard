import Stripe from "https://esm.sh/stripe@12?target=deno";

const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const stripe = new Stripe(secret, { apiVersion: "2022-11-15" });

export function constructEvent(body: string, signature: string) {
  return stripe.webhooks.constructEvent(body, signature, secret);
}
