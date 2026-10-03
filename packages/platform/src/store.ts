// In-memory scenario store (demo persistence: single process, lost on restart — plan §7.9).
// Results are immutable and pinned to input revisions; freshness is computed at read time.
import "server-only";
import type { ConditionPassport, DealSnapshot, EvidenceRecord, RoutePlan, ShipmentRequest, ValuationResult, VehicleSnapshot } from "@contracts";
import { AS_OF, BUYERS, SCENARIO_ID, SEED_FACTS, seedEvidence, seedVehicles } from "@fixtures/shared/seed";
import { reviseVehicle, seedShipments, vehicleShipment, type HandlingPath } from "./scenario";
import { usd } from "./money";

export class ConflictError extends Error {
  constructor(message: string, public details: Record<string, unknown>) {
    super(message);
  }
}

type Pins = Record<"vehicle" | "evidence" | "fleet" | "shipments", number>;
export type Stored<T> = { result: T; pins: Pins; generation: number; state: "current" | "superseded" };
type Op = "valuation" | "passport" | "plan";

type State = {
  vehicles: Record<string, VehicleSnapshot[]>;
  evidence: EvidenceRecord[];
  versions: Pins;
  results: { valuation: Stored<ValuationResult>[]; passport: Stored<ConditionPassport>[]; plan: Stored<RoutePlan>[] };
  generation: Record<Op, number>;
  deal: DealSnapshot | null;
  journeyShipment: ShipmentRequest | null;
  winchOutOfService: boolean;
  seq: number;
  clockMinutes: number;
  log: { at: string; event: string; detail: string }[];
};

function fresh(): State {
  const vehicles: Record<string, VehicleSnapshot[]> = {};
  for (const v of seedVehicles()) vehicles[v.vehicleId] = [v];
  const evidence = seedEvidence();
  return {
    vehicles, evidence,
    versions: { vehicle: 1, evidence: evidence.length, fleet: 1, shipments: 1 },
    results: { valuation: [], passport: [], plan: [] },
    generation: { valuation: 0, passport: 0, plan: 0 },
    deal: null, journeyShipment: null, winchOutOfService: false, seq: 0, clockMinutes: 0,
    log: [{ at: AS_OF, event: "scenario.reset", detail: `${SCENARIO_ID} seeded (synthetic data)` }],
  };
}

const g = globalThis as { __vosState?: State };
const s = (): State => (g.__vosState ??= fresh());

