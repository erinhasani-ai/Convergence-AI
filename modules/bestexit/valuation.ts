// OWNER: BestExit (Person A). Frozen signature — implement the body. Spec: docs/mvp/01-bestexit-mvp.md
//
// Deterministic net-proceeds comparison across four simulated sale channels. No AI here.
// Seller net = gross − SELLER-paid lines only; buyer lines are shown but never subtracted.
// An unknown gross or unknown seller cost makes the net null — never zero.
import type {
  ChannelId, ChannelScenario, CostLine, Knowable, Money, MoneyRange, ValuationResult, VehicleSnapshot,
} from "@contracts";
import { CONTRACT_VERSION } from "@contracts";
import { CHANNELS, COMPANY, COMPARABLES, SCENARIO_ID, distanceKm } from "@fixtures/shared/seed";
import { formatUsd, sum, transportQuote, usd } from "@platform/money";
import { requiredEquipment } from "@platform/handling";

export type ValuationInput = {
  vehicle: VehicleSnapshot;          // exact revision to value (pinned)
  evidenceCollectionRevision: number; // pinned; recorded in meta
  previous: ValuationResult | null;  // last valuation for this vehicle, for "why it changed"
  valuationId: string;               // assigned by the platform
  generatedAt: string;               // scenario clock (ISO UTC)
};

const YARD = "L-DEMO-YARD-N";
const MIN_COMPARABLES = 3;

export function evaluateValuation(input: ValuationInput): ValuationResult {
  const { vehicle: v } = input;
  const channelIds = Object.keys(CHANNELS) as ChannelId[]; // table order = tie-break order

  const channels = channelIds.map((id) => evaluateChannel(id, v));

  let best: ChannelScenario | null = null;
  for (const c of channels) {
    if (c.eligibility !== "eligible" || !c.sellerNet) continue;
    if (!best || c.sellerNet.mid.amountMinor > best.sellerNet!.mid.amountMinor) best = c;
  }

  const warnings: ValuationResult["meta"]["warnings"] = [];
  if (v.handling.keysPresent.state !== "known") {
    warnings.push({ code: "FACT_UNKNOWN", message: "Keys present is unknown; no key cost assumed." });
  }

  const meetsSellerFloor: Knowable<boolean> = best
    ? { state: "known", value: best.sellerNet!.mid.amountMinor >= COMPANY.minimumAcceptableNetMinor, sourceIds: [] }
    : { state: "unknown", reason: "insufficient_evidence", sourceIds: [] };

  return {
    valuationId: input.valuationId,
    vehicleRef: { entityType: "VehicleSnapshot", id: v.vehicleId, revision: v.revision },
    status: best ? "recommendation" : "insufficient_evidence",
    channels,
    recommendation: best ? { channelId: best.channelId, rationale: rationale(best, channels) } : null,
    meetsSellerFloor,
    changeFromPrevious:
      input.previous && input.previous.vehicleRef.revision !== v.revision ? whyChanged(input.previous, channels, v) : null,
    meta: {
      contractVersion: CONTRACT_VERSION,
      dataMode: "synthetic",
      runtimeMode: "demo",
      scenarioId: SCENARIO_ID,
      providerId: "bestexit",
      generatedAt: input.generatedAt,
      inputRefs: [{ entityType: "VehicleSnapshot", id: v.vehicleId, revision: v.revision }],
      evidenceCollectionRevision: input.evidenceCollectionRevision,
      engine: { name: "BESTEXIT", version: "0.1.0" },
      warnings,
    },
  };
}

