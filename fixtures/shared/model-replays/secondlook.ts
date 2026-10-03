// AUTHORED examples (not model outputs) for the SecondLook replay path. The UI must label them
// "Authored example — not a model output". Replace with a recorded live run once a key exists.
import type { Interpretation } from "@contracts";

export const REPLAYS: Record<"case-a" | "case-b", Interpretation> = {
  "case-a": {
    findings: [
      { system: "powertrain", field: "/handling/startsEngine", proposedValue: true, text: "Engine started at yard check-in; seller states it runs and drives.", evidenceStatus: "supported", severity: "unknown", supportingEvidenceIds: ["EV-001-INTAKE", "EV-001-SELLER"], contradictingEvidenceIds: [], observedAt: "2026-09-15T13:10:00Z" },
      { system: "body", field: null, proposedValue: null, text: "Rear bumper cover scuff, approx. 8 cm.", evidenceStatus: "supported", severity: "minor", supportingEvidenceIds: ["EV-001-CR", "EV-001-SELLER"], contradictingEvidenceIds: [], observedAt: "2026-09-20T15:00:00Z" },
    ],
    unknowns: [{ field: "/handling/keysPresent", reason: "not_observed", evidenceIds: ["EV-001-INTAKE", "EV-001-SELLER"] }],
    abstain: false,
    abstainReason: null,
  },
  "case-b": {
    findings: [
      { system: "powertrain", field: "/handling/startsEngine", proposedValue: false, text: "Newest direct inspection: cranks but does not start after 3 attempts. Older intake observation and seller statement said it ran.", evidenceStatus: "conflicting", severity: "unknown", supportingEvidenceIds: ["EV-001-INSP-2"], contradictingEvidenceIds: ["EV-001-INTAKE", "EV-001-SELLER"], observedAt: "2026-10-05T13:20:00Z" },
      { system: "powertrain", field: "/handling/drivable", proposedValue: false, text: "Vehicle was pushed to the bay, so it is not currently drivable.", evidenceStatus: "conflicting", severity: "unknown", supportingEvidenceIds: ["EV-001-INSP-2"], contradictingEvidenceIds: ["EV-001-INTAKE", "EV-001-SELLER"], observedAt: "2026-10-05T13:20:00Z" },
      { system: "body", field: null, proposedValue: null, text: "Rear bumper cover scuff, approx. 8 cm.", evidenceStatus: "supported", severity: "minor", supportingEvidenceIds: ["EV-001-CR", "EV-001-SELLER"], contradictingEvidenceIds: [], observedAt: "2026-09-20T15:00:00Z" },
    ],
    unknowns: [{ field: "/handling/keysPresent", reason: "not_observed", evidenceIds: ["EV-001-INSP-2", "EV-001-INTAKE", "EV-001-SELLER"] }],
    abstain: false,
    abstainReason: null,
  },
};
