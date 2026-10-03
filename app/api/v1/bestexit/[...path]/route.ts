import { evaluateValuation } from "@modules/bestexit/valuation";
import { fail, ok, route, type Ctx } from "@platform/http";
import { store } from "@platform/store";
import { scenarioView } from "@platform/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: Ctx) {
  try {
    if ((await route(ctx)) !== "valuations") return Response.json({ error: { code: "NOT_FOUND", message: "Unknown BestExit resource" } }, { status: 404 });
    const { generation, pins } = store.reserve("valuation");
    const result = evaluateValuation({ vehicle: store.vehicle(), evidenceCollectionRevision: pins.evidence, previous: store.previousValuation(), valuationId: store.nextId("VR"), generatedAt: store.tick() });
    store.commit("valuation", generation, pins, result);
    store.log("valuation.completed.v1", `${result.valuationId} for V-DEMO-001 r${result.vehicleRef.revision}: ${result.recommendation?.channelId ?? result.status}`);
    return ok(scenarioView(), 201);
  } catch (e) { return fail(e); }
}
