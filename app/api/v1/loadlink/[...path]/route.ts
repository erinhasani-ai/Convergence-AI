import { planRoutes } from "@modules/loadlink/planner";
import { fail, ok, route, type Ctx } from "@platform/http";
import { fleet, readinessFor } from "@platform/scenario";
import { store } from "@platform/store";
import { scenarioView } from "@platform/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: Ctx) {
  try {
    if ((await route(ctx)) !== "plans") return Response.json({ error: { code: "NOT_FOUND", message: "Unknown LoadLink resource" } }, { status: 404 });
    const shipments = store.shipments();
    const { generation, pins } = store.reserve("plan");
    const result = planRoutes({ shipments, readiness: readinessFor(shipments), carriers: fleet(store.winchOutOfService()), routePlanId: store.nextId("RPL"), generatedAt: store.tick(), evidenceCollectionRevision: pins.evidence });
    store.commit("plan", generation, pins, result);
    store.log("route.plan.created.v1", `${result.routePlanId}: ${result.status}, ${result.unassigned.length} unassigned`);
    return ok(scenarioView(), 201);
  } catch (e) { return fail(e); }
}
