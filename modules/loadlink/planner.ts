// OWNER: LoadLink (Person C). Frozen signature — implement the body. Spec: docs/mvp/05-loadlink-mvp.md
import { CONTRACT_VERSION } from "@contracts";
import type { CarrierResource, ReleaseReadiness, RoutePlan, RouteStop, ShipmentRequest, UnassignedWork } from "@contracts";
import { CapabilityUnavailable } from "@platform/errors";
import { distanceKm, SCENARIO_ID } from "@fixtures/shared/seed";

export type PlanInput = {
  shipments: ShipmentRequest[];      // all open shipments (vehicle and parts cargo)
  readiness: ReleaseReadiness[];     // one per shipment, from the foundation minimal provider
  carriers: CarrierResource[];       // current fleet (equipment may be out of service)
  routePlanId: string;
  generatedAt: string;
  evidenceCollectionRevision: number;
};

// Brute force is (trucks + 1)^shipments assignments; refuse honestly rather than hang.
const MAX_ASSIGNMENTS = 200_000;
const UNASSIGNED = -1;

type Route = { stops: RouteStop[]; distanceKm: number };

export function planRoutes(input: PlanInput): RoutePlan {
  const readinessById = new Map(input.readiness.map((r) => [r.shipmentId, r]));
  const carriers = [...input.carriers].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  const unassigned: UnassignedWork[] = [];
  const plannable: { shipment: ShipmentRequest; capable: number[] }[] = [];

  // 1–2. Exclusions in spec order, then equipment capability.
  for (const s of input.shipments) {
    if (s.cargo.cargoType === "parts_package") {
      unassigned.push({ shipmentId: s.shipmentId, reason: "cargo_type_unsupported", detail: "Vehicle carriers only; parcel/LTL adapter later." });
      continue;
    }
    const readiness = readinessById.get(s.shipmentId);
    if (readiness?.decision === "blocked") {
      const basis = readiness.gates.filter((g) => g.state === "blocked").map((g) => `${g.kind}: ${g.basis}`).join("; ");
      unassigned.push({ shipmentId: s.shipmentId, reason: "readiness_blocked", detail: `Release blocked — ${basis || "blocked gate"}.` });
      continue;
    }
    const capable = carriers.flatMap((c, i) => (s.requiredEquipment.every((e) => c.equipment.includes(e)) ? [i] : []));
    if (capable.length === 0) {
      unassigned.push({ shipmentId: s.shipmentId, reason: "no_capable_equipment", detail: `No available truck has ${s.requiredEquipment.join(" + ")}.` });
      continue;
    }
    plannable.push({ shipment: s, capable });
  }
  plannable.sort((a, b) => a.shipment.shipmentId.localeCompare(b.shipment.shipmentId));

  const combos = plannable.reduce((n, p) => n * (p.capable.length + 1), 1);
  if (combos > MAX_ASSIGNMENTS) {
    throw new CapabilityUnavailable("routePlanning", `MVP brute-force search is limited to ${MAX_ASSIGNMENTS} assignments (got ${combos})`);
  }

  // 3. Search every assignment; best route per (truck, shipment set) is memoized.
  const routeCache = new Map<string, Route | null>();
  const bestRoute = (truck: number, members: ShipmentRequest[]): Route | null => {
    const key = `${truck}|${members.map((m) => m.shipmentId).join(",")}`;
    if (!routeCache.has(key)) routeCache.set(key, shortestRoute(carriers[truck], members));
    return routeCache.get(key)!;
  };

  type Candidate = { assignment: number[]; routes: (Route | null)[]; unassignedCount: number; maxKm: number; totalKm: number; tieKey: string[] };
  let best: Candidate | null = null;
  const assignment: number[] = new Array(plannable.length).fill(UNASSIGNED);

  const evaluate = () => {
    const routes = carriers.map((_, t) => {
      const members = plannable.filter((_, i) => assignment[i] === t).map((p) => p.shipment);
      return members.length ? bestRoute(t, members) : { stops: [], distanceKm: 0 };
    });
    if (routes.some((r) => r === null)) return; // a truck cannot carry this set at all
    const kms = routes.map((r) => r!.distanceKm);
    // 4. Objective: fewest unassigned, smallest longest route, smallest total, lexicographic resource IDs.
    const cand: Candidate = {
      assignment: [...assignment],
      routes,
      unassignedCount: assignment.filter((a) => a === UNASSIGNED).length,
      maxKm: Math.max(0, ...kms),
      totalKm: kms.reduce((a, b) => a + b, 0),
      tieKey: assignment.map((a) => (a === UNASSIGNED ? "￿" : carriers[a].resourceId)),
    };
    if (!best || better(cand, best)) best = cand;
  };

  const assign = (i: number) => {
    if (i === plannable.length) return evaluate();
    for (const t of [...plannable[i].capable, UNASSIGNED]) {
      assignment[i] = t;
      assign(i + 1);
    }
    assignment[i] = UNASSIGNED;
  };
  assign(0);

  const chosen = best as Candidate | null;
  // 5. Plannable with a capable truck, but no feasible slot in the best plan.
  plannable.forEach((p, i) => {
    if (!chosen || chosen.assignment[i] === UNASSIGNED) {
      unassigned.push({ shipmentId: p.shipment.shipmentId, reason: "capacity", detail: "Capable trucks have no free slot for this shipment in the best plan." });
    }
  });
  const order = new Map(input.shipments.map((s, i) => [s.shipmentId, i]));
  unassigned.sort((a, b) => order.get(a.shipmentId)! - order.get(b.shipmentId)!);

  const assignedIds = plannable.filter((_, i) => chosen && chosen.assignment[i] !== UNASSIGNED).map((p) => p.shipment.shipmentId);
  const unknownAssigned = assignedIds.filter((id) => (readinessById.get(id)?.decision ?? "unknown") === "unknown");

  const warnings: RoutePlan["meta"]["warnings"] = [
    { code: "SIMULATION_ONLY", message: "Synthetic fleet, shipments and readiness; dispatch is never authorized in this demo." },
    { code: "TIME_WINDOWS_NOT_CHECKED", message: "Pickup/delivery windows, service time and driver hours are not checked in this MVP." },
    { code: "FIXTURE_DISTANCES", message: "Distances come from fixture matrix DM-DEMO-1, not road routing." },
  ];
  for (const id of unknownAssigned) {
    const gates = readinessById.get(id)?.gates.filter((g) => g.state === "unknown").map((g) => g.kind) ?? [];
    warnings.push({ code: "READINESS_UNKNOWN", message: `${id}: readiness unknown (${gates.join(", ") || "no readiness record"}); plan is provisional.` });
  }

  return {
    routePlanId: input.routePlanId,
    status: unknownAssigned.length > 0 ? "provisional" : "eligible",
    routes: carriers.map((c, t) => ({ resourceId: c.resourceId, stops: chosen?.routes[t]?.stops ?? [], distanceKm: chosen?.routes[t]?.distanceKm ?? 0 })),
    unassigned,
    feasibility: { capacity: "pass", equipment: "pass", pickupBeforeDelivery: "pass", timeWindows: "not_checked" },
    readiness: input.readiness,
    dispatchAllowed: false,
    meta: {
      contractVersion: CONTRACT_VERSION,
      dataMode: "synthetic",
      runtimeMode: "demo",
      scenarioId: SCENARIO_ID,
      providerId: "loadlink",
      generatedAt: input.generatedAt,
      inputRefs: input.shipments.map((s) => ({ entityType: "ShipmentRequest", id: s.shipmentId, revision: s.revision })),
      evidenceCollectionRevision: input.evidenceCollectionRevision,
      engine: { name: "LOADLINK", version: "0.1.0" },
      warnings,
    },
  };
}

