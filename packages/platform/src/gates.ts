// GATES-1.0.0 minimal readiness provider (plan §5.2). Missing facts are "unknown", never "clear".
// LoadLink depends on this foundation provider, not on ReadyToMove.
import type { Location, ReleaseReadiness, ReadinessGate, ShipmentRequest } from "@contracts";
import type { FactKind } from "@fixtures/shared/seed";

type Fact = { factId: string; shipmentId: string; kind: FactKind; observedAt: string };

export function evaluateReadiness(s: ShipmentRequest, facts: Fact[], origin: Location): ReleaseReadiness {
  const mine = facts.filter((f) => f.shipmentId === s.shipmentId);
  const latest = (k: FactKind) => mine.filter((f) => f.kind === k).sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  const gates: ReadinessGate[] = [];

  if (s.purpose !== "sale_delivery") {
    gates.push({ kind: "policy", state: "unknown", basis: `No release policy covers purpose '${s.purpose}'.` });
  } else {
    gates.push({ kind: "policy", state: "clear", basis: "RP-DEMO-SALE-DELIVERY v1 (synthetic policy)." });
    const paid = latest("payment_received");
    const reversed = latest("payment_reversed");
    gates.push(
      reversed && (!paid || reversed.observedAt > paid.observedAt)
        ? { kind: "payment", state: "blocked", basis: `Payment reversed (${reversed.factId}).` }
        : paid
          ? { kind: "payment", state: "clear", basis: `Payment received (${paid.factId}).` }
          : { kind: "payment", state: "unknown", basis: "No payment fact recorded." },
    );
    const title = latest("title_received");
    gates.push(title ? { kind: "title_documents", state: "clear", basis: `Title received (${title.factId}).` } : { kind: "title_documents", state: "unknown", basis: "No title fact. A delay is unknown, not a ban." });
    if (origin.kind === "yard") {
      const gate = latest("facility_release_issued");
      gates.push(gate ? { kind: "facility_release", state: "clear", basis: `Gate pass ${gate.factId}.` } : { kind: "facility_release", state: "unknown", basis: "No facility release recorded." });
    } else {
      gates.push({ kind: "facility_release", state: "not_applicable", basis: "Origin is the seller's own lot (synthetic policy)." });
    }
    const loadKnown = s.cargo.cargoType === "vehicle" && s.drivable?.state === "known" && s.keysPresent?.state === "known";
    gates.push(loadKnown ? { kind: "loading_eligibility", state: "clear", basis: "Drivability and keys are known." } : { kind: "loading_eligibility", state: "unknown", basis: "Keys and/or drivability unknown — confirm at pickup." });
  }

  const decision = gates.some((g) => g.state === "blocked") ? "blocked" : gates.every((g) => g.state === "clear" || g.state === "not_applicable") ? "ready" : "unknown";
  return {
    shipmentId: s.shipmentId,
    shipmentRevision: s.revision,
    decision,
    gates,
    policyId: s.purpose === "sale_delivery" ? "RP-DEMO-SALE-DELIVERY" : null,
    providerId: "platform.readiness.minimal",
    dispatchAllowed: false,
    label: decision === "ready" ? "Ready in this simulation (not dispatchable)" : decision === "blocked" ? "Blocked" : "Unknown — provisional only",
  };
}
