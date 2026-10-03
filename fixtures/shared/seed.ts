// Synthetic, coordinated scenario data (plan §6.5). Every value here is SIMULATED.
// "Fixture Motors" is a fictional make; VINs use an unassigned 0FX prefix with a valid check digit.
import type { CarrierResource, EvidenceRecord, Location, VehicleSnapshot, Knowable } from "@contracts";

export const SCENARIO_ID = "S-P1-CONNECTED-01";
export const AS_OF = "2026-10-05T14:00:00Z"; // fixed scenario clock; displayed in America/New_York
export const TENANT_ID = "T-DEMO";

const known = <T,>(value: T, sourceIds: string[] = []): Knowable<T> => ({ state: "known", value, sourceIds });
const unknown = <T,>(reason: "not_observed" | "conflicting_sources" | "not_supplied", sourceIds: string[] = []): Knowable<T> => ({ state: "unknown", reason, sourceIds });

export const LOCATIONS: Location[] = [
  { locationId: "L-DEMO-DEPOT", label: "Carrier depot", kind: "carrier_base", region: "US-NY" },
  { locationId: "L-DEMO-SELLER-LOT", label: "Seller lot", kind: "seller_lot", region: "US-NY" },
  { locationId: "L-DEMO-YARD-N", label: "Yard North", kind: "yard", region: "US-NY" },
  { locationId: "L-DEMO-BUYER-101", label: "Buyer 101 (franchise dealer)", kind: "buyer_site", region: "US-NY" },
  { locationId: "L-DEMO-BUYER-201", label: "Buyer 201 (rebuilder)", kind: "buyer_site", region: "US-NY" },
  { locationId: "L-DEMO-BUYER-401", label: "Buyer 401 (dismantler)", kind: "buyer_site", region: "US-NY" },
];

// DM-DEMO-1 (km). Fixture matrix, not road data.
const ORDER = ["L-DEMO-DEPOT", "L-DEMO-SELLER-LOT", "L-DEMO-YARD-N", "L-DEMO-BUYER-101", "L-DEMO-BUYER-201", "L-DEMO-BUYER-401"];
const KM = [
  [0, 40, 150, 60, 200, 120],
  [40, 0, 180, 70, 225, 160],
  [150, 180, 0, 140, 110, 60],
  [60, 70, 140, 0, 210, 130],
  [200, 225, 110, 210, 0, 95],
  [120, 160, 60, 130, 95, 0],
];
export function distanceKm(from: string, to: string): number {
  const i = ORDER.indexOf(from);
  const j = ORDER.indexOf(to);
  if (i < 0 || j < 0) throw new Error(`No fixture distance for ${from} -> ${to}`);
  return KM[i][j];
}

// RC-DEMO-AUTO-1 (USD minor units)
export const RATE_CARD = { rateCardId: "RC-DEMO-AUTO-1", baseMinor: 15000, perKmMinor: 140, minimumMinor: 20000, winchMinor: 17500 };

export const COMPANY = {
  companyId: "CO-DEMO-SELLER",
  name: "Synthetic Dealer & Rebuilder 1",
  minimumAcceptableNetMinor: 1200000, // confidential seller floor
};

export const CHANNELS = {
  acv_wholesale_auction: { label: "ACV-style digital wholesale auction (simulated)", sellerFeeMinor: 35000, buyerFeeMinor: 42500, transportPayer: "buyer" as const, daysToCash: "3–7 days" },
  copart_wholesale_auction: { label: "Copart-style yard wholesale auction (simulated)", sellerFeeMinor: 61000, buyerFeeMinor: 52000, transportPayer: "seller" as const, daysToCash: "10–21 days" },
  copart_salvage_auction: { label: "Copart-style salvage auction (simulated)", sellerFeeMinor: 45000, buyerFeeMinor: 60000, transportPayer: "seller" as const, daysToCash: "14–28 days" },
  international_export: { label: "International export (simulated)", sellerFeeMinor: 0, buyerFeeMinor: 0, transportPayer: "seller" as const, daysToCash: "unknown" },
};

