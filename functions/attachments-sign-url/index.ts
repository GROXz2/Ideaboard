import { AttachmentSignSchema } from "../_shared/schemas.ts";
import { AppError, errorResponse } from "../_shared/errors.ts";
import { getUser } from "../_shared/auth.ts";
import { createAttachment, signedUploadUrl } from "../_shared/db.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      throw new AppError("bad_request", "Method not allowed", 405);
    }
    const user = getUser(req);
    const body = await req.json();
    const input = AttachmentSignSchema.parse(body);

    const insert = await createAttachment({
      board_id: input.boardId,
      node_id: input.nodeId,
      mime: input.mime,
      type: input.type,
      uploader_user_id: user.userId,
    });
    const id = insert.data.id;
    const { data: urlData } = await signedUploadUrl(id);

    return new Response(
      JSON.stringify({ attachment: { id, url: urlData?.signedUrl } }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error(err);
    return errorResponse(new AppError("internal", "Internal error", 500));
  }
}

Deno.serve(handler);
