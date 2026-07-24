"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { EVIDENCE_CLASSES, CLAIM_TYPES, CONFIDENCE_LEVELS as CONFIDENCE, VERIFICATION_STATES as VERIFICATION, QUESTION_STATES as QUESTION_STATUS, evidenceLabel, type EvidenceClass } from "../lib/research";
import { CorrectionLedgerPanel, EquationLabPanel, type CorrectionsState, type EquationsState } from "./corrections-equations";


type Question = { id: string; question: string; status: string; notes: string };
type Claim = { id: string; statement: string; claim_type: string; evidence_class: EvidenceClass; sources: string[]; supporting_evidence: string; objections: string; alternatives: string; confidence: string; verification_status: string; user_notes: string };

const QUESTION_COLUMNS = "id,question,status,notes";
const CLAIM_COLUMNS = "id,statement,claim_type,evidence_class,sources,supporting_evidence,objections,alternatives,confidence,verification_status,user_notes";

export type ResearchState = {
  questions: Question[];
  claims: Claim[];
  loadState: "idle" | "loading" | "ready" | "needs-setup";
  addQuestion: (question: string) => Promise<void>;
  updateQuestion: (id: string, patch: Partial<Pick<Question, "status" | "notes">>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  addClaim: (statement: string, evidenceClass: EvidenceClass) => Promise<void>;
  updateClaim: (id: string, patch: Partial<Omit<Claim, "id">>) => Promise<void>;
  deleteClaim: (id: string) => Promise<void>;
};

export function useResearch(user: User | null, projectId: string | null, notify: (message: string) => void): ResearchState {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadState, setLoadState] = useState<ResearchState["loadState"]>("idle");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !projectId) { setQuestions([]); setClaims([]); setLoadState("idle"); return; }
      setLoadState("loading");
      const questionResult = await supabase.from("dreamboard_research_questions").select(QUESTION_COLUMNS).eq("project_id", projectId).order("updated_at", { ascending: false }).limit(200);
      if (questionResult.error) { setLoadState("needs-setup"); return; }
      const claimResult = await supabase.from("dreamboard_claims").select(CLAIM_COLUMNS).eq("project_id", projectId).order("updated_at", { ascending: false }).limit(300);
      setQuestions((questionResult.data || []) as Question[]);
      setClaims(((claimResult.data || []) as Array<Omit<Claim, "sources"> & { sources: string[] | null }>).map(claim => ({ ...claim, sources: claim.sources || [] })));
      setLoadState("ready");
    };
    void load();
  }, [user, projectId]);

  const addQuestion = async (question: string) => {
    const supabase = getSupabaseBrowserClient();
    const clean = question.trim();
    if (!supabase || !user || !projectId || !clean) return;
    const { data, error } = await supabase.from("dreamboard_research_questions").insert({ owner_id: user.id, project_id: projectId, question: clean.slice(0, 600) }).select(QUESTION_COLUMNS).single();
    if (error || !data) { notify("The research question could not be saved. Please try again."); return; }
    setQuestions(previous => [data as Question, ...previous]);
  };
  const updateQuestion = async (id: string, patch: Partial<Pick<Question, "status" | "notes">>) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setQuestions(previous => previous.map(question => question.id === id ? { ...question, ...patch } : question));
    await supabase.from("dreamboard_research_questions").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  };
  const deleteQuestion = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    if (!window.confirm("Delete this research question? Claims linked to it are kept.")) return;
    const { error } = await supabase.from("dreamboard_research_questions").delete().eq("id", id);
    if (error) { notify("The question could not be deleted. Please try again."); return; }
    setQuestions(previous => previous.filter(question => question.id !== id));
  };

  const addClaim = async (statement: string, evidenceClass: EvidenceClass) => {
    const supabase = getSupabaseBrowserClient();
    const clean = statement.trim();
    if (!supabase || !user || !projectId || !clean) return;
    const { data, error } = await supabase.from("dreamboard_claims").insert({ owner_id: user.id, project_id: projectId, statement: clean.slice(0, 2000), evidence_class: evidenceClass }).select(CLAIM_COLUMNS).single();
    if (error || !data) { notify("The claim could not be saved. Please try again."); return; }
    setClaims(previous => [{ ...(data as Claim), sources: (data as { sources: string[] | null }).sources || [] }, ...previous]);
    notify("Claim recorded. Its evidence class is exactly what you set — nothing is upgraded automatically.");
  };
  const updateClaim = async (id: string, patch: Partial<Omit<Claim, "id">>) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setClaims(previous => previous.map(claim => claim.id === id ? { ...claim, ...patch } : claim));
    await supabase.from("dreamboard_claims").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  };
  const deleteClaim = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    if (!window.confirm("Delete this claim? This cannot be undone.")) return;
    const { error } = await supabase.from("dreamboard_claims").delete().eq("id", id);
    if (error) { notify("The claim could not be deleted. Please try again."); return; }
    setClaims(previous => previous.filter(claim => claim.id !== id));
  };

  return { questions, claims, loadState, addQuestion, updateQuestion, deleteQuestion, addClaim, updateClaim, deleteClaim };
}


