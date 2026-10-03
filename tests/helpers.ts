import type { RoutePlan, ShipmentRequest } from "@contracts";
import { NEW_INSPECTOR_NOTE, seedEvidence, seedVehicles } from "@fixtures/shared/seed";
import { reviseVehicle, seedShipments, vehicleShipment } from "@platform/scenario";

export const v1 = seedVehicles().find((v) => v.vehicleId === "V-DEMO-001")!;
export const v2 = reviseVehicle(v1, [{ path: "/handling/startsEngine", value: false }, { path: "/handling/drivable", value: false }], ["EV-001-INSP-2"], "A-DEMO-INSPECTOR", "2026-10-05T14:30:00Z");
export const evidenceA = seedEvidence();
export const evidenceB = [...seedEvidence(), { evidenceId: NEW_INSPECTOR_NOTE.evidenceId, vehicleId: "V-DEMO-001", kind: "inspection_note" as const, sourceOrganization: "VEHICLEOS" as const, observedAt: NEW_INSPECTOR_NOTE.observedAt, ingestedAt: "2026-10-05T14:20:00Z", text: NEW_INSPECTOR_NOTE.text, trustLevel: "unverified" as const }];
export const journeyShipment = vehicleShipment("SH-S01-0001", v2, "L-DEMO-SELLER-LOT", "L-DEMO-BUYER-201", "DL-S01-0001");
export const allShipments = (): ShipmentRequest[] => [journeyShipment, ...seedShipments(seedVehicles())];

/** Independent check of a route: pickup before delivery and slot capacity at every point. */
export function routeIsValid(route: RoutePlan["routes"][number], slots: number): boolean {
  let load = 0;
  const picked = new Set<string>();
  for (const stop of route.stops) {
    if (stop.kind === "pickup") { picked.add(stop.shipmentId); load += 1; }
    else { if (!picked.has(stop.shipmentId)) return false; load -= 1; }
    if (load > slots) return false;
  }
  return load === 0;
}
