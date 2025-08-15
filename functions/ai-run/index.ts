import { AiRunSchema } from "../_shared/schemas.ts";
import { AppError, errorResponse } from "../_shared/errors.ts";
import { getUser } from "../_shared/auth.ts";
import { getThread, insertAiMessage, insertAiRun } from "../_shared/db.ts";
import { calcCost } from "../_shared/cost.ts";
import { searchKnowledge, searchPolicies } from "../_shared/rag.ts";

const DEFAULT_MODEL = Deno.env.get("DEFAULT_MODEL") ?? "gpt-4o-mini";
const MAX_TOKENS_PER_RUN = Number(Deno.env.get("MAX_TOKENS_PER_RUN") ?? "4000");
const RAG_TOPK = Number(Deno.env.get("RAG_TOPK") ?? "5");
const OPENAI_API_BASE = Deno.env.get("OPENAI_API_BASE")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const rateMap = new Map<string, number[]>();
const WINDOW = 10 * 60 * 1000;
const LIMIT = 60;

export async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      throw new AppError("bad_request", "Method not allowed", 405);
    }
    const user = getUser(req);

    // rate limit
    const now = Date.now();
    const timestamps = rateMap.get(user.userId) ?? [];
    const recent = timestamps.filter((t) => now - t < WINDOW);
    if (recent.length >= LIMIT) {
      throw new AppError("rate_limited", "Too many requests", 429);
    }
    recent.push(now);
    rateMap.set(user.userId, recent);

    const body = await req.json();
    const input = AiRunSchema.parse(body);

    const threadRes = await getThread(input.threadId);
    if (!threadRes.data) {
      throw new AppError("not_found", "Thread not found", 404);
    }

    const topK = input.rag?.topK ?? RAG_TOPK;
    let context = "";
    if (input.rag?.usePolicies) {
      const policies = await searchPolicies(input.input, topK);
      context += policies.map((p) => p.content).join("\n");
    }
    if (input.rag?.useKnowledge) {
      const knowledge = await searchKnowledge(input.input, topK);
      context += knowledge.map((p) => p.content).join("\n");
    }

    const model = input.model ?? DEFAULT_MODEL;
    const messages = [
      context ? { role: "system", content: context } : null,
      { role: "user", content: input.input },
    ].filter(Boolean);

    const start = performance.now();
    const resp = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: input.temperature ?? 0,
        max_tokens: MAX_TOKENS_PER_RUN,
      }),
    });
    if (!resp.ok) throw new AppError("internal", "LLM provider error", 500);
    const data = await resp.json();
    const outputText = data.choices?.[0]?.message?.content ?? "";
    const tokensIn = data.usage?.prompt_tokens ?? 0;
    const tokensOut = data.usage?.completion_tokens ?? 0;
    const latency = Math.round(performance.now() - start);
    const cost = calcCost(model, tokensIn, tokensOut);

    const messageInsert = await insertAiMessage({
      thread_id: input.threadId,
      role: "assistant",
      content: outputText,
      model,
      temperature: input.temperature ?? 0,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      usd_cost: cost,
      latency_ms: latency,
      status: "succeeded",
    });
    const messageId = messageInsert.data?.id;

    await insertAiRun({
      thread_id: input.threadId,
      board_id: threadRes.data.board_id,
      node_id: threadRes.data.node_id,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      usd_cost: cost,
      model,
      created_by: user.userId,
    });

    return new Response(
      JSON.stringify({
        messageId,
        output: { text: outputText },
        usage: { tokens_in: tokensIn, tokens_out: tokensOut, usd_cost: cost },
        latency_ms: latency,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error(err);
    return errorResponse(new AppError("internal", "Internal error", 500));
  }
}

Deno.serve(handler);
