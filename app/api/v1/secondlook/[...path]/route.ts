import { z } from "zod";
import { buildPassport } from "@modules/secondlook/passport";
import { gateway, modelConfigured } from "@platform/ai/gateway";
import { fail, ok, readBody, route, type Ctx } from "@platform/http";
import { store } from "@platform/store";
import { scenarioView } from "@platform/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: Ctx) {
  try {
    if ((await route(ctx)) !== "passports") return Response.json({ error: { code: "NOT_FOUND", message: "Unknown SecondLook resource" } }, { status: 404 });
    const { mode } = z.object({ mode: z.enum(["live", "replay"]).optional() }).parse(await readBody(req));
    // Live only when a server-side key exists AND the user asked for live; replay is always an explicit, labeled choice.
    const chosen = mode ?? (modelConfigured() ? "live" : "replay");
    const { generation, pins } = store.reserve("passport");
    const result = await buildPassport({ vehicle: store.vehicle(), evidence: store.evidence(), evidenceCollectionRevision: pins.evidence, passportId: store.nextId("CP"), generatedAt: store.tick(), mode: chosen }, gateway);
    store.commit("passport", generation, pins, result);
    store.log("condition.passport.updated.v1", `${result.passportId}: ${result.interpretationState}${result.modelRun.authored ? " (authored example)" : ""}; top check ${result.nextChecks[0]?.checkCode ?? "none"}`);
    return ok(scenarioView(), 201);
  } catch (e) { return fail(e); }
}
