export function makeJwt(payload: Record<string, unknown>): string {
  const base64 = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=+$/, "");
  return `${base64({ alg: "none", typ: "JWT" })}.${base64(payload)}.`;
}

export function mockFetch(response: unknown, ok = true) {
  globalThis.fetch = (_: RequestInfo, __?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify(response), {
        status: ok ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
}
