"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { countReferenceWords, validateVoiceReference, voiceReferenceCoverage, type VoiceReferenceDraft } from "../lib/voice-guardian";

export type VoiceReference = { id: string; label: string; excerpt: string; created_at: string };
const COLUMNS = "id,label,excerpt,created_at";
const emptyDraft: VoiceReferenceDraft = { label: "", excerpt: "", consent: false };

export function VoiceGuardian({ user, projectId, projectTitle, onReferencesChange, notify }: { user: User | null; projectId: string | null | undefined; projectTitle: string | null; onReferencesChange: (references: VoiceReference[]) => void; notify: (message: string) => void }) {
  const [references, setReferences] = useState<VoiceReference[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "needs-setup">("idle");
  const [draft, setDraft] = useState<VoiceReferenceDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !projectId) { setReferences([]); onReferencesChange([]); setState("idle"); return; }
      setState("loading");
      const { data, error } = await supabase.from("dreamboard_voice_references").select(COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }).limit(24);
      if (error) { setState("needs-setup"); return; }
      const next = (data || []) as VoiceReference[];
      setReferences(next); onReferencesChange(next); setState("ready");
    };
    void load();
  }, [user, projectId, onReferencesChange]);

  const words = useMemo(() => countReferenceWords(references), [references]);
  if (!user) return <div className="voice-guardian"><span className="eyebrow">VOICE GUARDIAN</span><p>Set up Passport before creating a private voice reference set.</p></div>;
  if (!projectId) return <div className="voice-guardian"><span className="eyebrow">VOICE GUARDIAN</span><p>Choose a project before adding voice references. Dreamboard never blends one project’s voice into another automatically.</p></div>;
  const add = async () => {
    const issue = validateVoiceReference(draft);
    if (issue) { notify(issue); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSaving(true);
    const { data, error } = await supabase.from("dreamboard_voice_references").insert({ owner_id: user.id, project_id: projectId, label: draft.label.trim(), excerpt: draft.excerpt.trim(), consented_at: new Date().toISOString() }).select(COLUMNS).single();
    setSaving(false);
    if (error || !data) { notify("Voice reference could not be saved. Your work remains unchanged."); return; }
    const next = [data as VoiceReference, ...references];
    setReferences(next); onReferencesChange(next); setDraft(emptyDraft); notify("Private voice reference saved. It is not used for model training.");
  };
  const remove = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !window.confirm("Remove this private voice reference?")) return;
    const { error } = await supabase.from("dreamboard_voice_references").delete().eq("id", id);
    if (error) { notify("Voice reference could not be removed."); return; }
    const next = references.filter(reference => reference.id !== id);
    setReferences(next); onReferencesChange(next); notify("Voice reference removed.");
  };
  return <section className="voice-guardian"><div className="card-head"><div><span className="eyebrow">VOICE GUARDIAN · {projectTitle?.toUpperCase() || "PROJECT"}</span><h3>Protect the voice you brought here.</h3></div><span className="ai-pill">{voiceReferenceCoverage(references)}</span></div><p>Save excerpts you own or have permission to use. Dreamboard uses them only when you choose “Include voice references” below; it does not train a model, clone a voice, or promise imitation.</p>{state === "needs-setup" && <div className="connection-note"><b>Voice Guardian setup needed:</b><span>Run <code>supabase/dreamboard-voice-guardian.sql</code> to create the private reference table.</span></div>}{state !== "needs-setup" && <><div className="voice-reference-form"><label>REFERENCE LABEL<input value={draft.label} onChange={event => setDraft(previous => ({ ...previous, label: event.target.value }))} maxLength={240} placeholder="e.g. Chapter 2 — original draft" /></label><label>YOUR OWN EXCERPT<textarea value={draft.excerpt} onChange={event => setDraft(previous => ({ ...previous, excerpt: event.target.value }))} maxLength={5000} placeholder="Paste a passage whose rhythm, vocabulary, and perspective you want to preserve…" /></label><label className="consent-row"><input type="checkbox" checked={draft.consent} onChange={event => setDraft(previous => ({ ...previous, consent: event.target.checked }))} /> This is my work, or I have permission to use it as a private reference.</label><button className="ghost" onClick={() => void add()} disabled={saving || state === "loading"}>{saving ? "Saving…" : "Save voice reference"}</button></div><div className="voice-reference-list"><small>{references.length} reference{references.length === 1 ? "" : "s"} · {words.toLocaleString()} source words · coverage is a source count, not a model-confidence claim.</small>{references.map(reference => <article key={reference.id}><b>{reference.label}</b><p>{reference.excerpt.slice(0, 260)}{reference.excerpt.length > 260 ? "…" : ""}</p><button className="text-button" onClick={() => void remove(reference.id)}>Remove</button></article>)}</div></>}</section>;
}
