// deno-lint-ignore-file no-explicit-any require-await
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handler } from "../functions/webhooks-stripe/index.ts";
import * as stripe from "../functions/_shared/stripe.ts";
import * as db from "../functions/_shared/db.ts";

Deno.test("webhook paid", async () => {
  (stripe as any).constructEvent = () => ({
    type: "checkout.session.completed",
    data: { object: { metadata: { purchase_id: "p1" } } },
  });
  let updated: any = null;
  (db as any).updatePurchase = async (id: string, status: string) => {
    updated = { id, status };
  };

  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: JSON.stringify({}),
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  assertEquals(updated, { id: "p1", status: "paid" });
});
