"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

// ── Correction Ledger (append-only) ─────────────────────────────────────────
export type Correction = { id: string; original_statement: string; issue: string; revised_statement: string; reason: string; evidence: string; affected_locations: string; visibility: string; created_at: string };
const CORRECTION_COLUMNS = "id,original_statement,issue,revised_statement,reason,evidence,affected_locations,visibility,created_at";

export type CorrectionsState = {
  corrections: Correction[];
  loadState: "idle" | "loading" | "ready" | "needs-setup";
  file: (fields: { original: string; issue: string; revised: string; reason: string; evidence: string; locations: string }) => Promise<void>;
  setVisibility: (id: string, visibility: string) => Promise<void>;
};

export function useCorrections(user: User | null, projectId: string | null, authorLabel: string, notify: (message: string) => void): CorrectionsState {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loadState, setLoadState] = useState<CorrectionsState["loadState"]>("idle");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !projectId) { setCorrections([]); setLoadState("idle"); return; }
      setLoadState("loading");
      const { data, error } = await supabase.from("dreamboard_corrections").select(CORRECTION_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }).limit(300);
      if (error) { setLoadState("needs-setup"); return; }
      setCorrections((data || []) as Correction[]);
      setLoadState("ready");
    };
    void load();
  }, [user, projectId]);

  const file = async (fields: { original: string; issue: string; revised: string; reason: string; evidence: string; locations: string }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !projectId || !fields.original.trim()) return;
    const { data, error } = await supabase.from("dreamboard_corrections").insert({ owner_id: user.id, project_id: projectId, original_statement: fields.original.trim().slice(0, 2000), issue: fields.issue.trim(), revised_statement: fields.revised.trim(), reason: fields.reason.trim(), evidence: fields.evidence.trim(), affected_locations: fields.locations.trim(), author_label: authorLabel }).select(CORRECTION_COLUMNS).single();
    if (error || !data) { notify("The correction could not be filed. Please try again."); return; }
    setCorrections(previous => [data as Correction, ...previous]);
    notify("Correction recorded permanently. The original wording is preserved in the ledger.");
  };
  const setVisibility = async (id: string, visibility: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setCorrections(previous => previous.map(correction => correction.id === id ? { ...correction, visibility } : correction));
    await supabase.from("dreamboard_corrections").update({ visibility }).eq("id", id);
  };
  return { corrections, loadState, file, setVisibility };
}

export function CorrectionLedgerPanel({ state }: { state: CorrectionsState }) {
  const [original, setOriginal] = useState("");
  const [issue, setIssue] = useState("");
  const [revised, setRevised] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [locations, setLocations] = useState("");
  const submit = async () => { await state.file({ original, issue, revised, reason, evidence, locations }); setOriginal(""); setIssue(""); setRevised(""); setReason(""); setEvidence(""); setLocations(""); };
  return <div className="ledger-panel">
    {state.loadState === "needs-setup" && <div className="connection-note"><b>Correction ledger setup needed:</b><span>Run supabase/dreamboard-corrections-equations.sql in your Supabase project.</span></div>}
    <div className="input-card"><span className="eyebrow">FILE A CORRECTION</span>
      <label>ORIGINAL STATEMENT<textarea value={original} onChange={event => setOriginal(event.target.value)} placeholder="Exactly what was originally stated." /></label>
      <div className="project-detail-grid">
        <label>WHAT WAS WRONG<textarea value={issue} onChange={event => setIssue(event.target.value)} /></label>
        <label>REVISED STATEMENT<textarea value={revised} onChange={event => setRevised(event.target.value)} /></label>
        <label>REASON<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>
        <label>EVIDENCE<textarea value={evidence} onChange={event => setEvidence(event.target.value)} /></label>
      </div>
      <label>AFFECTED LOCATIONS<input value={locations} onChange={event => setLocations(event.target.value)} placeholder="Where the original appeared (chapters, claims, notes)." /></label>
      <button className="gold" onClick={() => void submit()} disabled={!original.trim() || state.loadState !== "ready"}>Record correction <b>→</b></button>
    </div>
    <p className="import-truth">The ledger is permanent and append-only — corrections are never overwritten, so the history of your thinking stays intact. You choose whether each is private or included in published research.</p>
    <div className="research-list">{state.corrections.map(correction => <article key={correction.id} className="correction-card">
      <div className="correction-diff"><div><small>ORIGINAL</small><p>{correction.original_statement}</p></div><i>→</i><div><small>REVISED</small><p>{correction.revised_statement || "(withdrawn)"}</p></div></div>
      {correction.reason && <p className="correction-reason"><b>Reason:</b> {correction.reason}</p>}
      <div className="vision-actions"><small>{new Date(correction.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small><label className="vision-status">VISIBILITY<select value={correction.visibility} onChange={event => void state.setVisibility(correction.id, event.target.value)}><option value="private">Private</option><option value="published">In published research</option></select></label></div>
    </article>)}{!state.corrections.length && <p className="empty-state">No corrections yet. When your thinking changes, record it here — that record is a strength.</p>}</div>
  </div>;
}

// ── Equation Lab ────────────────────────────────────────────────────────────
export type Equation = { id: string; name: string; expression: string; variables: string; units: string; assumptions: string; limitations: string; validation_status: string; notes: string };
const EQUATION_COLUMNS = "id,name,expression,variables,units,assumptions,limitations,validation_status,notes";
export const VALIDATION_STATES: Array<[string, string]> = [["unvalidated", "Unvalidated"], ["dimensions_checked", "Dimensions checked"], ["reviewed", "Reviewed"], ["empirically_tested", "Empirically tested"], ["rejected", "Rejected"]];

export type EquationsState = {
  equations: Equation[];
  loadState: "idle" | "loading" | "ready" | "needs-setup";
  add: (name: string, expression: string) => Promise<void>;
  update: (id: string, patch: Partial<Omit<Equation, "id">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function useEquations(user: User | null, projectId: string | null, notify: (message: string) => void): EquationsState {
  const [equations, setEquations] = useState<Equation[]>([]);
  const [loadState, setLoadState] = useState<EquationsState["loadState"]>("idle");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !projectId) { setEquations([]); setLoadState("idle"); return; }
      setLoadState("loading");
      const { data, error } = await supabase.from("dreamboard_equations").select(EQUATION_COLUMNS).eq("project_id", projectId).order("updated_at", { ascending: false }).limit(200);
      if (error) { setLoadState("needs-setup"); return; }
      setEquations((data || []) as Equation[]);
      setLoadState("ready");
    };
    void load();
  }, [user, projectId]);

  const add = async (name: string, expression: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !projectId || !name.trim()) return;
    const { data, error } = await supabase.from("dreamboard_equations").insert({ owner_id: user.id, project_id: projectId, name: name.trim().slice(0, 200), expression: expression.trim() }).select(EQUATION_COLUMNS).single();
    if (error || !data) { notify("The equation could not be saved. Please try again."); return; }
    setEquations(previous => [data as Equation, ...previous]);
    notify("Equation recorded as unvalidated. Being calculable is not the same as being validated.");
  };
  const update = async (id: string, patch: Partial<Omit<Equation, "id">>) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setEquations(previous => previous.map(equation => equation.id === id ? { ...equation, ...patch } : equation));
    await supabase.from("dreamboard_equations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  };
  const remove = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    if (!window.confirm("Delete this equation? This cannot be undone.")) return;
    const { error } = await supabase.from("dreamboard_equations").delete().eq("id", id);
    if (error) { notify("The equation could not be deleted. Please try again."); return; }
    setEquations(previous => previous.filter(equation => equation.id !== id));
  };
  return { equations, loadState, add, update, remove };
}

