// VehicleOS shared contracts (P1 MVP subset of plan §5). One vocabulary for every module.
import { z } from "zod";

export const CONTRACT_VERSION = "1.0.0";

// ---- identifiers & references ----
export type Id = string;
export type EntityRef = { entityType: string; id: Id; revision: number };

// ---- money: integer minor units + ISO currency; never add different currencies ----
export type Money = { amountMinor: number; currency: "USD" };
export type MoneyRange = { low: Money; mid: Money; high: Money };
export type Payer = "seller" | "buyer" | "platform" | "carrier";

// ---- unknown is distinct from false / zero / ineligible ----
export type Knowable<T> =
  | { state: "known"; value: T; sourceIds: Id[] }
  | { state: "unknown"; reason: "not_observed" | "conflicting_sources" | "not_supplied" | "insufficient_evidence"; sourceIds: Id[] }
  | { state: "not_applicable"; basis: string };

export type DataMode = "synthetic" | "live" | "mixed";
export type Freshness = "fresh" | "stale" | "expired";

export type ArtifactMeta = {
  contractVersion: string;
  dataMode: DataMode;
  runtimeMode: "demo" | "live";
  scenarioId: Id;
  providerId: string;
  generatedAt: string;
  inputRefs: EntityRef[];
  evidenceCollectionRevision: number;
  engine: { name: string; version: string };
  warnings: { code: string; message: string }[];
};

// ---- foundation records ----
export type Location = { locationId: Id; label: string; kind: "seller_lot" | "yard" | "buyer_site" | "carrier_base"; region: string };

export type VehicleSnapshot = {
  vehicleId: Id;
  revision: number;
  vin: string;
  year: number;
  make: string;
  model: string;
  bodyClass: "compact_suv" | "sedan";
  odometerMeters: Knowable<number>;
  titleBrand: Knowable<"clean" | "salvage">;
  handling: {
    startsEngine: Knowable<boolean>;
    drivable: Knowable<boolean>;
    rolls: Knowable<boolean>;
    keysPresent: Knowable<boolean>;
  };
  locationId: Id;
  fieldProvenance: { path: string; method: "fixture" | "human_confirmed"; evidenceIds: Id[]; confirmedBy: Id | null; at: string }[];
  changeReason: "intake" | "reviewed_correction";
  createdAt: string;
};

export type EvidenceKind = "yard_intake_observation" | "condition_report" | "seller_statement" | "inspection_note";
export type EvidenceRecord = {
  evidenceId: Id;
  vehicleId: Id;
  kind: EvidenceKind;
  sourceOrganization: "ACV" | "COPART" | "VEHICLEOS";
  observedAt: string | null;
  ingestedAt: string;
  text: string;
  trustLevel: "unverified" | "source_attested";
};

export type CostLine = { kind: "seller_fee" | "buyer_fee" | "transport"; label: string; payer: Payer; amount: Knowable<Money>; basis: string };

export type ChannelId = "acv_wholesale_auction" | "copart_wholesale_auction" | "copart_salvage_auction" | "international_export";

export type ChannelScenario = {
  channelId: ChannelId;
  label: string;
  eligibility: "eligible" | "ineligible" | "unknown";
  eligibilityReason: string;
  reviewRequired: boolean;
  gross: Knowable<MoneyRange>;
  sellerLines: CostLine[];
  buyerLines: CostLine[];
  sellerNet: MoneyRange | null;
  daysToCash: string;
};

export type ValuationResult = {
  valuationId: Id;
  vehicleRef: EntityRef;
  status: "recommendation" | "insufficient_evidence";
  channels: ChannelScenario[];
  recommendation: { channelId: ChannelId; rationale: string } | null;
  meetsSellerFloor: Knowable<boolean>;
  changeFromPrevious: { previousId: Id; reasons: { code: string; detail: string }[] } | null;
  meta: ArtifactMeta;
};

// ---- SecondLook: model output contract (validated server-side, then post-processed by rules) ----
export const CANONICAL_FIELDS = [
  "/handling/startsEngine",
  "/handling/drivable",
  "/handling/rolls",
  "/handling/keysPresent",
  "/odometerMeters",
  "/titleBrand",
] as const;

