// OWNER: SecondLook (Person B). Frozen signature — implement the body. Spec: docs/mvp/02-secondlook-mvp.md
// Pipeline: evidence → gateway (live model or authored replay) → citation/field validation → NEXTCHECK-0.1 → passport.
// The passport only proposes; vehicle records change only through the foundation's reviewer confirmation.
import { CONTRACT_VERSION, type ArtifactMeta, type ConditionPassport, type EvidenceRecord, type VehicleSnapshot } from "@contracts";
import type { ModelGateway } from "@platform/ai/gateway";
import { SCENARIO_ID } from "@fixtures/shared/seed";
import { PROMPT_VERSION, SYSTEM_PROMPT, buildTask, replayKeyFor, toDocuments } from "./prompt";
import { rankNextChecks } from "./rules";
import { validateInterpretation } from "./validate";

export type PassportInput = {
  vehicle: VehicleSnapshot;
  evidence: EvidenceRecord[];        // active evidence for the vehicle, oldest first
  evidenceCollectionRevision: number;
  passportId: string;
  generatedAt: string;
  mode: "live" | "replay";           // chosen by the platform: live only when a server-side API key exists
};

export async function buildPassport(input: PassportInput, gateway: ModelGateway): Promise<ConditionPassport> {
  const { output, run } = await gateway.interpret({
    promptVersion: PROMPT_VERSION,
    system: SYSTEM_PROMPT,
    task: buildTask(input.vehicle),
    documents: toDocuments(input.evidence),
    mode: input.mode,
    replayKey: replayKeyFor(input.evidence),
  });

  const warnings: ArtifactMeta["warnings"] = [];
  const validated = output ? validateInterpretation(output, input.evidence) : null;
  const interpretation = validated?.interpretation ?? null;

  // State follows what the gateway actually ran, not what was requested.
  const interpretationState: ConditionPassport["interpretationState"] = !output ? "rules_only" : run.mode === "replay" ? "replay" : "model";
  if (interpretationState === "rules_only") {
    warnings.push({ code: "MODEL_UNAVAILABLE", message: `Model interpretation unavailable (${run.status}${run.error ? `: ${run.error}` : ""}). Checks below come from vehicle facts only; no findings were generated.` });
  }
  if (interpretationState === "replay") {
    warnings.push({ code: "REPLAYED_OUTPUT", message: run.authored ? "Authored example — not a model output." : "Replayed model output." });
  }
  if (validated && validated.removedCitations.length > 0) {
    warnings.push({ code: "CITATION_DROPPED", message: `Removed citations that are not input evidence: ${validated.removedCitations.join(", ")}.` });
  }

  return {
    passportId: input.passportId,
    vehicleRef: { entityType: "VehicleSnapshot", id: input.vehicle.vehicleId, revision: input.vehicle.revision },
    interpretation,
    interpretationState,
    nextChecks: rankNextChecks(interpretation, input.vehicle),
    modelRun: { ...run, droppedClaims: [...run.droppedClaims, ...(validated?.droppedClaims ?? [])] },
    meta: {
      contractVersion: CONTRACT_VERSION,
      dataMode: "synthetic",
      runtimeMode: "demo",
      scenarioId: SCENARIO_ID,
      providerId: "secondlook",
      generatedAt: input.generatedAt,
      inputRefs: [
        { entityType: "VehicleSnapshot", id: input.vehicle.vehicleId, revision: input.vehicle.revision },
        ...input.evidence.map((e) => ({ entityType: "EvidenceRecord", id: e.evidenceId, revision: 1 })),
      ],
      evidenceCollectionRevision: input.evidenceCollectionRevision,
      engine: { name: "SECONDLOOK", version: "0.1.0" },
      warnings,
    },
  };
}
