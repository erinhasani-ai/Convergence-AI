// BestExit acceptance tests (docs/mvp/01-bestexit-mvp.md). Owner: Person A. Do not edit expected values.
import { describe, expect, it } from "vitest";
import type { ChannelId, ValuationResult } from "@contracts";
import { evaluateValuation } from "@modules/bestexit/valuation";
import { v1, v2 } from "./helpers";

const run = (vehicle = v1, previous: ValuationResult | null = null) =>
  evaluateValuation({ vehicle, evidenceCollectionRevision: 3, previous, valuationId: "VR-TEST", generatedAt: "2026-10-05T14:00:00Z" });
const ch = (r: ValuationResult, id: ChannelId) => r.channels.find((c) => c.channelId === id)!;
const net = (r: ValuationResult, id: ChannelId) => { const n = ch(r, id).sellerNet; return n && [n.low.amountMinor, n.mid.amountMinor, n.high.amountMinor]; };

describe("BestExit r1 (runs and drives)", () => {
  const r = run();
  it("computes seller net by channel to the cent", () => {
    expect(net(r, "acv_wholesale_auction")).toEqual([1325000, 1385000, 1435000]);
    expect(net(r, "copart_wholesale_auction")).toEqual([1308800, 1373800, 1428800]);
    expect(net(r, "copart_salvage_auction")).toBeNull();
    expect(net(r, "international_export")).toBeNull();
  });
  it("applies eligibility rules, with review separate from eligibility", () => {
    expect(ch(r, "acv_wholesale_auction").eligibility).toBe("eligible");
    expect(ch(r, "copart_salvage_auction").eligibility).toBe("ineligible");
    expect(ch(r, "international_export").eligibility).toBe("unknown");
    expect(ch(r, "international_export").reviewRequired).toBe(true);
  });
  it("recommends the cheaper-gross channel because its net is higher", () => {
    expect(r.recommendation?.channelId).toBe("acv_wholesale_auction");
    const gA = ch(r, "acv_wholesale_auction").gross; const gB = ch(r, "copart_wholesale_auction").gross;
    expect(gA.state === "known" && gB.state === "known" && gA.value.mid.amountMinor < gB.value.mid.amountMinor).toBe(true);
    expect(r.meetsSellerFloor).toMatchObject({ state: "known", value: true });
  });
  it("keeps buyer-paid costs out of seller net and never treats unknown as zero", () => {
    const a = ch(r, "acv_wholesale_auction");
    expect(a.sellerLines.every((l) => l.payer === "seller")).toBe(true);
    expect(a.buyerLines.find((l) => l.kind === "transport")?.amount.state).toBe("unknown");
    const b = ch(r, "copart_wholesale_auction").sellerLines.find((l) => l.kind === "transport");
    expect(b?.amount).toMatchObject({ state: "known", value: { amountMinor: 40200 } });
  });
  it("labels the keys unknown and fills meta", () => {
    expect(r.meta.warnings.some((w) => w.code === "FACT_UNKNOWN")).toBe(true);
    expect(r.meta).toMatchObject({ dataMode: "synthetic", runtimeMode: "demo", providerId: "bestexit" });
    expect(r.meta.inputRefs[0]).toMatchObject({ id: "V-DEMO-001", revision: 1 });
  });
});

describe("BestExit r2 (no-start confirmed)", () => {
  const r1 = run();
  const r = run(v2, r1);
  it("recomputes with nonrunner comparables and winch transport", () => {
    expect(net(r, "acv_wholesale_auction")).toEqual([1035000, 1095000, 1145000]);
    expect(net(r, "copart_wholesale_auction")).toEqual([1021300, 1086300, 1141300]);
    expect(net(r, "copart_salvage_auction")).toEqual([857300, 907300, 957300]);
    expect(ch(r, "copart_salvage_auction").eligibility).toBe("eligible");
  });
  it("explains why it changed and flags the seller floor", () => {
    expect(r.recommendation?.channelId).toBe("acv_wholesale_auction");
    expect(r.meetsSellerFloor).toMatchObject({ state: "known", value: false });
    const codes = r.changeFromPrevious?.reasons.map((x) => x.code) ?? [];
    expect(codes).toEqual(expect.arrayContaining(["INPUT_REVISED", "COMPARABLES_CHANGED", "COST_CHANGED", "ELIGIBILITY_CHANGED"]));
  });
});
