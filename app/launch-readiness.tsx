"use client";

export type ReadinessCheck = { label: string; state: "ready" | "needs-action" | "local"; detail: string; action?: string };

export function LaunchReadinessView({ checks, onExport, onPassport, onImport }: { checks: ReadinessCheck[]; onExport: () => void; onPassport: () => void; onImport: () => void }) {
  const ready = checks.filter(check => check.state === "ready").length;
  return <section className="view launch-readiness-view">
    <div className="view-heading">
      <span className="eyebrow">LAUNCH READINESS · TRUTHFUL STATUS</span>
      <h2>Know what is ready before you rely on it.</h2>
      <p>{ready} of {checks.length} foundations are connected in this browser. Dreamboard never labels an unconnected service as live.</p>
    </div>
    <div className="readiness-grid">{checks.map(check => <article className={`readiness-check ${check.state}`} key={check.label}>
      <span>{check.state === "ready" ? "● connected" : check.state === "local" ? "◐ local" : "○ action needed"}</span>
      <h3>{check.label}</h3><p>{check.detail}</p>
    </article>)}</div>
    <section className="readiness-actions">
      <div><span className="eyebrow">CREATOR CONTROL</span><h3>Your work is yours at every stage.</h3><p>Download a current-device workspace archive any time. It does not delete your work or claim to include cloud originals that have not been explicitly exported.</p></div>
      <div className="vision-actions"><button className="ghost" onClick={onExport}>Download workspace</button><button className="ghost" onClick={onImport}>Open archive intake</button><button className="gold" onClick={onPassport}>Review Passport <b>→</b></button></div>
    </section>
  </section>;
}