function evaluateChannel(id: ChannelId, v: VehicleSnapshot): ChannelScenario {
  const ch = CHANNELS[id];
  const { eligibility, eligibilityReason, reviewRequired } = eligibilityFor(id, v);
  const gross = grossRange(id, v);

  const sellerLines: CostLine[] = [
    { kind: "seller_fee", label: "Seller fee", payer: "seller", amount: known(usd(ch.sellerFeeMinor)), basis: "Simulated fee schedule" },
  ];
  const buyerLines: CostLine[] = [
    { kind: "buyer_fee", label: "Buyer fee", payer: "buyer", amount: known(usd(ch.buyerFeeMinor)), basis: "Simulated fee schedule" },
  ];
  if (ch.transportPayer === "seller") {
    const km = distanceKm(v.locationId, YARD);
    const q = transportQuote(km, requiredEquipment(v).equipment);
    sellerLines.push({ kind: "transport", label: `Transport to yard (${km} km)`, payer: "seller", amount: known(q.price), basis: q.basis });
  } else {
    buyerLines.push({
      kind: "transport", label: "Transport to buyer", payer: "buyer",
      amount: { state: "unknown", reason: "not_supplied", sourceIds: [] }, basis: "Buyer location not known at valuation time",
    });
  }

  return {
    channelId: id, label: ch.label, eligibility, eligibilityReason, reviewRequired, gross,
    sellerLines, buyerLines, sellerNet: sellerNet(gross, sellerLines), daysToCash: ch.daysToCash,
  };
}

function eligibilityFor(id: ChannelId, v: VehicleSnapshot): Pick<ChannelScenario, "eligibility" | "eligibilityReason" | "reviewRequired"> {
  const title = v.titleBrand.state === "known" ? v.titleBrand.value : null;
  const drivable = v.handling.drivable.state === "known" ? v.handling.drivable.value : null;
  const r = (eligibility: ChannelScenario["eligibility"], eligibilityReason: string, reviewRequired = false) =>
    ({ eligibility, eligibilityReason, reviewRequired });

  switch (id) {
    case "acv_wholesale_auction":
      if (title === null) return r("unknown", "Title brand is not established.");
      return title === "clean" ? r("eligible", "Clean title is accepted.") : r("ineligible", `${title} title is not accepted.`);
    case "copart_wholesale_auction":
      return title === null ? r("unknown", "Title brand is not established.") : r("eligible", `Known ${title} title is accepted.`);
    case "copart_salvage_auction":
      if (title === "salvage") return r("eligible", "Salvage title.");
      if (drivable === false) return r("eligible", "Vehicle is known not drivable.");
      if (title === "clean" && drivable === true) return r("ineligible", "Clean-title vehicle that drives does not qualify for salvage sale.");
      return r("unknown", "Title or drivability is not established.");
    case "international_export":
      return r("unknown", "No title-document evidence; export eligibility needs review.", true);
  }
}

/** (min, median, max) of comparables on the same channel with the same drivable state; ≥ 3 required. */
function grossRange(id: ChannelId, v: VehicleSnapshot): Knowable<MoneyRange> {
  const d = v.handling.drivable;
  if (d.state !== "known") return { state: "unknown", reason: "insufficient_evidence", sourceIds: [] };
  const comps = COMPARABLES.filter((c) => c.channel === id && c.drivable === d.value);
  if (comps.length < MIN_COMPARABLES) return { state: "unknown", reason: "insufficient_evidence", sourceIds: comps.map((c) => c.id) };
  const prices = comps.map((c) => c.priceMinor).sort((a, b) => a - b);
  const mid = prices.length % 2 ? prices[(prices.length - 1) / 2] : Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2);
  return {
    state: "known",
    value: { low: usd(prices[0]), mid: usd(mid), high: usd(prices[prices.length - 1]) },
    sourceIds: comps.map((c) => c.id),
  };
}

function sellerNet(gross: Knowable<MoneyRange>, lines: CostLine[]): MoneyRange | null {
  if (gross.state !== "known") return null;
  const amounts: Money[] = [];
  for (const l of lines) {
    if (l.amount.state !== "known") return null; // unknown seller cost → no net, never zero
    amounts.push(l.amount.value);
  }
  const cost = sum(amounts).amountMinor;
  const minus = (m: Money) => usd(m.amountMinor - cost);
  return { low: minus(gross.value.low), mid: minus(gross.value.mid), high: minus(gross.value.high) };
}

