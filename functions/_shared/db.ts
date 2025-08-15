import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helpers wrapped for easy mocking in tests
export async function getThread(threadId: string) {
  return await supabaseAdmin
    .from("ai_thread")
    .select("id, board_id, node_id, org_id")
    .eq("id", threadId)
    .maybeSingle();
}

export async function insertAiMessage(message: Record<string, unknown>) {
  return await supabaseAdmin.from("ai_message").insert(message).select()
    .single();
}

export async function insertAiRun(run: Record<string, unknown>) {
  return await supabaseAdmin.from("ai_run").insert(run);
}

export async function createAttachment(att: Record<string, unknown>) {
  return await supabaseAdmin.from("attachment").insert(att).select().single();
}

export async function signedUploadUrl(path: string) {
  return await supabaseAdmin.storage.from("attachments").createSignedUploadUrl(
    path,
    60,
  );
}

export async function updatePurchase(id: string, status: string) {
  return await supabaseAdmin.from("purchase").update({ status }).eq("id", id);
}
