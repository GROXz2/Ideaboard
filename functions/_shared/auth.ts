import { AppError } from "./errors.ts";

export interface AuthUser {
  userId: string;
  orgId?: string;
}

function parseJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (_e) {
    throw new AppError("unauthorized", "Invalid JWT", 401);
  }
}

export function getUser(req: Request): AuthUser {
  const auth = req.headers.get("authorization");
  if (!auth) throw new AppError("unauthorized", "Missing token", 401);
  const [, token] = auth.split(" ");
  const payload = parseJwt(token);
  return { userId: payload.sub as string, orgId: payload.org_id as string | undefined };
}

export function assertMembership(_orgId?: string): void {
  // Placeholder for RLS / org membership checks
}