/** e.g. "Higher net despite $550.00 lower gross: no seller-paid transport, lower seller fee." */
function rationale(best: ChannelScenario, all: ChannelScenario[]): string {
  const bestGross = best.gross.state === "known" ? best.gross.value.mid.amountMinor : null;
  const rival = all
    .filter((c) => c !== best && c.eligibility === "eligible" && c.sellerNet && c.gross.state === "known" && bestGross !== null && c.gross.value.mid.amountMinor > bestGross)
    .sort((a, b) => b.sellerNet!.mid.amountMinor - a.sellerNet!.mid.amountMinor)[0];
  if (!rival || rival.gross.state !== "known" || bestGross === null) return "Highest seller net among eligible channels.";

  const reasons: string[] = [];
  const sellerTransport = (c: ChannelScenario) => c.sellerLines.some((l) => l.kind === "transport");
  const fee = (c: ChannelScenario) => {
    const l = c.sellerLines.find((x) => x.kind === "seller_fee");
    return l?.amount.state === "known" ? l.amount.value.amountMinor : 0;
  };
  if (!sellerTransport(best) && sellerTransport(rival)) reasons.push("no seller-paid transport");
  if (fee(best) < fee(rival)) reasons.push("lower seller fee");
  const gap = usd(rival.gross.value.mid.amountMinor - bestGross);
  return `Higher net despite ${formatUsd(gap)} lower gross${reasons.length ? `: ${reasons.join(", ")}` : ""}.`;
}

function whyChanged(prev: ValuationResult, next: ChannelScenario[], v: VehicleSnapshot): NonNullable<ValuationResult["changeFromPrevious"]> {
  const reasons: { code: string; detail: string }[] = [];
  const confirmed = v.fieldProvenance.filter((p) => p.method === "human_confirmed").map((p) => p.path);
  reasons.push({
    code: "INPUT_REVISED",
    detail: `Vehicle revision ${prev.vehicleRef.revision} → ${v.revision}${confirmed.length ? `: ${confirmed.join(", ")} confirmed by a reviewer` : ""}.`,
  });

  const before = new Map(prev.channels.map((c) => [c.channelId, c]));
  const ids = (k: Knowable<MoneyRange>) => ("sourceIds" in k ? k.sourceIds.join(",") : "");
  const compsChanged = next.filter((c) => before.has(c.channelId) && ids(before.get(c.channelId)!.gross) !== ids(c.gross));
  if (compsChanged.length) {
    const d = v.handling.drivable;
    const set = d.state === "known" ? (d.value ? "runner" : "non-runner") : "unknown";
    reasons.push({ code: "COMPARABLES_CHANGED", detail: `Now using ${set} comparables for ${compsChanged.map((c) => c.label).join("; ")}.` });
  }

  for (const c of next) {
    const old = before.get(c.channelId);
    const t0 = old?.sellerLines.find((l) => l.kind === "transport")?.amount;
    const t1 = c.sellerLines.find((l) => l.kind === "transport")?.amount;
    if (t0?.state === "known" && t1?.state === "known" && t0.value.amountMinor !== t1.value.amountMinor) {
      reasons.push({ code: "COST_CHANGED", detail: `${c.label}: seller transport ${formatUsd(t0.value)} → ${formatUsd(t1.value)}.` });
    }
  }

  const elig = next.filter((c) => before.has(c.channelId) && before.get(c.channelId)!.eligibility !== c.eligibility);
  if (elig.length) {
    reasons.push({
      code: "ELIGIBILITY_CHANGED",
      detail: elig.map((c) => `${c.label}: ${before.get(c.channelId)!.eligibility} → ${c.eligibility}`).join("; ") + ".",
    });
  }
  return { previousId: prev.valuationId, reasons };
}

function known<T>(value: T): Knowable<T> {
  return { state: "known", value, sourceIds: [] };
}
