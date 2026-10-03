// Server-side model gateway (plan §7.1). Live Claude or Gemini call with schema-validated output, or a labeled replay.
// Never falls back from live to replay silently: a failed live call returns output=null with the error.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { z } from "zod";
import { InterpretationSchema, type Interpretation, type ModelRunInfo } from "@contracts";
import { REPLAYS } from "@fixtures/shared/model-replays/secondlook";

export type GatewayDocument = { sourceId: string; kind: string; observedAt: string | null; text: string };
export type GatewayRequest = {
  promptVersion: string;          // e.g. "sl-interpret-1.0.0"
  system: string;                 // trusted instructions (written by the module owner)
  task: string;                   // trusted task text (written by the module owner)
  documents: GatewayDocument[];   // UNTRUSTED evidence text — sent as data only
  mode: "live" | "replay";
  replayKey: "case-a" | "case-b"; // which authored example to use in replay mode
};
export type GatewayResult = { output: Interpretation | null; run: ModelRunInfo };
export type ModelGateway = { interpret(req: GatewayRequest): Promise<GatewayResult> };

// Provider: VEHICLEOS_MODEL_PROVIDER if set, else whichever key is present (Anthropic first).
const explicit = process.env.VEHICLEOS_MODEL_PROVIDER;
export const PROVIDER: "anthropic" | "gemini" =
  explicit === "anthropic" || explicit === "gemini" ? explicit : !process.env.ANTHROPIC_API_KEY && process.env.GEMINI_API_KEY ? "gemini" : "anthropic";
export const PROVIDER_LABEL = PROVIDER === "gemini" ? "Gemini" : "Claude";
export const MODEL_ID =
  PROVIDER === "gemini" ? process.env.VEHICLEOS_GEMINI_MODEL || "gemini-flash-latest" : process.env.VEHICLEOS_MODEL_ID || "claude-opus-5-5";
const KEY_VAR = PROVIDER === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
export const modelConfigured = () => Boolean(process.env[KEY_VAR]);

const redact = (t: string) =>
  t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone]").replace(/[\u0000-\u0008\u000b-\u001f]/g, "");

const cache = ((globalThis as { __vosModelCache?: Map<string, GatewayResult> }).__vosModelCache ??= new Map());
let runSeq = 0;
const runId = () => `MR-${Date.now().toString(36)}-${++runSeq}`;

type RunBase = Omit<ModelRunInfo, "status" | "latencyMs" | "usage" | "error">;

async function live(req: GatewayRequest): Promise<GatewayResult> {
  const started = Date.now();
  const base: RunBase = { modelRunId: runId(), mode: "live", authored: false, modelId: MODEL_ID, promptVersion: req.promptVersion, droppedClaims: [] };
  if (!modelConfigured()) {
    return { output: null, run: { ...base, status: "not_configured", latencyMs: 0, usage: null, error: `${KEY_VAR} is not set on the server.` } };
  }
  const documents = req.documents.map((d) => ({ ...d, text: redact(d.text).slice(0, 20000) }));
  const content = `${req.task}\n\n<evidence_documents>\n${JSON.stringify(documents, null, 2)}\n</evidence_documents>`;
  return PROVIDER === "gemini" ? liveGemini(req, content, base, started) : liveAnthropic(req, content, base, started);
}

async function liveAnthropic(req: GatewayRequest, content: string, base: RunBase, started: number): Promise<GatewayResult> {
  try {
    const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: MODEL_ID,
      max_tokens: 16000,
      system: req.system,
      messages: [{ role: "user", content }],
      output_config: { effort: "medium", format: zodOutputFormat(InterpretationSchema) },
    });
    const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    if (response.stop_reason === "refusal") {
      return { output: null, run: { ...base, status: "refused", latencyMs: Date.now() - started, usage, error: "The model declined this request." } };
    }
    if (!response.parsed_output) {
      return { output: null, run: { ...base, status: "schema_failed", latencyMs: Date.now() - started, usage, error: `Output did not match the schema (stop_reason: ${response.stop_reason}).` } };
    }
    return { output: response.parsed_output, run: { ...base, status: "succeeded", latencyMs: Date.now() - started, usage, error: null } };
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `${e.status ?? ""} ${e.name}: ${e.message}` : e instanceof Error ? e.message : String(e);
    return { output: null, run: { ...base, status: "provider_error", latencyMs: Date.now() - started, usage: null, error: msg.slice(0, 300) } };
  }
}

// Gemini over REST (no extra dependency). The schema goes in the system prompt and the reply is
// validated with the same Zod schema, so a malformed answer is "schema_failed", never accepted.
const GEMINI_BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);
type GeminiResponse = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string };
};

async function liveGemini(req: GatewayRequest, content: string, base: RunBase, started: number): Promise<GatewayResult> {
  const system = `${req.system}\n\nReply with exactly one JSON object that conforms to this JSON Schema, and nothing else:\n${JSON.stringify(z.toJSONSchema(InterpretationSchema))}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL_ID)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: content }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000 },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      return { output: null, run: { ...base, status: "provider_error", latencyMs: Date.now() - started, usage: null, error: `${res.status}: ${body.error?.message ?? res.statusText}`.slice(0, 300) } };
    }
    const meta = body.usageMetadata;
    const usage = meta ? { inputTokens: meta.promptTokenCount ?? 0, outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0) } : null;
    const candidate = body.candidates?.[0];
    const finish = candidate?.finishReason ?? "none";
    if (body.promptFeedback?.blockReason || GEMINI_BLOCKED.has(finish)) {
      return { output: null, run: { ...base, status: "refused", latencyMs: Date.now() - started, usage, error: `The model declined this request (${body.promptFeedback?.blockReason ?? finish}).` } };
    }
    const text = (candidate?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* handled as schema_failed below */ }
    const parsed = InterpretationSchema.safeParse(json);
    if (!parsed.success) {
      return { output: null, run: { ...base, status: "schema_failed", latencyMs: Date.now() - started, usage, error: `Output did not match the schema (finishReason: ${finish}).` } };
    }
    return { output: parsed.data, run: { ...base, status: "succeeded", latencyMs: Date.now() - started, usage, error: null } };
  } catch (e) {
    return { output: null, run: { ...base, status: "provider_error", latencyMs: Date.now() - started, usage: null, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) } };
  }
}

export const gateway: ModelGateway = {
  async interpret(req) {
    if (req.mode === "replay") {
      return {
        output: REPLAYS[req.replayKey],
        run: { modelRunId: runId(), mode: "replay", authored: true, modelId: null, promptVersion: req.promptVersion, status: "succeeded", latencyMs: 0, usage: null, droppedClaims: [], error: null },
      };
    }
    // Cache by prompt + model + exact input, so unchanged evidence never triggers a second paid call.
    const key = createHash("sha256").update(JSON.stringify([req.promptVersion, MODEL_ID, req.system, req.task, req.documents])).digest("hex");
    const hit = cache.get(key);
    if (hit) return hit;
    const result = await live(req);
    if (result.run.status === "succeeded") cache.set(key, result);
    return result;
  },
};
