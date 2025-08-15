// deno-lint-ignore-file no-explicit-any require-await
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handler } from "../functions/ai-run/index.ts";
import * as db from "../functions/_shared/db.ts";
import { makeJwt, mockFetch } from "./helpers.ts";

Deno.env.set("DEFAULT_MODEL", "gpt-4o-mini");
Deno.env.set("OPENAI_API_BASE", "https://api.fake.com/v1");
Deno.env.set("OPENAI_API_KEY", "test");

Deno.test("ai-run success", async () => {
  mockFetch({
    choices: [{ message: { content: "hi" } }],
    usage: { prompt_tokens: 1, completion_tokens: 2 },
  });
  (db as any).getThread = async () => ({
    data: { board_id: "b", node_id: null },
  });
  (db as any).insertAiMessage = async (m: any) => ({
    data: { id: "msg1", ...m },
  });
  (db as any).insertAiRun = async () => ({});

  const token = makeJwt({ sub: "user1" });
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ threadId: crypto.randomUUID(), input: "hello" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.output.text, "hi");
});

Deno.test("ai-run unauthorized", async () => {
  const req = new Request("http://localhost", { method: "POST" });
  const res = await handler(req);
  assertEquals(res.status, 401);
});