function better(
  a: { unassignedCount: number; maxKm: number; totalKm: number; tieKey: string[] },
  b: { unassignedCount: number; maxKm: number; totalKm: number; tieKey: string[] },
): boolean {
  if (a.unassignedCount !== b.unassignedCount) return a.unassignedCount < b.unassignedCount;
  if (a.maxKm !== b.maxKm) return a.maxKm < b.maxKm;
  if (a.totalKm !== b.totalKm) return a.totalKm < b.totalKm;
  for (let i = 0; i < a.tieKey.length; i++) {
    if (a.tieKey[i] !== b.tieKey[i]) return a.tieKey[i] < b.tieKey[i];
  }
  return false;
}

/**
 * Shortest stop sequence for one truck: starts at its home base, ends at the last delivery,
 * pickup before delivery, cars on board never above vehicleSlots. Exact DP over per-shipment
 * status (0 = waiting, 1 = on board, 2 = delivered) and current location. Null if infeasible.
 */
function shortestRoute(truck: CarrierResource, shipments: ShipmentRequest[]): Route | null {
  const n = shipments.length;
  const pow = Array.from({ length: n }, (_, i) => 3 ** i);
  const done = pow.reduce((acc, p) => acc + 2 * p, 0);
  const memo = new Map<string, { km: number; next: { stop: RouteStop; state: number } | null } | null>();

  const solve = (state: number, at: string): { km: number; next: { stop: RouteStop; state: number } | null } | null => {
    if (state === done) return { km: 0, next: null };
    const key = `${state}|${at}`;
    if (memo.has(key)) return memo.get(key)!;
    let onBoard = 0;
    for (let i = 0; i < n; i++) if (Math.floor(state / pow[i]) % 3 === 1) onBoard++;

    let result: { km: number; next: { stop: RouteStop; state: number } } | null = null;
    for (let i = 0; i < n; i++) {
      const status = Math.floor(state / pow[i]) % 3;
      if (status === 2 || (status === 0 && onBoard >= truck.vehicleSlots)) continue;
      const s = shipments[i];
      const stop: RouteStop = status === 0
        ? { kind: "pickup", shipmentId: s.shipmentId, locationId: s.originId }
        : { kind: "delivery", shipmentId: s.shipmentId, locationId: s.destinationId };
      const rest = solve(state + pow[i], stop.locationId);
      if (!rest) continue;
      const km = distanceKm(at, stop.locationId) + rest.km;
      if (!result || km < result.km) result = { km, next: { stop, state: state + pow[i] } };
    }
    memo.set(key, result);
    return result;
  };

  const head = solve(0, truck.homeBaseId);
  if (!head) return null;
  const stops: RouteStop[] = [];
  let cursor: { km: number; next: { stop: RouteStop; state: number } | null } | null = head;
  while (cursor?.next) {
    stops.push(cursor.next.stop);
    cursor = memo.get(`${cursor.next.state}|${cursor.next.stop.locationId}`) ?? null;
  }
  return { stops, distanceKm: head.km };
}
