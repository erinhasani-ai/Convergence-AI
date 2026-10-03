import { z } from "zod";
import type { ValuationResult } from "@contracts";
import { fail, ok, readBody, route, type Ctx } from "@platform/http";
import { HANDLING_PATHS } from "@platform/scenario";
import { store } from "@platform/store";
import { scenarioView } from "@platform/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  try {
    if ((await route(ctx)) === "state") return ok(scenarioView());
    return Response.json({ error: { code: "NOT_FOUND", message: "Unknown platform resource" } }, { status: 404 });
  } catch (e) { return fail(e); }
}

const Revision = z.object({
  expectedRevision: z.number().int().min(1),
  changes: z.array(z.object({ path: z.enum(HANDLING_PATHS as [string, ...string[]]), value: z.boolean() })).min(1),
  evidenceIds: z.array(z.string()).min(1),
}).strict();

export async function POST(req: Request, ctx: Ctx) {
  try {
    const path = await route(ctx);
    const body = await readBody(req);
    switch (path) {
      case "scenario/reset":
        store.reset();
        return ok(scenarioView());
      case "evidence": {
        const { text } = z.object({ text: z.string().min(5).max(20000) }).parse(body);
        store.appendEvidence(text);
        return ok(scenarioView(), 201);
      }
      case "vehicles/V-DEMO-001/revisions": {
        const b = Revision.parse(body);
        store.confirmHandling(b.expectedRevision, b.changes as { path: (typeof HANDLING_PATHS)[number]; value: boolean }[], b.evidenceIds);
        return ok(scenarioView(), 201);
      }
      case "deals": {
        const val = store.current<ValuationResult>("valuation");
        if (!val) throw new Error("PRECONDITION: Run BestExit first, so the deal price has a recorded basis.");
        if (store.freshness(val.pins, ["vehicle", "evidence"]).freshness !== "fresh") throw new Error("PRECONDITION: The valuation is out of date. Recompute it before confirming a deal.");
        const rec = val.result.channels.find((c) => c.channelId === val.result.recommendation?.channelId);
        if (!rec || rec.gross.state !== "known") throw new Error("PRECONDITION: No recommended channel with a known price.");
        store.confirmDeal("B-DEMO-201", rec.gross.value.mid.amountMinor, val.result.valuationId);
        return ok(scenarioView(), 201);
      }
      case "fleet": {
        const { winchOutOfService } = z.object({ winchOutOfService: z.boolean() }).parse(body);
        store.setWinchOutage(winchOutOfService);
        return ok(scenarioView());
      }
      default:
        return Response.json({ error: { code: "NOT_FOUND", message: `Unknown platform command: ${path}` } }, { status: 404 });
    }
  } catch (e) { return fail(e); }
}
