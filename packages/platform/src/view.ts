// Read model for the journey page. Freshness is computed here at read time from pinned revisions.
import "server-only";
import type { ConditionPassport, RoutePlan, ValuationResult } from "@contracts";
import { COMPANY, NEW_INSPECTOR_NOTE, SCENARIO_ID, distanceKm } from "@fixtures/shared/seed";
import { MODEL_ID, PROVIDER_LABEL, modelConfigured } from "./ai/gateway";
import { transportQuote, usd } from "./money";
import { readinessFor } from "./scenario";
import { store } from "./store";

export function scenarioView() {
  const val = store.current<ValuationResult>("valuation");
  const pass = store.current<ConditionPassport>("passport");
  const plan = store.current<RoutePlan>("plan");
  const deal = store.deal();
  const shipments = store.shipments();
  const journey = shipments.find((s) => s.shipmentId === "SH-S01-0001") ?? null;
  const journeyQuote = journey ? transportQuote(distanceKm(journey.originId, journey.destinationId), journey.requiredEquipment) : null;
  return {
    scenarioId: SCENARIO_ID,
    now: store.now(),
    model: { configured: modelConfigured(), modelId: MODEL_ID, provider: PROVIDER_LABEL },
    vehicle: store.vehicle(),
    evidence: store.evidence(),
    versions: store.versions(),
    newNoteTemplate: NEW_INSPECTOR_NOTE.text,
    sellerFloorMinor: COMPANY.minimumAcceptableNetMinor,
    valuation: val && { result: val.result, ...store.freshness(val.pins, ["vehicle", "evidence"]) },
    passport: pass && { result: pass.result, ...store.freshness(pass.pins, ["vehicle", "evidence"]) },
    deal: deal && {
      deal,
      sellerProceeds: usd(deal.price.amountMinor - deal.sellerFee.amountMinor),
      buyerLanded: journeyQuote ? usd(deal.price.amountMinor + deal.buyerFee.amountMinor + journeyQuote.price.amountMinor) : null,
      buyerTransport: journeyQuote,
    },
    journeyShipment: journey,
    readiness: readinessFor(shipments),
    plan: plan && { result: plan.result, ...store.freshness(plan.pins, ["fleet", "shipments", "vehicle"]) },
    winchOutOfService: store.winchOutOfService(),
    log: store.eventLog(),
  };
}
export type ScenarioView = ReturnType<typeof scenarioView>;