// Comparable sales: compact SUVs 2017–2019 sold 2026-07-10..2026-09-30 (synthetic)
type Comp = { id: string; channel: keyof typeof CHANNELS; drivable: boolean; priceMinor: number };
export const COMPARABLES: Comp[] = [
  ...[1360000, 1420000, 1470000].map((p, i) => ({ id: `CMP-A-R-${i + 1}`, channel: "acv_wholesale_auction" as const, drivable: true, priceMinor: p })),
  ...[1410000, 1475000, 1530000].map((p, i) => ({ id: `CMP-B-R-${i + 1}`, channel: "copart_wholesale_auction" as const, drivable: true, priceMinor: p })),
  ...[1070000, 1130000, 1180000].map((p, i) => ({ id: `CMP-A-N-${i + 1}`, channel: "acv_wholesale_auction" as const, drivable: false, priceMinor: p })),
  ...[1140000, 1205000, 1260000].map((p, i) => ({ id: `CMP-B-N-${i + 1}`, channel: "copart_wholesale_auction" as const, drivable: false, priceMinor: p })),
  ...[960000, 1010000, 1060000].map((p, i) => ({ id: `CMP-C-N-${i + 1}`, channel: "copart_salvage_auction" as const, drivable: false, priceMinor: p })),
];

const fx = (path: string) => ({ path, method: "fixture" as const, evidenceIds: [], confirmedBy: null, at: AS_OF });

export function seedVehicles(): VehicleSnapshot[] {
  const base = { make: "Fixture Motors", fieldProvenance: [fx("/")], changeReason: "intake" as const, createdAt: "2026-09-15T13:10:00Z" };
  const runner = (id: string, vin: string, year: number, model: string, bodyClass: "compact_suv" | "sedan", miles: number, loc: string): VehicleSnapshot => ({
    ...base, vehicleId: id, revision: 1, vin, year, model, bodyClass,
    odometerMeters: known(Math.round(miles * 1609.344)), titleBrand: known("clean"),
    handling: { startsEngine: known(true), drivable: known(true), rolls: known(true), keysPresent: known(true) },
    locationId: loc,
  });
  return [
    {
      ...base, vehicleId: "V-DEMO-001", revision: 1, vin: "0FXSU2A43JD000001", year: 2018, model: "Strata EX AWD", bodyClass: "compact_suv",
      odometerMeters: known(Math.round(58400 * 1609.344), ["EV-001-CR"]), titleBrand: known("clean", ["EV-001-CR"]),
      handling: {
        startsEngine: known(true, ["EV-001-INTAKE", "EV-001-SELLER"]),
        drivable: known(true, ["EV-001-INTAKE", "EV-001-SELLER"]),
        rolls: known(true, ["EV-001-INTAKE"]),
        keysPresent: unknown("not_observed", ["EV-001-INTAKE", "EV-001-SELLER"]), // the one fact that stays unknown everywhere
      },
      locationId: "L-DEMO-SELLER-LOT",
    },
    {
      ...base, vehicleId: "V-DEMO-002", revision: 1, vin: "0FXSD4B25FD000002", year: 2015, model: "Dray SE", bodyClass: "sedan",
      odometerMeters: known(Math.round(112300 * 1609.344)), titleBrand: known("salvage"),
      handling: { startsEngine: known(false), drivable: known(false), rolls: known(true), keysPresent: known(true) },
      locationId: "L-DEMO-YARD-N",
    },
    runner("V-DEMO-004", "0FXSU2A49JD000004", 2018, "Strata", "compact_suv", 44100, "L-DEMO-YARD-N"),
    runner("V-DEMO-005", "0FXSD4B27HD000005", 2017, "Dray", "sedan", 71800, "L-DEMO-SELLER-LOT"),
    runner("V-DEMO-006", "0FXSU2A40KD000006", 2019, "Strata", "compact_suv", 30900, "L-DEMO-SELLER-LOT"),
  ];
}

