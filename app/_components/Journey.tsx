"use client";
// Connected P1 journey: Company (BestExit) → Customer (SecondLook) → Transaction → Delivery (LoadLink).
// Every feature also has its own standalone page (/bestexit, /secondlook, /loadlink) using the same sections.
import { Fragment, useCallback, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Knowable, Money, MoneyRange } from "@contracts";
import type { ScenarioView } from "@platform/view";

type Focus = "bestexit" | "secondlook" | "loadlink" | undefined;
type ApiErr = { code: string; message: string };
type Tone = "green" | "amber" | "red" | "violet" | "blue" | "gray";
type Fresh = { freshness: string; staleReasons: string[] } | null;
type StepState = "todo" | "done" | "stale";
type Step = { id: string; n: number; label: string; sub: string; state: StepState };

const usd = (m: Money | null | undefined) => (m ? `${m.amountMinor < 0 ? "-" : ""}$${(Math.abs(m.amountMinor) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—");
const range = (r: MoneyRange | null) => (r ? `${usd(r.low)} – ${usd(r.high)}` : "—");
const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET" : "unknown time");
const words = (s: string) => s.replace(/_/g, " ");

const ICONS = {
  check: "M5 12.5l4.2 4.2L19 7",
  alert: "M12 9v4M12 16.5v.01M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  info: "M12 11v5M12 7.5v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  clock: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  person: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5a7.5 7.5 0 0115 0",
} as const;
const Icon = ({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);
const Pill = ({ tone, children, dot = true, title }: { tone: Tone; children: ReactNode; dot?: boolean; title?: string }) => (
  <span className={`pill t-${tone}${dot ? "" : " no-dot"}`} title={title}>{children}</span>
);
const Callout = ({ tone, icon, role, children }: { tone: Tone; icon: keyof typeof ICONS; role?: string; children: ReactNode }) => (
  <div className={`callout t-${tone}`} role={role}><Icon name={icon} /><div className="callout-body">{children}</div></div>
);
function Btn({ kind = "primary", size, busy = false, icon, children, ...rest }: { kind?: "primary" | "tinted" | "plain"; size?: "sm"; busy?: boolean; icon?: keyof typeof ICONS } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn btn-${kind}${size ? ` btn-${size}` : ""}`} {...rest}>{busy ? <span className="spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={16} />}{children}</button>;
}

function K({ k, yes = "Yes", no = "No" }: { k: Knowable<boolean> | null | undefined; yes?: string; no?: string }) {
  if (!k) return <Pill tone="gray">n/a</Pill>;
  if (k.state === "known") return <Pill tone={k.value ? "green" : "red"}>{k.value ? yes : no}</Pill>;
  if (k.state === "unknown") return <Pill tone="violet" title={k.reason}>Unknown · {words(k.reason)}</Pill>;
  return <Pill tone="gray">Not applicable</Pill>;
}
const Stale = ({ x }: { x: Fresh }) =>
  x && x.freshness !== "fresh" ? <Callout tone="amber" icon="clock" role="status"><strong>Out of date.</strong> {x.staleReasons.join("; ")}. Recompute to update — the old result stays in history.</Callout> : null;
const ErrorBox = ({ e }: { e: ApiErr | undefined }) =>
  e ? (e.code === "CAPABILITY_UNAVAILABLE"
    ? <Callout tone="violet" icon="info" role="alert"><strong>Not available yet.</strong> {e.message}</Callout>
    : <Callout tone="red" icon="alert" role="alert"><strong>Error.</strong> {e.message}</Callout>) : null;

