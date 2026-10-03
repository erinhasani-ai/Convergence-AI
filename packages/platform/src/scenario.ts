// Pure scenario helpers shared by the store, the API routes and the tests (no state here).
import type { CarrierResource, Location, ReleaseReadiness, ShipmentRequest, VehicleSnapshot } from "@contracts";
import { CARRIERS, LOCATIONS, SEED_FACTS, type FactKind } from "@fixtures/shared/seed";
import { requiredEquipment } from "./handling";
import { evaluateReadiness } from "./gates";

export type HandlingPath = "/handling/startsEngine" | "/handling/drivable" | "/handling/rolls" | "/handling/keysPresent";
export const HANDLING_PATHS: HandlingPath[] = ["/handling/startsEngine", "/handling/drivable", "/handling/rolls", "/handling/keysPresent"];

export function location(id: string): Location {
  const l = LOCATIONS.find((x) => x.locationId === id);
  if (!l) throw new Error(`Unknown location ${id}`);
  return l;
}

/** Reviewer-confirmed correction → a NEW immutable vehicle revision with human_confirmed provenance. */
export function reviseVehicle(v: VehicleSnapshot, changes: { path: HandlingPath; value: boolean }[], evidenceIds: string[], confirmedBy: string, at: string): VehicleSnapshot {
  if (changes.length === 0) throw new Error("No changes");
  const handling = { ...v.handling };
  for (const c of changes) {
    const key = c.path.split("/")[2] as keyof VehicleSnapshot["handling"];
    handling[key] = { state: "known", value: c.value, sourceIds: evidenceIds };
  }
  return {
    ...v,
    revision: v.revision + 1,
    handling,
    changeReason: "reviewed_correction",
    createdAt: at,
    fieldProvenance: [...v.fieldProvenance, ...changes.map((c) => ({ path: c.path, method: "human_confirmed" as const, evidenceIds, confirmedBy, at }))],
  };
}

export function vehicleShipment(shipmentId: string, v: VehicleSnapshot, originId: string, destinationId: string, dealId: string | null): ShipmentRequest {
  const req = requiredEquipment(v);
  return {
    shipmentId, revision: 1, dealId, purpose: "sale_delivery",
    cargo: { cargoType: "vehicle", vehicleRef: { entityType: "VehicleSnapshot", id: v.vehicleId, revision: v.revision } },
    originId, destinationId, requiredEquipment: req.equipment, requirementBasis: req.basis,
    keysPresent: v.handling.keysPresent, drivable: v.handling.drivable,
  };
}

/** SH-DEMO-002..006 (plan §6.5.8). */
export function seedShipments(vehicles: VehicleSnapshot[]): ShipmentRequest[] {
  const v = (id: string) => vehicles.find((x) => x.vehicleId === id)!;
  return [
    vehicleShipment("SH-DEMO-002", v("V-DEMO-002"), "L-DEMO-YARD-N", "L-DEMO-BUYER-401", "DL-DEMO-002"),
    vehicleShipment("SH-DEMO-003", v("V-DEMO-004"), "L-DEMO-YARD-N", "L-DEMO-BUYER-101", "DL-DEMO-003"),
    vehicleShipment("SH-DEMO-004", v("V-DEMO-005"), "L-DEMO-SELLER-LOT", "L-DEMO-BUYER-101", "DL-DEMO-004"),
    vehicleShipment("SH-DEMO-005", v("V-DEMO-006"), "L-DEMO-SELLER-LOT", "L-DEMO-BUYER-101", "DL-DEMO-005"),
    {
      shipmentId: "SH-DEMO-006", revision: 1, dealId: null, purpose: "parts_delivery",
      cargo: { cargoType: "parts_package", packageId: "PKG-DEMO-001", massKg: 9 },
      originId: "L-DEMO-YARD-N", destinationId: "L-DEMO-BUYER-201",
      requiredEquipment: ["parcel_space"], requirementBasis: ["Parts package ≤ 70 kg → parcel space (no car slot)."],
      keysPresent: null, drivable: null,
    },
  ];
}

export type Fact = { factId: string; shipmentId: string; kind: FactKind; observedAt: string };
export function readinessFor(shipments: ShipmentRequest[], facts: Fact[] = SEED_FACTS): ReleaseReadiness[] {
  return shipments.map((s) => evaluateReadiness(s, facts, location(s.originId)));
}

export function fleet(winchOutOfService: boolean): CarrierResource[] {
  return CARRIERS.map((c) => (winchOutOfService && c.resourceId === "CR-DEMO-B" ? { ...c, label: `${c.label} (winch out of service)`, equipment: c.equipment.filter((e) => e !== "winch") } : c));
}
