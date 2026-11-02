export class ApiError extends Error {
  status: number;
  headers?: Record<string, string>;

  constructor(status: number, message: string, headers?: Record<string, string>) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

const LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (!origin) throw new ApiError(403, "A same-site request origin is required.");

  const allowed = new Set<string>();
  for (const value of [
    process.env.VITE_SITE_URL,
    process.env.VAREQ_ALLOWED_ORIGINS,
    process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : undefined,
  ]) {
    if (!value) continue;
    for (const item of value.split(",")) {
      const trimmed = item.trim().replace(/\/+$/, "");
      if (trimmed) allowed.add(trimmed);
    }
  }
  if (process.env.VERCEL_ENV !== "production") {
    for (const local of LOCAL_ORIGINS) allowed.add(local);
  }
  if (!allowed.has(origin.replace(/\/+$/, ""))) {
    throw new ApiError(403, "This site origin is not allowed.");
  }
  return origin;
}

export function jsonResponse(
  _request: Request,
  origin: string | undefined,
  payload: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("access-control-allow-headers", "authorization, content-type, x-privy-identity-token");
    headers.set("access-control-max-age", "600");
  }
  for (const [key, value] of Object.entries(extraHeaders ?? {})) headers.set(key, value);
  return new Response(JSON.stringify(payload), { status, headers });
}

export function errorResponse(request: Request, origin: string | undefined, error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(request, origin, { error: error.message }, error.status, error.headers);
  }
  if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
    return jsonResponse(request, origin, { error: "The request did not match the supported schema." }, 400);
  }
  return jsonResponse(request, origin, { error: "The request could not be completed. Try again shortly." }, 503);
}

export function handleOptions(request: Request): Response {
  const origin = getAllowedOrigin(request);
  return jsonResponse(request, origin, null, 204);
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Send this request as application/json.");
  }
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > maxBytes) throw new ApiError(413, "The request is too large.");

  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "The request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ApiError(400, "The request body is not valid JSON.");
  }
}

export function methodNotAllowed(request: Request, origin?: string): Response {
  return jsonResponse(request, origin, { error: "This method is not supported." }, 405, { allow: "GET, POST, OPTIONS" });
}
