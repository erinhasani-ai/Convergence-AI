// OWNER: SecondLook (Person B). Deterministic post-processing of model output. Schema validity is not trusted
// as grounding: citations are checked against the actual input evidence and fields against CANONICAL_FIELDS.
import { CANONICAL_FIELDS, type EvidenceRecord, type Interpretation } from "@contracts";

type Finding = Interpretation["findings"][number];

export type ValidationResult = {
  interpretation: Interpretation;
  droppedClaims: string[];      // one short note per dropped finding or unknown
  removedCitations: string[];   // cited IDs that were not input evidence (removed from kept findings too)
};

const CANONICAL = new Set<string>(CANONICAL_FIELDS);
const KEYS_FIELD = "/handling/keysPresent";
// Explicit statements that keys do not exist / are lost. "not located", "see office" or "somewhere" do not match.
const EXPLICIT_NO_KEYS = /\bno keys?\b(?!\s+(?:were\s+|was\s+)?(?:located|found))|\bkeys?\s+(?:are\s+|is\s+)?(?:missing|lost|absent)\b|\bwithout\s+(?:any\s+)?keys?\b/i;

const label = (f: Finding) => `${f.field ?? f.system} ${f.proposedValue === null ? "" : `= ${String(f.proposedValue)} `}("${f.text.slice(0, 80)}")`;

export function validateInterpretation(output: Interpretation, evidence: EvidenceRecord[]): ValidationResult {
  const byId = new Map(evidence.map((e) => [e.evidenceId, e]));
  const droppedClaims: string[] = [];
  const removed = new Set<string>();
  const keep = (ids: string[]) => ids.filter((id) => (byId.has(id) ? true : (removed.add(id), false)));

  const findings: Finding[] = [];
  const extraUnknowns: Interpretation["unknowns"] = [];
  for (const f of output.findings) {
    if (f.field !== null && !CANONICAL.has(f.field)) {
      droppedClaims.push(`${label(f)}: field is not a canonical field`);
      keep([...f.supportingEvidenceIds, ...f.contradictingEvidenceIds]);
      continue;
    }
    const supporting = keep(f.supportingEvidenceIds);
    const contradicting = keep(f.contradictingEvidenceIds);
    if (supporting.length === 0) {
      droppedClaims.push(`${label(f)}: no supporting citation is input evidence${f.supportingEvidenceIds.length ? ` (cited ${f.supportingEvidenceIds.join(", ")})` : ""}`);
      continue;
    }
    // "Keys not located" is not "no keys": a false keys claim needs a cited document that explicitly says so.
    if (f.field === KEYS_FIELD && f.proposedValue === false && !supporting.some((id) => EXPLICIT_NO_KEYS.test(byId.get(id)!.text))) {
      droppedClaims.push(`${label(f)}: no cited evidence explicitly states the keys are absent; key status stays unknown`);
      extraUnknowns.push({ field: KEYS_FIELD, reason: "insufficient_evidence", evidenceIds: supporting });
      continue;
    }
    findings.push({ ...f, supportingEvidenceIds: supporting, contradictingEvidenceIds: contradicting });
  }

  const unknowns: Interpretation["unknowns"] = [];
  for (const u of [...output.unknowns, ...extraUnknowns]) {
    if (!CANONICAL.has(u.field)) {
      droppedClaims.push(`unknown "${u.field}": field is not a canonical field`);
      continue;
    }
    const evidenceIds = keep(u.evidenceIds);
    const existing = unknowns.find((x) => x.field === u.field);
    if (existing) existing.evidenceIds = [...new Set([...existing.evidenceIds, ...evidenceIds])];
    else unknowns.push({ ...u, evidenceIds });
  }

  return { interpretation: { ...output, findings, unknowns }, droppedClaims, removedCitations: [...removed] };
}
