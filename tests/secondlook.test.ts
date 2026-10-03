// SecondLook acceptance tests (docs/mvp/02-secondlook-mvp.md). Owner: Person B. Replay mode = deterministic.
import { describe, expect, it } from "vitest";
import type { Interpretation } from "@contracts";
import type { GatewayRequest, ModelGateway } from "@platform/ai/gateway";
import { gateway } from "@platform/ai/gateway";
import { buildPassport } from "@modules/secondlook/passport";
import { evidenceA, evidenceB, v1 } from "./helpers";

const input = (evidence = evidenceA, mode: "live" | "replay" = "replay") => ({ vehicle: v1, evidence, evidenceCollectionRevision: evidence.length, passportId: "CP-TEST", generatedAt: "2026-10-05T14:00:00Z", mode });
const fake = (output: Interpretation | null, seen: GatewayRequest[] = []): ModelGateway => ({
  async interpret(req) {
    seen.push(req);
    return { output, run: { modelRunId: "MR-FAKE", mode: "live", authored: false, modelId: "fake", promptVersion: req.promptVersion, status: output ? "succeeded" : "provider_error", latencyMs: 1, usage: null, droppedClaims: [], error: output ? null : "fake failure" } };
  },
});
const finding = (p: Awaited<ReturnType<typeof buildPassport>>, field: string) => p.interpretation?.findings.find((f) => f.field === field);

describe("SecondLook replay cases", () => {
  it("case A: engine starts (supported), keys unknown, keys check first", async () => {
    const p = await buildPassport(input(evidenceA), gateway);
    expect(p.interpretationState).toBe("replay");
    expect(p.modelRun.authored).toBe(true);
    expect(finding(p, "/handling/startsEngine")).toMatchObject({ proposedValue: true, evidenceStatus: "supported" });
    expect(p.interpretation?.unknowns.map((u) => u.field)).toContain("/handling/keysPresent");
    expect(p.nextChecks.map((c) => c.checkCode)).toEqual(["IC-KEYS-CONFIRM", "IC-UNDERCARRIAGE"]);
  });
  it("case B: new note flips starts-engine to conflicting false, keys stay unknown, start/charge check first", async () => {
    const p = await buildPassport(input(evidenceB), gateway);
    const f = finding(p, "/handling/startsEngine");
    expect(f).toMatchObject({ proposedValue: false, evidenceStatus: "conflicting" });
    expect(f?.supportingEvidenceIds).toContain("EV-001-INSP-2");
    expect(f?.contradictingEvidenceIds).toContain("EV-001-INTAKE");
    expect(p.interpretation?.findings.some((x) => x.field === "/handling/keysPresent" && x.proposedValue === false)).toBe(false);
    expect(p.nextChecks.map((c) => c.checkCode)).toEqual(["IC-START-CHARGE", "IC-KEYS-CONFIRM", "IC-UNDERCARRIAGE"]);
  });
});

describe("SecondLook rules around the model", () => {
  it("sends evidence as documents with their IDs and picks the replay key from the evidence", async () => {
    const seen: GatewayRequest[] = [];
    await buildPassport(input(evidenceB, "replay"), fake({ findings: [], unknowns: [], abstain: true, abstainReason: "test" }, seen));
    expect(seen[0].documents.map((d) => d.sourceId)).toEqual(evidenceB.map((e) => e.evidenceId));
    expect(seen[0].replayKey).toBe("case-b");
    expect(seen[0].promptVersion).toBe("sl-interpret-1.0.0");
  });
  it("drops findings whose citations are not input evidence", async () => {
    const p = await buildPassport(input(evidenceA, "live"), fake({
      findings: [{ system: "powertrain", field: "/handling/startsEngine", proposedValue: false, text: "made up", evidenceStatus: "supported", severity: "severe", supportingEvidenceIds: ["EV-NOT-REAL"], contradictingEvidenceIds: [], observedAt: null }],
      unknowns: [], abstain: false, abstainReason: null,
    }));
    expect(finding(p, "/handling/startsEngine")).toBeUndefined();
    expect(p.modelRun.droppedClaims.length).toBeGreaterThan(0);
  });
  it("falls back to rules only (no invented findings) when the model is unavailable", async () => {
    const p = await buildPassport(input(evidenceA, "live"), fake(null));
    expect(p.interpretationState).toBe("rules_only");
    expect(p.interpretation?.findings ?? []).toHaveLength(0);
    expect(p.nextChecks.map((c) => c.checkCode)).toEqual(["IC-KEYS-CONFIRM", "IC-UNDERCARRIAGE"]);
    expect(p.meta.warnings.some((w) => w.code === "MODEL_UNAVAILABLE")).toBe(true);
  });
});
