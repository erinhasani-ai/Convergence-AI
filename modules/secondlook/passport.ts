// OWNER: SecondLook (Person B). Frozen signature — implement the body. Spec: docs/mvp/02-secondlook-mvp.md
import type { ConditionPassport, EvidenceRecord, VehicleSnapshot } from "@contracts";
import type { ModelGateway } from "@platform/ai/gateway";
import { CapabilityUnavailable } from "@platform/errors";

export type PassportInput = {
  vehicle: VehicleSnapshot;
  evidence: EvidenceRecord[];        // active evidence for the vehicle, oldest first
  evidenceCollectionRevision: number;
  passportId: string;
  generatedAt: string;
  mode: "live" | "replay";           // chosen by the platform: live only when a server-side API key exists
};

export async function buildPassport(input: PassportInput, gateway: ModelGateway): Promise<ConditionPassport> {
  void input;
  void gateway;
  throw new CapabilityUnavailable("condition", "SecondLook not implemented yet");
}
