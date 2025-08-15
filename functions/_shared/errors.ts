export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "internal";

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function errorResponse(err: AppError): Response {
  return new Response(
    JSON.stringify({ error: { code: err.code, message: err.message } }),
    {
      status: err.status,
      headers: { "Content-Type": "application/json" },
    },
  );
}
