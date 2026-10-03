"use client";
// Connected P1 journey: Company (BestExit) → Customer (SecondLook) → Transaction → Delivery (LoadLink).
// Every feature also has its own standalone page (/bestexit, /secondlook, /loadlink) using the same sections.
import { useCallback, useEffect, useState } from "react";
import type { Knowable, Money, MoneyRange } from "@contracts";
import type { ScenarioView } from "@platform/view";

type Focus = "bestexit" | "secondlook" | "loadlink" | undefined;
type ApiErr = { code: string; message: string };

const usd = (m: Money | null | undefined) => (m ? `${m.amountMinor < 0 ? "-" : ""}$${(Math.abs(m.amountMinor) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—");
const range = (r: MoneyRange | null) => (r ? `${usd(r.low)} – ${usd(r.high)}` : "—");
const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET" : "unknown time");

function K({ k, yes = "yes", no = "no" }: { k: Knowable<boolean> | null | undefined; yes?: string; no?: string }) {
  if (!k) return <span className="badge b-plain">n/a</span>;
  if (k.state === "known") return <span className={`badge ${k.value ? "b-ok" : "b-bad"}`}>{k.value ? yes : no}</span>;
  if (k.state === "unknown") return <span className="badge b-unk" title={k.reason}>unknown ({k.reason.replace(/_/g, " ")})</span>;
  return <span className="badge b-plain">not applicable</span>;
}
const Stale = ({ x }: { x: { freshness: string; staleReasons: string[] } | null }) =>
  x && x.freshness !== "fresh" ? <div className="banner b-warn" role="status"><strong>Out of date:</strong> {x.staleReasons.join("; ")}. Recompute to update — the old result stays in history.</div> : null;
const ErrorBox = ({ e }: { e: ApiErr | undefined }) =>
  e ? <div className={`banner ${e.code === "CAPABILITY_UNAVAILABLE" ? "b-unk" : "b-bad"}`} role="alert"><strong>{e.code === "CAPABILITY_UNAVAILABLE" ? "Not available yet" : "Error"}:</strong> {e.message}</div> : null;

export default function Journey({ focus }: { focus?: Focus }) {
  const [v, setV] = useState<ScenarioView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, ApiErr | undefined>>({});
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/v1/platform/state", { cache: "no-store" });
    const j = await r.json();
    if (j.data) { setV(j.data); setNote((n) => n || j.data.newNoteTemplate); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const act = async (key: string, path: string, body: unknown = {}) => {
    setBusy(key); setErrors((e) => ({ ...e, [key]: undefined }));
    try {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.error) setErrors((e) => ({ ...e, [key]: j.error }));
      if (j.data) setV(j.data); else await refresh();
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: { code: "NETWORK", message: String(err) } }));
    } finally { setBusy(null); }
  };

  if (!v) return <main><p className="muted">Loading scenario…</p></main>;
  const show = (s: Exclude<Focus, undefined>) => !focus || focus === s;
  const vehicle = v.vehicle;
  const val = v.valuation?.result;
  const pass = v.passport?.result;
  const plan = v.plan?.result;
  const confirmable = (pass?.interpretation?.findings ?? []).filter((f) => f.field?.startsWith("/handling/") && typeof f.proposedValue === "boolean" && (f.evidenceStatus === "supported" || f.evidenceStatus === "conflicting"))
    .filter((f) => { const cur = vehicle.handling[f.field!.split("/")[2] as keyof typeof vehicle.handling]; return !(cur.state === "known" && cur.value === f.proposedValue); });

  return (
    <main>
      <header className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>VehicleOS <span className="muted small">P1 MVP</span></h1>
          <div className="muted small">Concept for a combined ACV + Copart platform (transaction announced, not closed). All data below is synthetic.</div>
        </div>
        <div className="row">
          <span className="badge b-warn">SIMULATION · {v.scenarioId} · {local(v.now)}</span>
          <span className={`badge ${v.model.configured ? "b-info" : "b-unk"}`}>{v.model.configured ? `Live model: ${v.model.modelId}` : "No API key: SecondLook uses authored replay"}</span>
          <button className="secondary" onClick={() => act("reset", "/api/v1/platform/scenario/reset")} disabled={!!busy}>Reset scenario</button>
        </div>
      </header>
      {focus && <p><a href="/">← Connected journey</a> · standalone {focus} view</p>}

      {!focus && (
        <section className="grid3" aria-label="Pillars">
          <div className="panel"><h2>Database / company</h2>
            <div className="feature"><a href="/bestexit"><strong>BestExit</strong></a> <span className="badge b-ok">P1</span><div className="small muted">Net-proceeds disposition comparison</div></div>
          </div>
          <div className="panel"><h2>Customer features</h2>
            <div className="feature"><a href="/secondlook"><strong>SecondLook</strong></a> <span className="badge b-ok">P1</span><div className="small muted">Evidence interpretation + next inspection (AI)</div></div>
            <div className="feature"><strong>RightBuyer</strong> <span className="badge b-plain">P2 · planned</span></div>
            <div className="feature"><strong>PartsBridge</strong> <span className="badge b-plain">P3 · planned</span></div>
          </div>
          <div className="panel"><h2>Delivery / routing</h2>
            <div className="feature"><a href="/loadlink"><strong>LoadLink</strong></a> <span className="badge b-ok">P1</span><div className="small muted">Equipment-aware pooled routing</div></div>
            <div className="feature"><strong>ReadyToMove</strong> <span className="badge b-plain">P3 · planned</span><div className="small muted">Foundation minimal readiness check used instead</div></div>
          </div>
        </section>
      )}

      <section className="panel" aria-label="Vehicle">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><strong>{vehicle.vehicleId}</strong> <span className="badge b-info">revision {vehicle.revision}</span> · {vehicle.year} {vehicle.make} {vehicle.model} · VIN <span className="mono">{vehicle.vin}</span> <span className="muted small">(synthetic)</span></div>
          <div className="small muted">Seller: Synthetic Dealer &amp; Rebuilder 1 · Seller lot</div>
        </div>
        <div className="row small" style={{ marginTop: 6 }}>
          Starts engine <K k={vehicle.handling.startsEngine} /> Drivable <K k={vehicle.handling.drivable} /> Keys present <K k={vehicle.handling.keysPresent} /> Title <span className="badge b-plain">{vehicle.titleBrand.state === "known" ? vehicle.titleBrand.value : "unknown"}</span>
          {vehicle.changeReason === "reviewed_correction" && <span className="badge b-info">human-confirmed correction</span>}
        </div>
      </section>

      {show("bestexit") && (
        <section className="panel" aria-label="BestExit">
          <h2><span className="stepnum">1</span>Company · BestExit — where does the seller net the most?</h2>
          <div className="row">
            <button onClick={() => act("bestexit", "/api/v1/bestexit/valuations")} disabled={!!busy}>{busy === "bestexit" ? "Calculating…" : val ? "Recompute net outcomes" : "Estimate net outcomes"}</button>
            <span className="small muted">Deterministic calculation from comparables, fees and a rate-card quote. No AI, no guaranteed offer.</span>
          </div>
          <ErrorBox e={errors.bestexit} /><Stale x={v.valuation} />
          {val && (<>
            <div className="tablewrap"><table>
              <thead><tr><th>Channel (simulated)</th><th>Eligibility</th><th>Gross mid</th><th>Seller pays</th><th>Seller net (mid)</th><th>Net range</th><th>Days to cash</th></tr></thead>
              <tbody>{val.channels.map((c) => (
                <tr key={c.channelId} className={val.recommendation?.channelId === c.channelId ? "rec" : ""}>
                  <td>{c.label}{val.recommendation?.channelId === c.channelId && <> <span className="badge b-ok">recommended</span></>}</td>
                  <td><span className={`badge ${c.eligibility === "eligible" ? "b-ok" : c.eligibility === "ineligible" ? "b-bad" : "b-unk"}`}>{c.eligibility}</span>{c.reviewRequired && <> <span className="badge b-warn">review</span></>}<div className="small muted">{c.eligibilityReason}</div></td>
                  <td>{c.gross.state === "known" ? usd(c.gross.value.mid) : <span className="badge b-unk">unknown</span>}</td>
                  <td className="small">{c.sellerLines.map((l, i) => <div key={i}>{l.label}: {l.amount.state === "known" ? usd(l.amount.value) : <span className="badge b-unk">unknown</span>}</div>)}</td>
                  <td><strong>{c.sellerNet ? usd(c.sellerNet.mid) : "—"}</strong></td>
                  <td className="small">{range(c.sellerNet)}</td>
                  <td className="small">{c.daysToCash}</td>
                </tr>))}</tbody>
            </table></div>
            {val.recommendation && <p><strong>Why:</strong> {val.recommendation.rationale}</p>}
            <p className="small">Seller floor (confidential): {usd({ amountMinor: v.sellerFloorMinor, currency: "USD" })} — met? <K k={val.meetsSellerFloor} /></p>
            {val.changeFromPrevious && <div className="banner b-info"><strong>Why the recommendation changed:</strong><ul className="clean">{val.changeFromPrevious.reasons.map((r, i) => <li key={i}><span className="mono">{r.code}</span> — {r.detail}</li>)}</ul></div>}
            {val.meta.warnings.map((w, i) => <div key={i} className="small badge b-unk">{w.message}</div>)}
            <p className="small muted">{val.valuationId} · vehicle r{val.vehicleRef.revision} · evidence rev {val.meta.evidenceCollectionRevision} · {val.meta.dataMode} · buyer-paid costs are never subtracted from seller net</p>
          </>)}
        </section>
      )}

      {show("secondlook") && (
        <section className="panel" aria-label="SecondLook">
          <h2><span className="stepnum">2</span>Customer · SecondLook — what does the evidence actually say?</h2>
          <h3>Evidence (append-only)</h3>
          <div className="tablewrap"><table>
            <thead><tr><th>ID</th><th>Kind / source</th><th>Observed</th><th>Text</th></tr></thead>
            <tbody>{v.evidence.map((e) => <tr key={e.evidenceId}><td className="mono">{e.evidenceId}</td><td className="small">{e.kind.replace(/_/g, " ")}<div className="muted">{e.sourceOrganization} (simulated) · {e.trustLevel.replace("_", " ")}</div></td><td className="small">{local(e.observedAt)}</td><td>{e.text}</td></tr>)}</tbody>
          </table></div>
          <h3>New inspector note</h3>
          <label className="small muted" htmlFor="note">Edit to show an altered input, then add it to the evidence record.</label>
          <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="secondary" onClick={() => act("evidence", "/api/v1/platform/evidence", { text: note })} disabled={!!busy || note.trim().length < 5}>Add inspector note</button>
            <button onClick={() => act("secondlook", "/api/v1/secondlook/passports", { mode: "live" })} disabled={!!busy || !v.model.configured}>{busy === "secondlook" ? `${v.model.provider} is reading the evidence…` : `Interpret with ${v.model.provider} (live)`}</button>
            <button className="secondary" onClick={() => act("secondlook", "/api/v1/secondlook/passports", { mode: "replay" })} disabled={!!busy}>Use authored replay</button>
          </div>
          <ErrorBox e={errors.evidence} /><ErrorBox e={errors.secondlook} /><Stale x={v.passport} />
          {pass && (<>
            <div className="row" style={{ marginTop: 8 }}>
              {pass.modelRun.authored ? <span className="badge b-unk">Authored example — not a model output</span>
                : pass.interpretationState === "model" ? <span className="badge b-info">Live model {pass.modelRun.modelId} · {(pass.modelRun.latencyMs / 1000).toFixed(1)} s{pass.modelRun.usage ? ` · ${pass.modelRun.usage.inputTokens}+${pass.modelRun.usage.outputTokens} tokens` : ""}</span>
                  : <span className="badge b-warn">Rules only — model {pass.modelRun.status.replace("_", " ")}{pass.modelRun.error ? `: ${pass.modelRun.error}` : ""}</span>}
              <span className="small muted">prompt {pass.modelRun.promptVersion} · {pass.passportId}</span>
            </div>
            {pass.interpretation && pass.interpretation.findings.length > 0 && (
              <div className="tablewrap"><table>
                <thead><tr><th>Finding</th><th>Evidence status</th><th>Severity</th><th>Supported by</th><th>Contradicted by</th><th>As of</th></tr></thead>
                <tbody>{pass.interpretation.findings.map((f, i) => (
                  <tr key={i}><td>{f.text}{f.field && <div className="small mono muted">{f.field} = {String(f.proposedValue)}</div>}</td>
                    <td><span className={`badge ${f.evidenceStatus === "supported" ? "b-ok" : f.evidenceStatus === "conflicting" ? "b-warn" : f.evidenceStatus === "contradicted" ? "b-bad" : "b-unk"}`}>{f.evidenceStatus}</span></td>
                    <td className="small">{f.severity}</td><td className="mono small">{f.supportingEvidenceIds.join(", ")}</td><td className="mono small">{f.contradictingEvidenceIds.join(", ") || "—"}</td><td className="small">{local(f.observedAt)}</td></tr>))}</tbody>
              </table></div>)}
            {pass.interpretation && pass.interpretation.unknowns.length > 0 && <p><strong>Still unknown:</strong> {pass.interpretation.unknowns.map((u) => <span key={u.field} className="badge b-unk" style={{ marginRight: 6 }}>{u.field} ({u.reason.replace(/_/g, " ")})</span>)}</p>}
            {pass.modelRun.droppedClaims.length > 0 && <p className="small"><strong>Dropped (failed citation check):</strong> {pass.modelRun.droppedClaims.join("; ")}</p>}
            <h3>Next inspection checks (deterministic ranking)</h3>
            <ol className="clean">{pass.nextChecks.map((c) => <li key={c.checkCode}><strong>{c.label}</strong> <span className="mono small">{c.checkCode}</span> — {c.decisionImpact}</li>)}</ol>
            {confirmable.length > 0 && (
              <div className="banner b-info">
                <strong>Reviewer decision:</strong> the model only proposes. Confirming creates vehicle revision {vehicle.revision + 1} and makes dependent results stale.
                <div className="row" style={{ marginTop: 6 }}>
                  <button onClick={() => act("confirm", "/api/v1/platform/vehicles/V-DEMO-001/revisions", { expectedRevision: vehicle.revision, changes: confirmable.map((f) => ({ path: f.field, value: f.proposedValue })), evidenceIds: [...new Set(confirmable.flatMap((f) => f.supportingEvidenceIds))] })} disabled={!!busy}>
                    Confirm {confirmable.map((f) => `${f.field!.split("/")[2]} = ${String(f.proposedValue)}`).join(", ")} into vehicle record
                  </button>
                </div>
              </div>)}
            <ErrorBox e={errors.confirm} />
          </>)}
        </section>
      )}

      {!focus && (
        <section className="panel" aria-label="Transaction">
          <h2><span className="stepnum">3</span>Transaction — simulated deal and shipment</h2>
          <div className="row">
            <button onClick={() => act("deal", "/api/v1/platform/deals")} disabled={!!busy}>Confirm simulated deal with Synthetic Rebuilder 201</button>
            <span className="small muted">Price = recommended channel&apos;s gross mid from the current valuation. No real sale is created.</span>
          </div>
          <ErrorBox e={errors.deal} />
          {v.deal && v.journeyShipment && (<>
            <div className="grid3" style={{ marginTop: 8 }}>
              <div className="feature"><div className="small muted">Sale price (simulated)</div><strong>{usd(v.deal.deal.price)}</strong></div>
              <div className="feature"><div className="small muted">Seller proceeds (price − seller fee)</div><strong>{usd(v.deal.sellerProceeds)}</strong></div>
              <div className="feature"><div className="small muted">Buyer landed cost (price + buyer fee + transport)</div><strong>{usd(v.deal.buyerLanded)}</strong><div className="small muted">{v.deal.buyerTransport?.basis}</div></div>
            </div>
            <p className="small"><strong>{v.journeyShipment.shipmentId}</strong> needs: {v.journeyShipment.requiredEquipment.map((e) => <span key={e} className={`badge ${e === "winch" ? "b-warn" : "b-plain"}`} style={{ marginRight: 4 }}>{e.replace(/_/g, " ")}</span>)} — {v.journeyShipment.requirementBasis.join(" ")}</p>
            {(() => { const r = v.readiness.find((x) => x.shipmentId === v.journeyShipment!.shipmentId)!; return (
              <div><strong>Release readiness:</strong> <span className={`badge ${r.decision === "ready" ? "b-ok" : r.decision === "blocked" ? "b-bad" : "b-unk"}`}>{r.label}</span> <span className="small muted">provider {r.providerId} (ReadyToMove not installed)</span>
                <ul className="clean small">{r.gates.map((g) => <li key={g.kind}>{g.kind.replace(/_/g, " ")}: <span className={`badge ${g.state === "clear" ? "b-ok" : g.state === "blocked" ? "b-bad" : g.state === "unknown" ? "b-unk" : "b-plain"}`}>{g.state.replace("_", " ")}</span> {g.basis}</li>)}</ul></div>); })()}
          </>)}
        </section>
      )}

      {show("loadlink") && (
        <section className="panel" aria-label="LoadLink">
          <h2><span className="stepnum">4</span>Delivery · LoadLink — which truck can actually move it?</h2>
          <div className="row">
            <button onClick={() => act("loadlink", "/api/v1/loadlink/plans")} disabled={!!busy}>{plan ? "Re-plan routes" : "Plan routes"}</button>
            <label className="row small"><input type="checkbox" checked={v.winchOutOfService} onChange={(e) => act("fleet", "/api/v1/platform/fleet", { winchOutOfService: e.target.checked })} disabled={!!busy} /> Truck B winch out of service</label>
            <span className="small muted">Pools ACV- and Copart-tagged shipments. Time windows not checked in this MVP.</span>
          </div>
          <ErrorBox e={errors.loadlink} /><ErrorBox e={errors.fleet} /><Stale x={v.plan} />
          {plan && (<>
            <p><span className={`badge ${plan.status === "eligible" ? "b-ok" : "b-warn"}`}>{plan.status === "provisional" ? "Provisional — readiness unknown for some work" : "Eligible in simulation"}</span> <span className="badge b-bad">Not dispatchable (simulation)</span> <span className="small muted">{plan.routePlanId}</span></p>
            <div className="grid3">{plan.routes.map((r) => (
              <div key={r.resourceId} className="feature"><strong>{r.resourceId}</strong> · {r.distanceKm} km
                <ol className="clean small">{r.stops.map((s, i) => <li key={i}>{s.kind === "pickup" ? "Pick up" : "Deliver"} <span className="mono">{s.shipmentId}</span> @ {s.locationId.replace("L-DEMO-", "")}</li>)}</ol></div>))}
            </div>
            {plan.unassigned.length > 0 && <><h3>Unassigned work (explicit, not hidden)</h3><ul className="clean">{plan.unassigned.map((u) => <li key={u.shipmentId}><span className="mono">{u.shipmentId}</span> <span className="badge b-bad">{u.reason.replace(/_/g, " ")}</span> {u.detail}</li>)}</ul></>}
          </>)}
        </section>
      )}

      {!focus && (
        <section className="panel" aria-label="Event log">
          <h2>Event trail</h2>
          <ul className="clean small">{v.log.map((l, i) => <li key={i}><span className="muted">{local(l.at)}</span> <span className="mono">{l.event}</span> — {l.detail}</li>)}</ul>
        </section>
      )}
      <footer className="small muted">Demo foundation — simulated data — not production. No real bid, payment, title, reservation or dispatch is ever created.</footer>
    </main>
  );
}
