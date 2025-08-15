import { supabaseAdmin } from "./db.ts";

export interface RagResult {
  content: string;
  score: number;
  source: string;
}

export async function searchPolicies(
  query: string,
  topK: number,
): Promise<RagResult[]> {
  try {
    const { data } = await supabaseAdmin.rpc("search_policy", {
      query,
      top_k: topK,
    });
    return data ?? [];
  } catch (_e) {
    return [];
  }
}

export async function searchKnowledge(
  query: string,
  topK: number,
): Promise<RagResult[]> {
  try {
    const { data } = await supabaseAdmin.rpc("search_docs", {
      query,
      top_k: topK,
    });
    return data ?? [];
  } catch (_e) {
    return [];
  }
}
