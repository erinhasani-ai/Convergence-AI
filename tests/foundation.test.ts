// Foundation tests: deterministic rules every module relies on.
import { describe, expect, it } from "vitest";
import { sum, transportQuote, usd } from "@platform/money";
import { requiredEquipment } from "@platform/handling";
import { readinessFor } from "@platform/scenario";
import { allShipments, v1, v2 } from "./helpers";

describe("money and quotes", () => {
  it("prices the fixture lanes exactly (QUOTE-1.0.0)", () => {
    expect(transportQuote(180, ["vehicle_slot_open"]).price.amountMinor).toBe(40200);
    expect(transportQuote(180, ["vehicle_slot_open", "winch"]).price.amountMinor).toBe(57700);
    expect(transportQuote(225, ["vehicle_slot_open", "winch"]).price.amountMinor).toBe(64000);
  });
  it("refuses non-integer money and unsupported cargo", () => {
    expect(() => usd(10.5)).toThrow();
    expect(() => transportQuote(10, ["parcel_space"])).toThrow(/unsupported_input/);
    expect(sum([usd(100), usd(-50)]).amountMinor).toBe(50);
  });
});

describe("handling and readiness", () => {
  it("adds a winch only when drivable is known false", () => {
    expect(requiredEquipment(v1).equipment).toEqual(["vehicle_slot_open"]);
    expect(requiredEquipment(v2).equipment).toEqual(["vehicle_slot_open", "winch"]);
  });
  it("evaluates seeded shipments with the minimal provider (no ReadyToMove needed)", () => {
    const r = Object.fromEntries(readinessFor(allShipments()).map((x) => [x.shipmentId, x]));
    expect(r["SH-S01-0001"].decision).toBe("unknown");
    expect(r["SH-DEMO-002"].decision).toBe("ready");
    expect(r["SH-DEMO-004"].gates.find((g) => g.kind === "facility_release")?.state).toBe("not_applicable");
    expect(r["SH-DEMO-005"].decision).toBe("blocked");
    expect(r["SH-DEMO-006"].decision).toBe("unknown");
    expect(Object.values(r).every((x) => x.dispatchAllowed === false)).toBe(true);
  });
});