const stateOf = (x: Fresh): StepState => (!x ? "todo" : x.freshness === "fresh" ? "done" : "stale");
const STATUS: Record<StepState | "current", { tone: Tone; text: string }> = {
  done: { tone: "green", text: "Done" }, stale: { tone: "amber", text: "Out of date" }, current: { tone: "blue", text: "Up next" }, todo: { tone: "gray", text: "Not started" },
};
const statusKey = (s: Step, current: boolean) => (s.state === "todo" && current ? "current" : s.state);
const StepDot = ({ s, current }: { s: Step; current: boolean }) => {
  const key = statusKey(s, current);
  return <span className={`dot-step ${key === "todo" ? "" : key}`} aria-hidden="true">{s.state === "done" ? <Icon name="check" size={18} /> : s.state === "stale" ? "!" : s.n}</span>;
};
function StepHead({ s, current, kicker, title, how }: { s: Step; current: boolean; kicker: string; title: string; how: string }) {
  const st = STATUS[statusKey(s, current)];
  return (
    <div className="step-head">
      <StepDot s={s} current={current} />
      <div><p className="step-kicker">{kicker}</p><h2 className="step-title">{title}</h2><p className="step-how">{how}</p></div>
      <span className="step-status"><Pill tone={st.tone}>{st.text}</Pill></span>
    </div>
  );
}

