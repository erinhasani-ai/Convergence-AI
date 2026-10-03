// OWNER: SecondLook (Person B). NEXTCHECK-0.1: deterministic next-inspection ranking.
// Runs on validated findings and canonical vehicle facts only; the model never ranks or chooses checks.
import type { CheckCode, Interpretation, NextCheck, VehicleSnapshot } from "@contracts";

export const NEXTCHECK_VERSION = "NEXTCHECK-0.1";

const DRIVABILITY_FIELDS = ["/handling/startsEngine", "/handling/drivable"];
const KEYS_FIELD = "/handling/keysPresent";

type Candidate = Omit<NextCheck, "rank">;

/** Rules in fixed priority order; each check appears at most once; ranks are 1..n. */
export function rankNextChecks(interpretation: Interpretation | null, vehicle: VehicleSnapshot): NextCheck[] {
  const out: Candidate[] = [];
  const add = (c: Candidate) => { if (!out.some((x) => x.checkCode === c.checkCode)) out.push(c); };

  // Rule 1: a drivability conflict decides transport equipment, so it outranks everything else.
  const conflicts = (interpretation?.findings ?? []).filter((f) => f.field !== null && DRIVABILITY_FIELDS.includes(f.field) && f.evidenceStatus === "conflicting");
  if (conflicts.length > 0) {
    add(check("IC-START-CHARGE", "Starting/charging diagnostic", "Resolves the drivability conflict; changes transport equipment (winch).",
      `Conflicting evidence on ${conflicts.map((f) => `${f.field} (supported by ${f.supportingEvidenceIds.join(", ")}; contradicted by ${f.contradictingEvidenceIds.join(", ") || "none"})`).join("; ")}.`));
  }

  // Rule 2: keys unresolved in the interpretation, or not known on the canonical vehicle record.
  const keysUnknownInInterpretation = (interpretation?.unknowns ?? []).some((u) => u.field === KEYS_FIELD);
  const keys = vehicle.handling.keysPresent;
  if (keysUnknownInInterpretation || keys.state !== "known") {
    const why = [
      keysUnknownInInterpretation ? "the evidence does not establish whether keys are present" : null,
      keys.state === "unknown" ? `vehicle r${vehicle.revision} records keysPresent as unknown (${keys.reason.replace(/_/g, " ")})` : null,
      keys.state === "not_applicable" ? `vehicle r${vehicle.revision} records keysPresent as not applicable (${keys.basis})` : null,
    ].filter(Boolean).join("; ");
    add(check("IC-KEYS-CONFIRM", "Locate and count keys", "Changes loading eligibility and key-requiring buyers.", `Key status is unresolved: ${why}.`));
  }

  // Rule 3: MVP scenario has no undercarriage evidence, so this is always proposed, always last.
  add(check("IC-UNDERCARRIAGE", "Undercarriage imaging", "Narrows the value range.", "No undercarriage evidence is on record for this vehicle."));

  return out.map((c, i) => ({ ...c, rank: i + 1 }));
}

const check = (checkCode: CheckCode, label: string, decisionImpact: string, rationale: string): Candidate => ({ checkCode, label, decisionImpact, rationale });