export const store = {
  reset() { g.__vosState = fresh(); },
  /** Scenario clock: fixed AS_OF, advanced one minute per write so ordering is visible and deterministic. */
  now(): string { return new Date(Date.parse(AS_OF) + s().clockMinutes * 60_000).toISOString().replace(".000Z", "Z"); },
  tick(): string { s().clockMinutes += 1; return store.now(); },
  nextId(prefix: string): string { s().seq += 1; return `${prefix}-S01-${String(s().seq).padStart(4, "0")}`; },
  log(event: string, detail: string) { s().log.unshift({ at: store.now(), event, detail }); },

  vehicle(id = "V-DEMO-001"): VehicleSnapshot { const r = s().vehicles[id]; return r[r.length - 1]; },
  allVehicles(): VehicleSnapshot[] { return Object.values(s().vehicles).map((r) => r[r.length - 1]); },
  evidence(vehicleId = "V-DEMO-001"): EvidenceRecord[] { return s().evidence.filter((e) => e.vehicleId === vehicleId); },
  versions(): Pins { return { ...s().versions }; },

  appendEvidence(text: string): EvidenceRecord {
    const st = s();
    const n = st.evidence.filter((e) => e.evidenceId.startsWith("EV-001-INSP-")).length + 2;
    const at = store.tick();
    const rec: EvidenceRecord = { evidenceId: `EV-001-INSP-${n}`, vehicleId: "V-DEMO-001", kind: "inspection_note", sourceOrganization: "VEHICLEOS", observedAt: n === 2 ? "2026-10-05T13:20:00Z" : at, ingestedAt: at, text: text.slice(0, 20000), trustLevel: "unverified" };
    st.evidence.push(rec);
    st.versions.evidence += 1;
    store.log("evidence.recorded.v1", `${rec.evidenceId} appended; evidence collection rev ${st.versions.evidence}`);
    return rec;
  },

  confirmHandling(expectedRevision: number, changes: { path: HandlingPath; value: boolean }[], evidenceIds: string[]): VehicleSnapshot {
    const st = s();
    const cur = store.vehicle();
    if (cur.revision !== expectedRevision) throw new ConflictError(`Vehicle is at revision ${cur.revision}`, { currentRevision: cur.revision });
    const next = reviseVehicle(cur, changes, evidenceIds, "A-DEMO-INSPECTOR (reviewer)", store.tick());
    st.vehicles[cur.vehicleId].push(next);
    st.versions.vehicle = next.revision;
    store.log("vehicle.snapshot.updated.v1", `V-DEMO-001 r${next.revision}: ${changes.map((c) => `${c.path}=${c.value}`).join(", ")} (human confirmed)`);
    return next;
  },

  /** Generation guard: reserve before computing, commit after. An older run finishing late never becomes current. */
  reserve(op: Op): { generation: number; pins: Pins } { const st = s(); st.generation[op] += 1; return { generation: st.generation[op], pins: store.versions() }; },
  commit<T>(op: Op, generation: number, pins: Pins, result: T): Stored<T> {
    const list = s().results[op] as Stored<T>[];
    const head = list.find((r) => r.state === "current");
    const entry: Stored<T> = { result, pins, generation, state: "current" };
    if (head && head.generation > generation) entry.state = "superseded";
    else if (head) head.state = "superseded";
    list.push(entry);
    return entry;
  },
  current<T>(op: Op): Stored<T> | null { return ((s().results[op] as Stored<T>[]).find((r) => r.state === "current") ?? null); },
  previousValuation(): ValuationResult | null { return store.current<ValuationResult>("valuation")?.result ?? null; },

  freshness(pins: Pins, keys: (keyof Pins)[]): { freshness: "fresh" | "stale"; staleReasons: string[] } {
    const now = store.versions();
    const reasons = keys.filter((k) => now[k] !== pins[k]).map((k) =>
      k === "vehicle" ? `Vehicle revised (r${pins.vehicle} → r${now.vehicle})`
        : k === "evidence" ? `New evidence (collection rev ${pins.evidence} → ${now.evidence})`
          : k === "fleet" ? "Fleet availability changed" : "Shipments changed");
    return { freshness: reasons.length ? "stale" : "fresh", staleReasons: reasons };
  },

  confirmDeal(buyerId: keyof typeof BUYERS, priceMinor: number, valuationId: string | null): { deal: DealSnapshot; shipment: ShipmentRequest } {
    const st = s();
    const v = store.vehicle();
    const deal: DealSnapshot = { dealId: "DL-S01-0001", vehicleRef: { entityType: "VehicleSnapshot", id: v.vehicleId, revision: v.revision }, buyerId, price: usd(priceMinor), buyerFee: usd(42500), sellerFee: usd(35000), status: "confirmed", simulated: true, valuationId };
    const shipment = vehicleShipment("SH-S01-0001", v, v.locationId, BUYERS[buyerId].locationId, deal.dealId);
    st.deal = deal;
    st.journeyShipment = shipment;
    st.versions.shipments += 1;
    store.tick();
    store.log("deal.updated.v1", `${deal.dealId} confirmed (SIMULATED) with ${buyerId}; shipment ${shipment.shipmentId} needs ${shipment.requiredEquipment.join(" + ")}`);
    return { deal, shipment };
  },
  deal(): DealSnapshot | null { return s().deal; },
  shipments(): ShipmentRequest[] { const st = s(); return [...(st.journeyShipment ? [st.journeyShipment] : []), ...seedShipments(seedVehicles())]; },
  facts() { return SEED_FACTS; },

  setWinchOutage(out: boolean) { const st = s(); if (st.winchOutOfService !== out) { st.winchOutOfService = out; st.versions.fleet += 1; store.log("fleet.availability.updated.v1", `CR-DEMO-B winch ${out ? "OUT OF SERVICE" : "restored"}`); } },
  winchOutOfService(): boolean { return s().winchOutOfService; },
  eventLog() { return s().log.slice(0, 30); },
};
