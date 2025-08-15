// deno-lint-ignore-file no-explicit-any require-await
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handler } from "../functions/attachments-sign-url/index.ts";
import * as db from "../functions/_shared/db.ts";
import { makeJwt } from "./helpers.ts";

Deno.test("attachments sign-url success", async () => {
  (db as any).createAttachment = async () => ({ data: { id: "att1" } });
  (db as any).signedUploadUrl = async () => ({
    data: { signedUrl: "https://upload" },
  });

  const token = makeJwt({ sub: "user1" });
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      boardId: crypto.randomUUID(),
      mime: "image/png",
      type: "image",
    }),
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.attachment.url, "https://upload");
});