export function seedEvidence(): EvidenceRecord[] {
  return [
    { evidenceId: "EV-001-INTAKE", vehicleId: "V-DEMO-001", kind: "yard_intake_observation", sourceOrganization: "COPART", observedAt: "2026-09-15T13:10:00Z", ingestedAt: "2026-09-15T13:30:00Z", trustLevel: "source_attested", text: "Check-in: engine started; vehicle driven to row 14. Keys: see office." },
    { evidenceId: "EV-001-CR", vehicleId: "V-DEMO-001", kind: "condition_report", sourceOrganization: "ACV", observedAt: "2026-09-20T15:00:00Z", ingestedAt: "2026-09-20T16:00:00Z", trustLevel: "source_attested", text: "Rear bumper cover scuff approx. 8 cm. No cluster warning lights noted. Paint meter max 210 microns. Minimum tire tread 5 mm. Odometer 58,400 mi." },
    { evidenceId: "EV-001-SELLER", vehicleId: "V-DEMO-001", kind: "seller_statement", sourceOrganization: "VEHICLEOS", observedAt: "2026-09-28T16:30:00Z", ingestedAt: "2026-09-28T16:31:00Z", trustLevel: "unverified", text: "Runs and drives fine. Small scrape on rear bumper. Should have both keys somewhere." },
  ];
}

// The new inspector note added live in the demo (editable in the UI to show altered input).
export const NEW_INSPECTOR_NOTE = {
  evidenceId: "EV-001-INSP-2",
  observedAt: "2026-10-05T13:20:00Z",
  text: "Cranks, no start after 3 attempts. Battery 12.5 V at rest. Fuel gauge reads 1/4. Pushed to bay 3. Keys not located in vehicle; office closed.",
};

export const BUYERS = {
  "B-DEMO-201": { label: "Synthetic Rebuilder 201", locationId: "L-DEMO-BUYER-201" },
  "B-DEMO-101": { label: "Synthetic Franchise Dealer 101", locationId: "L-DEMO-BUYER-101" },
  "B-DEMO-401": { label: "Synthetic Dismantler 401", locationId: "L-DEMO-BUYER-401" },
} as const;

export const CARRIERS: CarrierResource[] = [
  { resourceId: "CR-DEMO-A", label: "Truck A — 3-car open wedge", vehicleSlots: 3, equipment: ["vehicle_slot_open"], homeBaseId: "L-DEMO-DEPOT" },
  { resourceId: "CR-DEMO-B", label: "Truck B — 2-car wedge with winch", vehicleSlots: 2, equipment: ["vehicle_slot_open", "winch"], homeBaseId: "L-DEMO-DEPOT" },
];

// Release facts (simulated) for pre-seeded shipments SH-DEMO-002..006.
export type FactKind = "payment_received" | "payment_reversed" | "title_received" | "facility_release_issued";
export const SEED_FACTS: { factId: string; shipmentId: string; kind: FactKind; observedAt: string }[] = [
  { factId: "RF-002-PAY", shipmentId: "SH-DEMO-002", kind: "payment_received", observedAt: "2026-10-04T15:00:00Z" },
  { factId: "RF-002-TITLE", shipmentId: "SH-DEMO-002", kind: "title_received", observedAt: "2026-10-04T15:00:00Z" },
  { factId: "RF-002-GATE", shipmentId: "SH-DEMO-002", kind: "facility_release_issued", observedAt: "2026-10-05T09:00:00Z" },
  { factId: "RF-003-PAY", shipmentId: "SH-DEMO-003", kind: "payment_received", observedAt: "2026-10-04T15:00:00Z" },
  { factId: "RF-003-TITLE", shipmentId: "SH-DEMO-003", kind: "title_received", observedAt: "2026-10-04T15:00:00Z" },
  { factId: "RF-003-GATE", shipmentId: "SH-DEMO-003", kind: "facility_release_issued", observedAt: "2026-10-05T09:00:00Z" },
  { factId: "RF-004-PAY", shipmentId: "SH-DEMO-004", kind: "payment_received", observedAt: "2026-10-04T15:00:00Z" },
  { factId: "RF-004-TITLE", shipmentId: "SH-DEMO-004", kind: "title_received", observedAt: "2026-10-04T15:00:00Z" },
  { factId: "RF-005-PAY", shipmentId: "SH-DEMO-005", kind: "payment_received", observedAt: "2026-10-03T15:00:00Z" },
  { factId: "RF-005-REV", shipmentId: "SH-DEMO-005", kind: "payment_reversed", observedAt: "2026-10-04T18:00:00Z" },
];
