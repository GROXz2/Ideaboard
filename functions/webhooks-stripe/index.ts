import { AppError, errorResponse } from "../_shared/errors.ts";
import { constructEvent } from "../_shared/stripe.ts";
import { updatePurchase } from "../_shared/db.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      throw new AppError("bad_request", "Method not allowed", 405);
    }
    const sig = req.headers.get("stripe-signature") ?? "";
    const body = await req.text();
    let event;
    try {
      event = constructEvent(body, sig);
    } catch (_e) {
      throw new AppError("unauthorized", "Invalid signature", 401);
    }

    const type = event.type;
    const obj = event.data.object as { metadata?: Record<string, string> };
    const purchaseId = obj?.metadata?.purchase_id;
    if (purchaseId) {
      if (
        type === "checkout.session.completed" ||
        type === "payment_intent.succeeded"
      ) {
        await updatePurchase(purchaseId, "paid");
      }
      if (type.startsWith("charge.refunded") || type.startsWith("refund")) {
        await updatePurchase(purchaseId, "refunded");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error(err);
    return errorResponse(new AppError("internal", "Internal error", 500));
  }
}

Deno.serve(handler);
