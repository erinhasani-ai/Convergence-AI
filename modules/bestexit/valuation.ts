// OWNER: BestExit (Person A). Frozen signature — implement the body. Spec: docs/mvp/01-bestexit-mvp.md
import type { ValuationResult, VehicleSnapshot } from "@contracts";
import { CapabilityUnavailable } from "@platform/errors";

export type ValuationInput = {
  vehicle: VehicleSnapshot;          // exact revision to value (pinned)
  evidenceCollectionRevision: number; // pinned; recorded in meta
  previous: ValuationResult | null;  // last valuation for this vehicle, for "why it changed"
  valuationId: string;               // assigned by the platform
  generatedAt: string;               // scenario clock (ISO UTC)
};

export function evaluateValuation(input: ValuationInput): ValuationResult {
  void input;
  throw new CapabilityUnavailable("valuation", "BestExit not implemented yet");
}
