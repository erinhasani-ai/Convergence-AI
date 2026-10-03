// LoadLink acceptance tests (docs/mvp/05-loadlink-mvp.md). Owner: Person C.
import { describe, expect, it } from "vitest";
import type { RoutePlan } from "@contracts";
import { planRoutes } from "@modules/loadlink/planner";
import { fleet, readinessFor } from "@platform/scenario";
import { allShipments, routeIsValid } from "./helpers";

const plan = (outage: boolean) => {
  const shipments = allShipments();
  return planRoutes({ shipments, readiness: readinessFor(shipments), carriers: fleet(outage), routePlanId: "RPL-TEST", generatedAt: "2026-10-05T14:00:00Z", evidenceCollectionRevision: 4 });
};
const route = (p: RoutePlan, id: string) => p.routes.find((r) => r.resourceId === id);
const ids = (p: RoutePlan, id: string) => [...new Set(route(p, id)?.stops.map((s) => s.shipmentId) ?? [])].sort();
const reason = (p: RoutePlan, id: string) => p.unassigned.find((u) => u.shipmentId === id)?.reason;

describe("LoadLink normal fleet", () => {
  const p = plan(false);
  it("puts winch work on truck B and balances the rest", () => {
    expect(ids(p, "CR-DEMO-B")).toEqual(["SH-DEMO-002", "SH-S01-0001"]);
    expect(route(p, "CR-DEMO-B")?.distanceKm).toBe(375);
    expect(ids(p, "CR-DEMO-A")).toEqual(["SH-DEMO-003", "SH-DEMO-004"]);
    expect(route(p, "CR-DEMO-A")?.distanceKm).toBe(360);
  });
  it("reports unplannable work with reasons", () => {
    expect(reason(p, "SH-DEMO-005")).toBe("readiness_blocked");
    expect(reason(p, "SH-DEMO-006")).toBe("cargo_type_unsupported");
  });
  it("is provisional and never dispatchable", () => {
    expect(p.status).toBe("provisional");
    expect(p.dispatchAllowed).toBe(false);
    expect(p.feasibility.timeWindows).toBe("not_checked");
  });
  it("never violates pickup-before-delivery or capacity", () => {
    expect(route(p, "CR-DEMO-A") && routeIsValid(route(p, "CR-DEMO-A")!, 3)).toBe(true);
    expect(route(p, "CR-DEMO-B") && routeIsValid(route(p, "CR-DEMO-B")!, 2)).toBe(true);
  });
});

describe("LoadLink with truck B's winch out of service", () => {
  const p = plan(true);
  it("leaves winch-needing cars unassigned instead of overloading or mis-equipping", () => {
    expect(reason(p, "SH-S01-0001")).toBe("no_capable_equipment");
    expect(reason(p, "SH-DEMO-002")).toBe("no_capable_equipment");
    expect(ids(p, "CR-DEMO-A")).toEqual(["SH-DEMO-003"]);
    expect(route(p, "CR-DEMO-A")?.distanceKm).toBe(290);
    expect(ids(p, "CR-DEMO-B")).toEqual(["SH-DEMO-004"]);
    expect(route(p, "CR-DEMO-B")?.distanceKm).toBe(110);
    expect(p.status).toBe("eligible");
    expect(p.dispatchAllowed).toBe(false);
  });
});
