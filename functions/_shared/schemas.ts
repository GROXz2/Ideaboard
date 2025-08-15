import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const AiRunSchema = z.object({
  threadId: z.string().uuid(),
  input: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  attachments: z.array(z.object({ id: z.string().uuid() })).optional(),
  rag: z.object({
    topK: z.number().min(1).optional(),
    usePolicies: z.boolean().optional(),
    useKnowledge: z.boolean().optional(),
  }).optional(),
});

export const AttachmentSignSchema = z.object({
  boardId: z.string().uuid(),
  nodeId: z.string().uuid().optional(),
  mime: z.string().min(1),
  type: z.enum(["audio", "image", "doc"]),
});

export type AiRunInput = z.infer<typeof AiRunSchema>;
export type AttachmentSignInput = z.infer<typeof AttachmentSignSchema>;
