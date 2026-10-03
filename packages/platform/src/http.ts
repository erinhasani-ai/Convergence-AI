// HTTP envelope helpers: { data } on success, { error: { code, message, details } } on failure.
import { ZodError } from "zod";
import { CapabilityUnavailable } from "./errors";
import { ConflictError } from "./store";

export const ok = (data: unknown, status = 200) => Response.json({ data }, { status });

export function fail(e: unknown): Response {
  if (e instanceof CapabilityUnavailable) return Response.json({ error: { code: "CAPABILITY_UNAVAILABLE", message: e.message, details: { capability: e.capability, reason: e.reason } } }, { status: 503 });
  if (e instanceof ConflictError) return Response.json({ error: { code: "CONFLICT", message: e.message, details: e.details } }, { status: 409 });
  if (e instanceof ZodError) return Response.json({ error: { code: "VALIDATION_FAILED", message: "Request body is invalid.", details: { issues: e.issues } } }, { status: 400 });
  if (e instanceof Error && e.message.startsWith("PRECONDITION:")) return Response.json({ error: { code: "VALIDATION_FAILED", message: e.message.slice(13).trim() } }, { status: 400 });
  console.error(e);
  return Response.json({ error: { code: "INTERNAL", message: e instanceof Error ? e.message : "Unexpected error" } }, { status: 500 });
}

export async function readBody(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return {}; }
}

export type Ctx = { params: Promise<{ path: string[] }> };
export const route = async (ctx: Ctx) => (await ctx.params).path.join("/");