export function EquationLabPanel({ state }: { state: EquationsState }) {
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  return <div className="equation-panel">
    {state.loadState === "needs-setup" && <div className="connection-note"><b>Equation Lab setup needed:</b><span>Run supabase/dreamboard-corrections-equations.sql in your Supabase project.</span></div>}
    <div className="connection-note"><b>Calculable is not validated:</b><span>Recording or evaluating an equation says nothing about whether it is scientifically true. Validation status is set by you, from real checks — never inferred.</span></div>
    <div className="input-card"><span className="eyebrow">NEW EQUATION</span><label>NAME<input value={name} onChange={event => setName(event.target.value)} maxLength={200} placeholder="What this equation represents." /></label><label>EXPRESSION<input value={expression} onChange={event => setExpression(event.target.value)} placeholder="e.g. E = m·c²" /></label><button className="gold" onClick={() => { void state.add(name, expression); setName(""); setExpression(""); }} disabled={!name.trim() || state.loadState !== "ready"}>Add equation <b>→</b></button></div>
    <div className="research-list">{state.equations.map(equation => { const isOpen = openId === equation.id; return <article key={equation.id}>
      <button className="claim-summary" onClick={() => setOpenId(isOpen ? null : equation.id)} aria-expanded={isOpen}><span className={`evidence-badge ${equation.validation_status === "empirically_tested" ? "evidence-established" : equation.validation_status === "rejected" ? "evidence-rejected" : "evidence-hypothesis"}`}>{VALIDATION_STATES.find(([value]) => value === equation.validation_status)?.[1]}</span><p><b>{equation.name}</b>{equation.expression ? ` — ${equation.expression}` : ""}</p></button>
      {isOpen && <div className="claim-detail">
        <label>EXPRESSION<input value={equation.expression} onChange={event => void state.update(equation.id, { expression: event.target.value })} /></label>
        <div className="project-detail-grid">
          <label>VARIABLES<textarea defaultValue={equation.variables} placeholder="Each symbol and what it means." onBlur={event => void state.update(equation.id, { variables: event.target.value })} /></label>
          <label>UNITS & DIMENSIONS<textarea defaultValue={equation.units} onBlur={event => void state.update(equation.id, { units: event.target.value })} /></label>
          <label>ASSUMPTIONS<textarea defaultValue={equation.assumptions} onBlur={event => void state.update(equation.id, { assumptions: event.target.value })} /></label>
          <label>LIMITATIONS<textarea defaultValue={equation.limitations} onBlur={event => void state.update(equation.id, { limitations: event.target.value })} /></label>
        </div>
        <div className="vision-actions"><label className="vision-status">VALIDATION STATUS<select value={equation.validation_status} onChange={event => void state.update(equation.id, { validation_status: event.target.value })}>{VALIDATION_STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="ghost" onClick={() => void state.remove(equation.id)}>Delete</button></div>
      </div>}
    </article>; })}{!state.equations.length && <p className="empty-state">No equations yet. Add one, then record its variables, units, and assumptions honestly.</p>}</div>
  </div>;
}