const NAV: { href: string; label: string; focus: Focus }[] = [
  { href: "/", label: "Journey", focus: undefined }, { href: "/bestexit", label: "BestExit", focus: "bestexit" },
  { href: "/secondlook", label: "SecondLook", focus: "secondlook" }, { href: "/loadlink", label: "LoadLink", focus: "loadlink" },
];
const HERO: Record<"journey" | Exclude<Focus, undefined>, { title: string; lede: string }> = {
  journey: { title: "One car, from appraisal to delivery.", lede: "VehicleOS is a concept for a combined ACV + Copart platform (transaction announced, not closed). Follow one synthetic vehicle through four steps that share a single record: value it, inspect it, sell it, deliver it." },
  bestexit: { title: "BestExit", lede: "Where does the seller net the most? A deterministic comparison of what the seller actually keeps on each channel." },
  secondlook: { title: "SecondLook", lede: "What does the evidence actually say? AI reads every note and cites its sources; a person confirms before the record changes." },
  loadlink: { title: "LoadLink", lede: "Which truck can actually move it? Equipment-aware routing across ACV- and Copart-tagged work." },
};

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

  const topbar = (
    <header className="topbar">
      <div className="topbar-inner">
        <a href="/" className="brand"><span className="brand-mark" aria-hidden="true">V</span>VehicleOS</a>
        <nav className="segmented" aria-label="Views">
          {NAV.map((n) => <a key={n.href} href={n.href} aria-current={n.focus === focus ? "page" : undefined}>{n.label}</a>)}
        </nav>
        {v && (
          <div className="topbar-actions">
            {v.model.configured ? <Pill tone="green">{v.model.provider} live · {v.model.modelId}</Pill> : <Pill tone="violet">No API key · replay only</Pill>}
            <Btn kind="plain" size="sm" onClick={() => act("reset", "/api/v1/platform/scenario/reset")} disabled={!!busy}>Reset scenario</Btn>
          </div>
        )}
      </div>
    </header>
  );

  if (!v) return (<>{topbar}<main className="container"><p className="sr-only" role="status">Loading scenario…</p><div className="hero"><div className="skeleton" style={{ height: 120 }} /></div><div className="skeleton" /></main></>);

  const show = (s: Exclude<Focus, undefined>) => !focus || focus === s;
  const vehicle = v.vehicle;
  const val = v.valuation?.result;
  const pass = v.passport?.result;
  const plan = v.plan?.result;
  const confirmable = (pass?.interpretation?.findings ?? []).filter((f) => f.field?.startsWith("/handling/") && typeof f.proposedValue === "boolean" && (f.evidenceStatus === "supported" || f.evidenceStatus === "conflicting"))
    .filter((f) => { const cur = vehicle.handling[f.field!.split("/")[2] as keyof typeof vehicle.handling]; return !(cur.state === "known" && cur.value === f.proposedValue); });

  const steps: Step[] = [
    { id: "bestexit", n: 1, label: "Value", sub: "BestExit", state: stateOf(v.valuation) },
    { id: "secondlook", n: 2, label: "Inspect", sub: "SecondLook", state: stateOf(v.passport) },
    { id: "deal", n: 3, label: "Sell", sub: "Simulated deal", state: v.deal ? "done" : "todo" },
    { id: "loadlink", n: 4, label: "Deliver", sub: "LoadLink", state: stateOf(v.plan) },
  ];
  const currentId = steps.find((s) => s.state !== "done")?.id;
  const step = (id: string) => steps.find((s) => s.id === id)!;
  const hero = HERO[focus ?? "journey"];

  return (
    <>
      {topbar}
      <main className="container">
        <section className="hero">
          <p className="eyebrow"><span className="pill t-amber">Simulation</span>{v.scenarioId} · {local(v.now)}</p>
          <h1>{hero.title}</h1>
          <p className="lede">{hero.lede}</p>
        </section>

        <div className="stack">
          {!focus && (
            <nav className="card tracker" aria-label="Journey progress">
              {steps.map((s) => {
                const cur = s.id === currentId;
                return (
                  <a key={s.id} href={`#${s.id}`} className={cur ? "is-current" : ""} aria-current={cur ? "step" : undefined}>
                    <StepDot s={s} current={cur} />
                    <span><span className="tracker-label">{s.n}. {s.label}</span><span className="tracker-sub">{s.sub} · {STATUS[statusKey(s, cur)].text}</span></span>
                  </a>
                );
              })}
            </nav>
          )}

          <section className="card" aria-label="Vehicle">
            <div className="vehicle-head">
              <div>
                <p className="fine">{vehicle.vehicleId} · Seller: Synthetic Dealer &amp; Rebuilder 1 · Seller lot</p>
                <h2 className="vehicle-title">{vehicle.year} {vehicle.make} {vehicle.model}</h2>
                <p className="fine">VIN <span className="mono">{vehicle.vin}</span> · synthetic</p>
              </div>
              <div className="row">
                <Pill tone="blue">Revision {vehicle.revision}</Pill>
                {vehicle.changeReason === "reviewed_correction" && <Pill tone="blue">Human-confirmed correction</Pill>}
              </div>
            </div>
            <div className="facts">
              <div className="fact"><span className="fact-label">Starts engine</span><span><K k={vehicle.handling.startsEngine} /></span></div>
              <div className="fact"><span className="fact-label">Drivable</span><span><K k={vehicle.handling.drivable} /></span></div>
              <div className="fact"><span className="fact-label">Keys present</span><span><K k={vehicle.handling.keysPresent} /></span></div>
              <div className="fact"><span className="fact-label">Title</span><span><Pill tone="gray">{vehicle.titleBrand.state === "known" ? vehicle.titleBrand.value : "unknown"}</Pill></span></div>
            </div>
          </section>

          {show("bestexit") && (
            <section id="bestexit" className="card" aria-label="BestExit">
              <StepHead s={step("bestexit")} current={currentId === "bestexit"} kicker="Step 1 · Company · BestExit" title="Where does the seller net the most?"
                how="Compares what the seller actually keeps on each channel, after fees and transport, using comparables and a rate-card quote." />
              <div className="actions">
                <Btn busy={busy === "bestexit"} onClick={() => act("bestexit", "/api/v1/bestexit/valuations")} disabled={!!busy}>{busy === "bestexit" ? "Calculating…" : val ? "Recompute net outcomes" : "Estimate net outcomes"}</Btn>
                <span className="fine">Deterministic calculation from comparables, fees and a rate-card quote. No AI, no guaranteed offer.</span>
              </div>
              <ErrorBox e={errors.bestexit} /><Stale x={v.valuation} />
              {val && (<>
                <h3 className="section-title">Net outcome by channel <span className="faint">· simulated</span></h3>
                <div className="grid">
                  {val.channels.map((c) => {
                    const rec = val.recommendation?.channelId === c.channelId;
                    return (
                      <article key={c.channelId} className={`tile channel${rec ? " is-rec" : ""}`}>
                        <div className="row spread"><span className="channel-name">{c.label}</span>{rec && <Pill tone="green">Recommended</Pill>}</div>
                        <div>
                          <div className="metric-label">Seller net (mid)</div>
                          <div className="metric-value">{c.sellerNet ? usd(c.sellerNet.mid) : "—"}</div>
                          <div className="metric-sub">Range {range(c.sellerNet)}</div>
                        </div>
                        <div className="row">
                          <Pill tone={c.eligibility === "eligible" ? "green" : c.eligibility === "ineligible" ? "red" : "violet"}>{c.eligibility}</Pill>
                          {c.reviewRequired && <Pill tone="amber">Needs review</Pill>}
                        </div>
                        <p className="fine">{c.eligibilityReason}</p>
                        <div className="divider" />
                        <dl className="kv">
                          <dt>Gross (mid)</dt><dd>{c.gross.state === "known" ? usd(c.gross.value.mid) : <Pill tone="violet">unknown</Pill>}</dd>
                          {c.sellerLines.map((l, i) => <Fragment key={i}><dt>{l.label}</dt><dd>{l.amount.state === "known" ? `−${usd(l.amount.value)}` : <Pill tone="violet">unknown</Pill>}</dd></Fragment>)}
                          <dt>Days to cash</dt><dd>{c.daysToCash}</dd>
                        </dl>
                      </article>
                    );
                  })}
                </div>
                {val.recommendation && <Callout tone="green" icon="check"><strong>Why this channel:</strong> {val.recommendation.rationale}</Callout>}
                <div className="row" style={{ marginTop: 16 }}>
                  <span className="small">Seller floor (confidential) <span className="num">{usd({ amountMinor: v.sellerFloorMinor, currency: "USD" })}</span> · met?</span> <K k={val.meetsSellerFloor} />
                </div>
                {val.changeFromPrevious && (
                  <Callout tone="blue" icon="info"><strong>Why the recommendation changed</strong>
                    <ul>{val.changeFromPrevious.reasons.map((r, i) => <li key={i}><span className="chip">{r.code}</span> {r.detail}</li>)}</ul>
                  </Callout>
                )}
                {val.meta.warnings.map((w, i) => <Callout key={i} tone="violet" icon="info">{w.message}</Callout>)}
                <p className="fine" style={{ marginTop: 16 }}>{val.valuationId} · vehicle r{val.vehicleRef.revision} · evidence rev {val.meta.evidenceCollectionRevision} · {val.meta.dataMode} · buyer-paid costs are never subtracted from seller net</p>
              </>)}
            </section>
          )}

          {show("secondlook") && (
            <section id="secondlook" className="card" aria-label="SecondLook">
              <StepHead s={step("secondlook")} current={currentId === "secondlook"} kicker="Step 2 · Customer · SecondLook" title="What does the evidence actually say?"
                how="AI reads every note and must cite its sources. Conflicts and unknowns stay visible, and a person confirms before the vehicle record changes." />
              <h3 className="section-title">Evidence <span className="faint">· append-only</span></h3>
              <ul className="list">
                {v.evidence.map((e) => (
                  <li key={e.evidenceId} id={`ev-${e.evidenceId}`}>
                    <div className="list-meta">
                      <span className="mono">{e.evidenceId}</span><span>·</span><span>{words(e.kind)}</span><span>·</span><span>{e.sourceOrganization} (simulated)</span>
                      <Pill tone={e.trustLevel === "unverified" ? "gray" : "blue"} dot={false}>{words(e.trustLevel)}</Pill>
                      <span className="faint" style={{ marginLeft: "auto" }}>{local(e.observedAt)}</span>
                    </div>
                    <p className="list-text">{e.text}</p>
                  </li>
                ))}
              </ul>
              <h3 className="section-title">New inspector note</h3>
              <label className="field-label" htmlFor="note">Edit to show an altered input, then add it to the evidence record.</label>
              <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="actions" style={{ marginTop: 12 }}>
                <Btn kind="tinted" onClick={() => act("evidence", "/api/v1/platform/evidence", { text: note })} disabled={!!busy || note.trim().length < 5}>Add inspector note</Btn>
                <Btn icon="spark" busy={busy === "secondlook"} onClick={() => act("secondlook", "/api/v1/secondlook/passports", { mode: "live" })} disabled={!!busy || !v.model.configured}>{busy === "secondlook" ? `${v.model.provider} is reading the evidence…` : `Interpret with ${v.model.provider} (live)`}</Btn>
                <Btn kind="plain" onClick={() => act("secondlook", "/api/v1/secondlook/passports", { mode: "replay" })} disabled={!!busy}>Use authored replay</Btn>
              </div>
              <ErrorBox e={errors.evidence} /><ErrorBox e={errors.secondlook} /><Stale x={v.passport} />
              {pass && (<>
                {pass.modelRun.authored || pass.interpretationState === "model" ? (
                  <div className="row" style={{ marginTop: 20 }}>
                    {pass.modelRun.authored ? <Pill tone="violet">Authored example — not a model output</Pill>
                      : <Pill tone="blue">Live model {pass.modelRun.modelId} · {(pass.modelRun.latencyMs / 1000).toFixed(1)} s{pass.modelRun.usage ? ` · ${pass.modelRun.usage.inputTokens}+${pass.modelRun.usage.outputTokens} tokens` : ""}</Pill>}
                    <span className="fine">prompt {pass.modelRun.promptVersion} · {pass.passportId}</span>
                  </div>
                ) : (
                  <Callout tone="amber" icon="alert"><strong>Rules only — model {words(pass.modelRun.status)}.</strong> {pass.modelRun.error ?? ""} <span className="fine">prompt {pass.modelRun.promptVersion} · {pass.passportId}</span></Callout>
                )}
                {pass.interpretation && pass.interpretation.findings.length > 0 && (<>
                  <h3 className="section-title">Findings</h3>
                  <ul className="list">
                    {pass.interpretation.findings.map((f, i) => (
                      <li key={i}>
                        <div className="finding-row">
                          <span className="finding-text">{f.text}</span>
                          <span className="row">
                            <Pill tone={f.evidenceStatus === "supported" ? "green" : f.evidenceStatus === "conflicting" ? "amber" : f.evidenceStatus === "contradicted" ? "red" : "violet"}>{f.evidenceStatus}</Pill>
                            <Pill tone="gray" dot={false}>{f.severity} severity</Pill>
                          </span>
                        </div>
                        {f.field && <div className="cites"><span className="mono">{f.field} = {String(f.proposedValue)}</span></div>}
                        <div className="cites">
                          Supported by {f.supportingEvidenceIds.length ? f.supportingEvidenceIds.map((id) => <a key={id} className="chip" href={`#ev-${id}`} title="Show this evidence record">{id}</a>) : "—"}
                          {f.contradictingEvidenceIds.length > 0 && <> · Contradicted by {f.contradictingEvidenceIds.map((id) => <a key={id} className="chip t-red" href={`#ev-${id}`} title="Show this evidence record">{id}</a>)}</>}
                          {" "}· as of {local(f.observedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>)}
                {pass.interpretation && pass.interpretation.unknowns.length > 0 && (<>
                  <h3 className="section-title">Still unknown</h3>
                  <ul className="list">
                    {pass.interpretation.unknowns.map((u) => (
                      <li key={u.field}><div className="finding-row"><span className="mono">{u.field}</span><Pill tone="violet">unknown</Pill></div><div className="fine">{words(u.reason)}</div></li>
                    ))}
                  </ul>
                </>)}
                {pass.modelRun.droppedClaims.length > 0 && <Callout tone="amber" icon="alert"><strong>Dropped by validation:</strong> {pass.modelRun.droppedClaims.join("; ")}</Callout>}
                <h3 className="section-title">Next inspection checks <span className="faint">· deterministic ranking</span></h3>
                <ol className="check-list">
                  {pass.nextChecks.map((c) => <li key={c.checkCode}><div><strong>{c.label}</strong> <span className="chip">{c.checkCode}</span><div className="fine">{c.decisionImpact}</div></div></li>)}
                </ol>
                {confirmable.length > 0 && (
                  <Callout tone="blue" icon="person">
                    <strong>Reviewer decision.</strong> The model only proposes. Confirming creates vehicle revision {vehicle.revision + 1} and makes dependent results stale.
                    <div className="actions" style={{ marginTop: 12 }}>
                      <Btn busy={busy === "confirm"} onClick={() => act("confirm", "/api/v1/platform/vehicles/V-DEMO-001/revisions", { expectedRevision: vehicle.revision, changes: confirmable.map((f) => ({ path: f.field, value: f.proposedValue })), evidenceIds: [...new Set(confirmable.flatMap((f) => f.supportingEvidenceIds))] })} disabled={!!busy}>
                        Confirm {confirmable.map((f) => `${f.field!.split("/")[2]} = ${String(f.proposedValue)}`).join(", ")} into vehicle record
                      </Btn>
                    </div>
                  </Callout>
                )}
                <ErrorBox e={errors.confirm} />
              </>)}
            </section>
          )}

          {!focus && (
            <section id="deal" className="card" aria-label="Transaction">
              <StepHead s={step("deal")} current={currentId === "deal"} kicker="Step 3 · Transaction" title="Simulated deal and shipment"
                how="Sell at the recommended channel's mid price. The deal creates a shipment that already knows what equipment the car needs." />
              <div className="actions">
                <Btn busy={busy === "deal"} onClick={() => act("deal", "/api/v1/platform/deals")} disabled={!!busy}>Confirm simulated deal with Synthetic Rebuilder 201</Btn>
                <span className="fine">Price = recommended channel&apos;s gross mid from the current valuation. No real sale is created.</span>
              </div>
              <ErrorBox e={errors.deal} />
              {v.deal && v.journeyShipment && (<>
                <div className="grid-3" style={{ marginTop: 20 }}>
                  <div className="tile"><div className="metric-label">Sale price (simulated)</div><div className="metric-value">{usd(v.deal.deal.price)}</div></div>
                  <div className="tile"><div className="metric-label">Seller proceeds</div><div className="metric-value">{usd(v.deal.sellerProceeds)}</div><div className="metric-sub">price − seller fee</div></div>
                  <div className="tile"><div className="metric-label">Buyer landed cost</div><div className="metric-value">{usd(v.deal.buyerLanded)}</div><div className="metric-sub">price + buyer fee + transport · {v.deal.buyerTransport?.basis}</div></div>
                </div>
                <h3 className="section-title">Shipment <span className="mono">{v.journeyShipment.shipmentId}</span></h3>
                <div className="row"><span className="small">Needs</span>{v.journeyShipment.requiredEquipment.map((e) => <Pill key={e} tone={e === "winch" ? "amber" : "gray"}>{words(e)}</Pill>)}</div>
                <p className="fine" style={{ marginTop: 8 }}>{v.journeyShipment.requirementBasis.join(" ")}</p>
                {(() => { const r = v.readiness.find((x) => x.shipmentId === v.journeyShipment!.shipmentId)!; return (<>
                  <h3 className="section-title">Release readiness</h3>
                  <div className="row"><Pill tone={r.decision === "ready" ? "green" : r.decision === "blocked" ? "red" : "violet"}>{r.label}</Pill><span className="fine">provider {r.providerId} (ReadyToMove not installed)</span></div>
                  <ul className="list" style={{ marginTop: 12 }}>
                    {r.gates.map((g) => (
                      <li key={g.kind}>
                        <div className="finding-row"><span>{words(g.kind)}</span><Pill tone={g.state === "clear" ? "green" : g.state === "blocked" ? "red" : g.state === "unknown" ? "violet" : "gray"}>{words(g.state)}</Pill></div>
                        <div className="fine">{g.basis}</div>
                      </li>
                    ))}
                  </ul>
                </>); })()}
              </>)}
            </section>
          )}

          {show("loadlink") && (
            <section id="loadlink" className="card" aria-label="LoadLink">
              <StepHead s={step("loadlink")} current={currentId === "loadlink"} kicker="Step 4 · Delivery · LoadLink" title="Which truck can actually move it?"
                how="Pools ACV- and Copart-tagged shipments and only gives work to trucks with the right equipment. Anything it can't place is listed with a reason." />
              <div className="actions">
                <Btn busy={busy === "loadlink"} onClick={() => act("loadlink", "/api/v1/loadlink/plans")} disabled={!!busy}>{plan ? "Re-plan routes" : "Plan routes"}</Btn>
                <label className="switch-row"><input type="checkbox" role="switch" className="switch" checked={v.winchOutOfService} onChange={(e) => act("fleet", "/api/v1/platform/fleet", { winchOutOfService: e.target.checked })} disabled={!!busy} /> Truck B winch out of service</label>
                <span className="fine">Time windows not checked in this MVP.</span>
              </div>
              <ErrorBox e={errors.loadlink} /><ErrorBox e={errors.fleet} /><Stale x={v.plan} />
              {plan && (<>
                <div className="row" style={{ marginTop: 20 }}>
                  <Pill tone={plan.status === "eligible" ? "green" : "amber"}>{plan.status === "provisional" ? "Provisional — readiness unknown for some work" : "Eligible in simulation"}</Pill>
                  <Pill tone="red">Not dispatchable (simulation)</Pill>
                  <span className="fine">{plan.routePlanId}</span>
                </div>
                <div className="grid" style={{ marginTop: 16 }}>
                  {plan.routes.map((r) => (
                    <article key={r.resourceId} className="tile">
                      <div className="route-head"><span className="route-name">{r.resourceId}</span><span className="metric-value" style={{ fontSize: "1.25rem" }}>{r.distanceKm} km</span></div>
                      <ol className="timeline">
                        {r.stops.map((s, i) => <li key={i} className={s.kind === "pickup" ? "" : "drop"}>{s.kind === "pickup" ? "Pick up" : "Deliver"} <span className="mono">{s.shipmentId}</span> <span className="faint">@ {s.locationId.replace("L-DEMO-", "")}</span></li>)}
                      </ol>
                    </article>
                  ))}
                </div>
                {plan.unassigned.length > 0 && (<>
                  <h3 className="section-title">Unassigned work <span className="faint">· explicit, not hidden</span></h3>
                  <ul className="list">
                    {plan.unassigned.map((u) => (
                      <li key={u.shipmentId}><div className="finding-row"><span className="mono">{u.shipmentId}</span><Pill tone="red">{words(u.reason)}</Pill></div><div className="fine">{u.detail}</div></li>
                    ))}
                  </ul>
                </>)}
              </>)}
            </section>
          )}

          {!focus && (
            <section className="card" aria-label="Pillars">
              <h2 className="section-title">The full platform</h2>
              <p className="fine">Six features across three pillars. Priority 1 runs in this demo; the rest is planned.</p>
              <div className="grid-3" style={{ marginTop: 16 }}>
                <div className="tile pillar"><h3>Database / company</h3>
                  <div className="feature"><div><a href="/bestexit" className="feature-name">BestExit</a><div className="fine">Net-proceeds disposition comparison</div></div><Pill tone="green">P1</Pill></div>
                </div>
                <div className="tile pillar"><h3>Customer features</h3>
                  <div className="feature"><div><a href="/secondlook" className="feature-name">SecondLook</a><div className="fine">Evidence interpretation + next inspection (AI)</div></div><Pill tone="green">P1</Pill></div>
                  <div className="feature"><span className="feature-name">RightBuyer</span><Pill tone="gray">P2 · planned</Pill></div>
                  <div className="feature"><span className="feature-name">PartsBridge</span><Pill tone="gray">P3 · planned</Pill></div>
                </div>
                <div className="tile pillar"><h3>Delivery / routing</h3>
                  <div className="feature"><div><a href="/loadlink" className="feature-name">LoadLink</a><div className="fine">Equipment-aware pooled routing</div></div><Pill tone="green">P1</Pill></div>
                  <div className="feature"><div><span className="feature-name">ReadyToMove</span><div className="fine">Foundation minimal readiness check used instead</div></div><Pill tone="gray">P3 · planned</Pill></div>
                </div>
              </div>
            </section>
          )}

          {!focus && (
            <details className="card" aria-label="Event log">
              <summary><span>Event trail <span className="fine">· {v.log.length} events</span></span></summary>
              <ul className="list">
                {v.log.map((l, i) => (
                  <li key={i}><div className="list-meta"><span className="chip">{l.event}</span><span className="faint">{local(l.at)}</span></div><p className="list-text small">{l.detail}</p></li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>
      <footer className="foot">Demo foundation — simulated data — not production. No real bid, payment, title, reservation or dispatch is ever created.</footer>
    </>
  );
}
