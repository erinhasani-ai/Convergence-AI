// OWNER: LoadLink (Person C). Frozen signature — implement the body. Spec: docs/mvp/05-loadlink-mvp.md
import type { CarrierResource, ReleaseReadiness, RoutePlan, ShipmentRequest } from "@contracts";
import { CapabilityUnavailable } from "@platform/errors";

export type PlanInput = {
  shipments: ShipmentRequest[];      // all open shipments (vehicle and parts cargo)
  readiness: ReleaseReadiness[];     // one per shipment, from the foundation minimal provider
  carriers: CarrierResource[];       // current fleet (equipment may be out of service)
  routePlanId: string;
  generatedAt: string;
  evidenceCollectionRevision: number;
};

export function planRoutes(input: PlanInput): RoutePlan {
  void input;
  throw new CapabilityUnavailable("routePlanning", "LoadLink not implemented yet");
}