export const InterpretationSchema = z.object({
  findings: z.array(
    z.object({
      system: z.enum(["powertrain", "electrical", "body", "frame", "undercarriage", "interior", "tires_wheels", "keys_access", "odometer"]),
      field: z.string().nullable(),
      proposedValue: z.union([z.string(), z.number(), z.boolean()]).nullable(),
      text: z.string(),
      evidenceStatus: z.enum(["supported", "contradicted", "conflicting", "unknown"]),
      severity: z.enum(["minor", "moderate", "severe", "unknown"]),
      supportingEvidenceIds: z.array(z.string()),
      contradictingEvidenceIds: z.array(z.string()),
      observedAt: z.string().nullable(),
    }),
  ),
  unknowns: z.array(z.object({ field: z.string(), reason: z.string(), evidenceIds: z.array(z.string()) })),
  abstain: z.boolean(),
  abstainReason: z.string().nullable(),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

export type CheckCode = "IC-START-CHARGE" | "IC-KEYS-CONFIRM" | "IC-UNDERCARRIAGE" | "IC-ODO-VERIFY";
export type NextCheck = { checkCode: CheckCode; label: string; rank: number; rationale: string; decisionImpact: string };

export type ModelRunInfo = {
  modelRunId: Id;
  mode: "live" | "replay";
  authored: boolean; // true = hand-written example, not a model output
  modelId: string | null;
  promptVersion: string;
  status: "succeeded" | "schema_failed" | "refused" | "provider_error" | "not_configured";
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
  droppedClaims: string[];
  error: string | null;
};

export type ConditionPassport = {
  passportId: Id;
  vehicleRef: EntityRef;
  interpretation: Interpretation | null;
  interpretationState: "model" | "replay" | "rules_only";
  nextChecks: NextCheck[];
  modelRun: ModelRunInfo;
  meta: ArtifactMeta;
};

// ---- transaction & delivery ----
export type Equipment = "vehicle_slot_open" | "winch" | "parcel_space";

export type DealSnapshot = {
  dealId: Id;
  vehicleRef: EntityRef;
  buyerId: Id;
  price: Money;
  buyerFee: Money;
  sellerFee: Money;
  status: "confirmed";
  simulated: true;
  valuationId: Id | null;
};

export type ShipmentRequest = {
  shipmentId: Id;
  revision: number;
  dealId: Id | null;
  purpose: "sale_delivery" | "parts_delivery";
  cargo: { cargoType: "vehicle"; vehicleRef: EntityRef } | { cargoType: "parts_package"; packageId: Id; massKg: number };
  originId: Id;
  destinationId: Id;
  requiredEquipment: Equipment[];
  requirementBasis: string[];
  keysPresent: Knowable<boolean> | null;
  drivable: Knowable<boolean> | null;
};

export type GateKind = "policy" | "payment" | "title_documents" | "facility_release" | "loading_eligibility";
export type ReadinessGate = { kind: GateKind; state: "clear" | "blocked" | "unknown" | "not_applicable"; basis: string };
export type ReleaseReadiness = {
  shipmentId: Id;
  shipmentRevision: number;
  decision: "ready" | "blocked" | "unknown";
  gates: ReadinessGate[];
  policyId: Id | null;
  providerId: "platform.readiness.minimal";
  dispatchAllowed: false; // demo runtime can never authorize dispatch
  label: string;
};

export type CarrierResource = { resourceId: Id; label: string; vehicleSlots: number; equipment: Equipment[]; homeBaseId: Id };

export type RouteStop = { kind: "pickup" | "delivery"; shipmentId: Id; locationId: Id };
export type UnassignedWork = {
  shipmentId: Id;
  reason: "no_capable_equipment" | "capacity" | "readiness_blocked" | "cargo_type_unsupported";
  detail: string;
};
export type RoutePlan = {
  routePlanId: Id;
  status: "provisional" | "eligible";
  routes: { resourceId: Id; stops: RouteStop[]; distanceKm: number }[];
  unassigned: UnassignedWork[];
  feasibility: { capacity: "pass"; equipment: "pass"; pickupBeforeDelivery: "pass"; timeWindows: "not_checked" };
  readiness: ReleaseReadiness[];
  dispatchAllowed: false;
  meta: ArtifactMeta;
};

export type ApiError = { code: "VALIDATION_FAILED" | "CONFLICT" | "NOT_FOUND" | "CAPABILITY_UNAVAILABLE" | "INTERNAL"; message: string; details?: Record<string, unknown> };