export function ResearchView({ research, corrections, equations, signedIn, projectTitle, onPassport, onProjects }: { research: ResearchState; corrections: CorrectionsState; equations: EquationsState; signedIn: boolean; projectTitle: string | null; onPassport: () => void; onProjects: () => void }) {
  const [tab, setTab] = useState<"claims" | "corrections" | "equations">("claims");
  const [questionDraft, setQuestionDraft] = useState("");
  const [claimDraft, setClaimDraft] = useState("");
  const [claimClass, setClaimClass] = useState<EvidenceClass>("needs_verification");
  const [openClaim, setOpenClaim] = useState<string | null>(null);

  const byClass = useMemo(() => {
    const counts: Partial<Record<EvidenceClass, number>> = {};
    for (const claim of research.claims) counts[claim.evidence_class] = (counts[claim.evidence_class] || 0) + 1;
    return counts;
  }, [research.claims]);

  if (!signedIn) return <section className="view"><div className="view-heading"><span className="eyebrow">RESEARCH WORKSPACE</span><h2>Research lives inside a project.</h2><p>Questions, claims, and evidence are private to your creator account. Sign in with your Passport to begin.</p></div><button className="gold" onClick={onPassport}>Set up Passport <b>→</b></button></section>;
  if (!projectTitle) return <section className="view"><div className="view-heading"><span className="eyebrow">RESEARCH WORKSPACE</span><h2>Choose an active project.</h2><p>The Research Workspace is scoped to one project so evidence never blends across your work. Pick a primary project from the switcher in the header.</p></div><button className="gold" onClick={onProjects}>Open Projects <b>→</b></button></section>;

  return <section className="view research-view">
    <div className="view-heading"><span className="eyebrow">RESEARCH WORKSPACE · {projectTitle.toUpperCase()}</span><h2>Separate what is known from what is not.</h2><p>Every claim carries an explicit evidence class. Dreamboard never upgrades a hypothesis into established fact on its own.</p></div>
    <div className="vision-filters research-tabs" role="tablist">
      <button role="tab" aria-selected={tab === "claims"} className={tab === "claims" ? "season active" : "season"} onClick={() => setTab("claims")}>Questions & Claims</button>
      <button role="tab" aria-selected={tab === "corrections"} className={tab === "corrections" ? "season active" : "season"} onClick={() => setTab("corrections")}>Correction Ledger</button>
      <button role="tab" aria-selected={tab === "equations"} className={tab === "equations" ? "season active" : "season"} onClick={() => setTab("equations")}>Equation Lab</button>
    </div>
    {tab === "corrections" && <CorrectionLedgerPanel state={corrections} />}
    {tab === "equations" && <EquationLabPanel state={equations} />}
    {tab === "claims" && <>
    {research.loadState === "needs-setup" && <div className="connection-note"><b>Research setup needed:</b><span>Run supabase/dreamboard-research-workspace.sql in your Supabase project to enable questions and claims.</span></div>}

    <div className="research-grid">
      <section className="research-col">
        <span className="eyebrow">RESEARCH QUESTIONS</span>
        <div className="input-card"><label>NEW QUESTION<textarea value={questionDraft} onChange={event => setQuestionDraft(event.target.value)} placeholder="What do you need to find out?" /></label><button className="gold" onClick={() => { void research.addQuestion(questionDraft); setQuestionDraft(""); }} disabled={!questionDraft.trim() || research.loadState !== "ready"}>Add question <b>→</b></button></div>
        <div className="research-list">{research.questions.map(question => <article key={question.id}><p>{question.question}</p><div className="vision-actions"><label className="vision-status">STATUS<select value={question.status} onChange={event => void research.updateQuestion(question.id, { status: event.target.value })}>{QUESTION_STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="ghost" onClick={() => void research.deleteQuestion(question.id)}>Delete</button></div></article>)}{!research.questions.length && <p className="empty-state">No questions yet. Good research starts with the honest question.</p>}</div>
      </section>

      <section className="research-col">
        <span className="eyebrow">CLAIMS · {research.claims.length}</span>
        <div className="input-card"><label>NEW CLAIM (EXACT WORDING)<textarea value={claimDraft} onChange={event => setClaimDraft(event.target.value)} placeholder="State the claim precisely, in your own words." /></label><label className="vision-status">EVIDENCE CLASS<select value={claimClass} onChange={event => setClaimClass(event.target.value as EvidenceClass)}>{EVIDENCE_CLASSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="gold" onClick={() => { void research.addClaim(claimDraft, claimClass); setClaimDraft(""); }} disabled={!claimDraft.trim() || research.loadState !== "ready"}>Record claim <b>→</b></button></div>
        <div className="research-list">{research.claims.map(claim => { const isOpen = openClaim === claim.id; return <article key={claim.id} className={`claim-card evidence-${claim.evidence_class}`}>
          <button className="claim-summary" onClick={() => setOpenClaim(isOpen ? null : claim.id)} aria-expanded={isOpen}><span className={`evidence-badge evidence-${claim.evidence_class}`}>{evidenceLabel(claim.evidence_class)}</span><p>{claim.statement}</p></button>
          {isOpen && <div className="claim-detail">
            <div className="project-detail-grid">
              <label className="vision-status">EVIDENCE CLASS<select value={claim.evidence_class} onChange={event => void research.updateClaim(claim.id, { evidence_class: event.target.value as EvidenceClass })}>{EVIDENCE_CLASSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="vision-status">CLAIM TYPE<select value={claim.claim_type} onChange={event => void research.updateClaim(claim.id, { claim_type: event.target.value })}>{CLAIM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="vision-status">CONFIDENCE<select value={claim.confidence} onChange={event => void research.updateClaim(claim.id, { confidence: event.target.value })}>{CONFIDENCE.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="vision-status">VERIFICATION<select value={claim.verification_status} onChange={event => void research.updateClaim(claim.id, { verification_status: event.target.value })}>{VERIFICATION.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label>SOURCES (ONE PER LINE)<textarea defaultValue={claim.sources.join("\n")} placeholder="Real sources only — Dreamboard never invents citations." onBlur={event => void research.updateClaim(claim.id, { sources: event.target.value.split("\n").map(line => line.trim()).filter(Boolean) })} /></label>
            <label>SUPPORTING EVIDENCE<textarea defaultValue={claim.supporting_evidence} onBlur={event => void research.updateClaim(claim.id, { supporting_evidence: event.target.value })} /></label>
            <label>OBJECTIONS<textarea defaultValue={claim.objections} onBlur={event => void research.updateClaim(claim.id, { objections: event.target.value })} /></label>
            <label>ALTERNATIVE EXPLANATIONS<textarea defaultValue={claim.alternatives} onBlur={event => void research.updateClaim(claim.id, { alternatives: event.target.value })} /></label>
            <label>YOUR NOTES<textarea defaultValue={claim.user_notes} onBlur={event => void research.updateClaim(claim.id, { user_notes: event.target.value })} /></label>
            <div className="vision-actions"><button className="ghost" onClick={() => void research.deleteClaim(claim.id)}>Delete claim</button></div>
          </div>}
        </article>; })}{!research.claims.length && <p className="empty-state">No claims yet. Record the first one and set its evidence class honestly.</p>}</div>
      </section>
    </div>

    {research.claims.length > 0 && <section className="research-summary"><span className="eyebrow">EVIDENCE MIX</span><div className="evidence-mix">{EVIDENCE_CLASSES.filter(([value]) => byClass[value]).map(([value, label]) => <span key={value} className={`evidence-badge evidence-${value}`}>{label}: {byClass[value]}</span>)}</div><p className="import-truth">This mix is a mirror of how you classified your own claims — a research project full of hypotheses is honest, not incomplete.</p></section>}
    </>}
  </section>;
}
