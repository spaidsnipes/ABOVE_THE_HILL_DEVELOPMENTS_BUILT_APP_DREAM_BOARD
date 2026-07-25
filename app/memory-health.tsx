"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS, MEMORY_SCOPES, MEMORY_SCOPE_LABELS, deriveCreativeHealth, validateMemoryDraft, type HealthInput, type MemoryCategory, type MemoryDraft, type MemoryScope } from "../lib/memory-health";

export type ProjectMemory = {
  id: string;
  project_id: string | null;
  scope: MemoryScope;
  category: MemoryCategory;
  content: string;
  source_label: string;
  source_type: string;
  inferred: boolean;
  sensitive: boolean;
  created_at: string;
  updated_at: string;
};

type Preference = { enabled: boolean; dismissed_signal_ids: string[] };
const MEMORY_COLUMNS = "id,project_id,scope,category,content,source_label,source_type,inferred,sensitive,created_at,updated_at";
const emptyDraft: MemoryDraft = { content: "", scope: "project", category: "purpose", sourceLabel: "Creator entry", sourceType: "creator", inferred: false, sensitive: false, sensitiveConsent: false };

export type MemoryHealthState = {
  memories: ProjectMemory[];
  loadState: "idle" | "loading" | "ready" | "needs-setup";
  preference: Preference;
  addMemory: (draft: MemoryDraft) => Promise<boolean>;
  updateMemory: (id: string, patch: Pick<ProjectMemory, "content" | "category" | "scope" | "sensitive">) => Promise<boolean>;
  deleteMemory: (id: string) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  dismissSignal: (id: string) => Promise<void>;
};

export function useMemoryHealth(user: User | null, projectId: string | null, notify: (message: string) => void): MemoryHealthState {
  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [loadState, setLoadState] = useState<MemoryHealthState["loadState"]>("idle");
  const [preference, setPreference] = useState<Preference>({ enabled: true, dismissed_signal_ids: [] });

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !projectId) { setMemories([]); setPreference({ enabled: true, dismissed_signal_ids: [] }); setLoadState("idle"); return; }
      setLoadState("loading");
      const [memoryResult, preferenceResult] = await Promise.all([
        supabase.from("dreamboard_project_memory").select(MEMORY_COLUMNS).or(`project_id.eq.${projectId},project_id.is.null`).order("updated_at", { ascending: false }).limit(300),
        supabase.from("dreamboard_creative_health_preferences").select("enabled,dismissed_signal_ids").eq("project_id", projectId).maybeSingle(),
      ]);
      if (memoryResult.error || preferenceResult.error) { setLoadState("needs-setup"); return; }
      setMemories((memoryResult.data || []) as ProjectMemory[]);
      if (preferenceResult.data) setPreference({ enabled: preferenceResult.data.enabled, dismissed_signal_ids: preferenceResult.data.dismissed_signal_ids || [] });
      else setPreference({ enabled: true, dismissed_signal_ids: [] });
      setLoadState("ready");
    };
    void load();
  }, [user, projectId]);

  const addMemory = async (draft: MemoryDraft) => {
    const errorMessage = validateMemoryDraft(draft);
    if (errorMessage) { notify(errorMessage); return false; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !projectId) return false;
    const payload = { owner_id: user.id, project_id: draft.scope === "creator" ? null : projectId, scope: draft.scope, category: draft.category, content: draft.content.trim(), source_label: draft.sourceLabel.trim(), source_type: draft.sourceType, inferred: draft.inferred, sensitive: draft.sensitive, sensitive_consent_at: draft.sensitive ? new Date().toISOString() : null };
    const { data, error } = await supabase.from("dreamboard_project_memory").insert(payload).select(MEMORY_COLUMNS).single();
    if (error || !data) { notify("This memory could not be saved. Nothing was stored."); return false; }
    setMemories(previous => [data as ProjectMemory, ...previous]);
    notify("Memory saved with its source and scope.");
    return true;
  };

  const updateMemory = async (id: string, patch: Pick<ProjectMemory, "content" | "category" | "scope" | "sensitive">) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !projectId) return false;
    const current = memories.find(memory => memory.id === id);
    if (!current || (patch.sensitive && !current.sensitive)) { notify("To mark existing memory sensitive, delete it and add it again with explicit consent."); return false; }
    const updatedAt = new Date().toISOString();
    const project_id = patch.scope === "creator" ? null : projectId;
    const { error } = await supabase.from("dreamboard_project_memory").update({ content: patch.content.trim(), category: patch.category, scope: patch.scope, project_id, sensitive: patch.sensitive, updated_at: updatedAt }).eq("id", id);
    if (error) { notify("That memory could not be updated. Your existing saved version is unchanged."); return false; }
    setMemories(previous => previous.map(memory => memory.id === id ? { ...memory, ...patch, project_id, updated_at: updatedAt } : memory));
    return true;
  };

  const deleteMemory = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !window.confirm("Delete this memory? This cannot be undone.")) return;
    const { error } = await supabase.from("dreamboard_project_memory").delete().eq("id", id);
    if (error) { notify("That memory could not be deleted. Please try again."); return; }
    setMemories(previous => previous.filter(memory => memory.id !== id));
    notify("Memory deleted.");
  };

  const savePreference = async (next: Preference) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !projectId) return;
    const { error } = await supabase.from("dreamboard_creative_health_preferences").upsert({ owner_id: user.id, project_id: projectId, enabled: next.enabled, dismissed_signal_ids: next.dismissed_signal_ids, updated_at: new Date().toISOString() }, { onConflict: "owner_id,project_id" });
    if (error) { notify("Creative Health preferences could not be saved yet."); return; }
    setPreference(next);
  };

  return { memories, loadState, preference, addMemory, updateMemory, deleteMemory, setEnabled: enabled => savePreference({ ...preference, enabled }), dismissSignal: id => savePreference({ ...preference, dismissed_signal_ids: [...new Set([...preference.dismissed_signal_ids, id])] }) };
}

export function MemoryHealthView({ state, signedIn, projectTitle, healthInput, onPassport, onProjects, onGo }: { state: MemoryHealthState; signedIn: boolean; projectTitle: string | null; healthInput: HealthInput; onPassport: () => void; onProjects: () => void; onGo: (view: "Writing Studio" | "Knowledge Vault" | "Bulk Import" | "Research") => void }) {
  const [tab, setTab] = useState<"memory" | "health">("memory");
  const [draft, setDraft] = useState<MemoryDraft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const visibleHealth = useMemo(() => deriveCreativeHealth(healthInput).filter(observation => !state.preference.dismissed_signal_ids.includes(observation.id)), [healthInput, state.preference.dismissed_signal_ids]);
  const changeDraft = <K extends keyof MemoryDraft>(key: K, value: MemoryDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  if (!signedIn) return <section className="view"><div className="view-heading"><span className="eyebrow">MEMORY & CREATIVE HEALTH</span><h2>Only the memory you can inspect.</h2><p>Dreamboard never keeps invisible global memory. Sign in with Passport to manage private project memory and activity reflections.</p></div><button className="gold" onClick={onPassport}>Set up Passport <b>→</b></button></section>;
  if (!projectTitle) return <section className="view"><div className="view-heading"><span className="eyebrow">MEMORY & CREATIVE HEALTH</span><h2>Choose a project first.</h2><p>Project memory and Creative Health are never blended across your work without your permission. Creator-wide memory is available from any selected project and is clearly labeled.</p></div><button className="gold" onClick={onProjects}>Open Projects <b>→</b></button></section>;
  return <section className="view memory-health-view">
    <div className="view-heading split"><div><span className="eyebrow">PROJECT MEMORY · {projectTitle.toUpperCase()}</span><h2>Keep the context you choose.</h2><p>Every memory is visible, editable, removable, and attached to its source. Creative Health is a reflection on real activity—not a score.</p></div><div className="tabs research-tabs" role="tablist"><button className={tab === "memory" ? "active" : ""} onClick={() => setTab("memory")} role="tab" aria-selected={tab === "memory"}>Memory</button><button className={tab === "health" ? "active" : ""} onClick={() => setTab("health")} role="tab" aria-selected={tab === "health"}>Creative Health</button></div></div>
    {state.loadState === "needs-setup" && <div className="connection-note"><b>Memory setup needed:</b><span>Run <code>supabase/dreamboard-project-memory-health.sql</code> to create this private project layer.</span></div>}
    {tab === "memory" ? <div className="memory-grid"><section className="input-card"><span className="eyebrow">ADD AN INSPECTABLE MEMORY</span><label>WHAT SHOULD DREAMBOARD REMEMBER?<textarea value={draft.content} onChange={event => changeDraft("content", event.target.value)} placeholder="Example: This project’s purpose is…" /></label><div className="memory-form-grid"><label>SCOPE<select value={draft.scope} onChange={event => changeDraft("scope", event.target.value as MemoryScope)}>{MEMORY_SCOPES.map(value => <option key={value} value={value}>{MEMORY_SCOPE_LABELS[value]}</option>)}</select></label><label>CATEGORY<select value={draft.category} onChange={event => changeDraft("category", event.target.value as MemoryCategory)}>{MEMORY_CATEGORIES.map(value => <option key={value} value={value}>{MEMORY_CATEGORY_LABELS[value]}</option>)}</select></label></div><label>SOURCE<label className="source-inline"><select value={draft.sourceType} onChange={event => changeDraft("sourceType", event.target.value as MemoryDraft["sourceType"])}><option value="creator">Creator entry</option><option value="workspace">Workspace item</option><option value="import">Imported material</option><option value="companion">Companion suggestion</option></select><input value={draft.sourceLabel} onChange={event => changeDraft("sourceLabel", event.target.value)} placeholder="Where it came from" /></label></label><label className="toggle-row"><span><b>Inferred memory</b><small>Clearly labels an interpretation rather than a direct statement.</small></span><input type="checkbox" checked={draft.inferred} onChange={event => changeDraft("inferred", event.target.checked)} /><i /></label><label className="toggle-row"><span><b>Sensitive memory</b><small>Requires explicit consent and remains private to your Passport.</small></span><input type="checkbox" checked={draft.sensitive} onChange={event => changeDraft("sensitive", event.target.checked)} /><i /></label>{draft.sensitive && <label className="consent-row"><input type="checkbox" checked={draft.sensitiveConsent} onChange={event => changeDraft("sensitiveConsent", event.target.checked)} /> I explicitly consent to storing this sensitive memory privately.</label>}<button className="gold" onClick={() => { void (async () => { if (await state.addMemory(draft)) setDraft(emptyDraft); })(); }}>Save memory <b>→</b></button></section><section className="memory-list"><span className="eyebrow">SAVED MEMORY</span>{state.loadState === "loading" && <p className="empty-state">Opening your private memory…</p>}{state.memories.map(memory => <MemoryCard key={memory.id} memory={memory} editing={editing === memory.id} onEdit={() => setEditing(editing === memory.id ? null : memory.id)} onSave={async patch => { if (await state.updateMemory(memory.id, patch)) setEditing(null); }} onDelete={() => void state.deleteMemory(memory.id)} />)}{state.loadState === "ready" && !state.memories.length && <p className="empty-state">Nothing is stored yet. Add only what you want Dreamboard to remember about this project.</p>}</section></div> : <section className="creative-health-panel"><div className="health-head"><div><span className="eyebrow">ACTIVITY REFLECTION</span><h3>{state.preference.enabled ? "A gentle reading of your workspace." : "Creative Health is paused."}</h3><p>No medical, mental-health, or productivity diagnosis. Each observation names the exact activity behind it.</p></div><label className="toggle-row"><span><b>Creative Health</b><small>Enable observations for this project</small></span><input type="checkbox" checked={state.preference.enabled} onChange={event => void state.setEnabled(event.target.checked)} /><i /></label></div>{state.preference.enabled && <div className="health-observations">{visibleHealth.map(observation => <article key={observation.id}><span className="eyebrow">WHY YOU’RE SEEING THIS</span><h3>{observation.title}</h3><p>{observation.detail}</p><small>{observation.evidence}</small><div className="health-actions">{observation.options.map(option => <button key={option} className="ghost" onClick={() => { if (/writing/i.test(option)) onGo("Writing Studio"); else if (/research/i.test(option) || /question/i.test(option)) onGo("Research"); else if (/import/i.test(option)) onGo("Bulk Import"); else onGo("Knowledge Vault"); }}>{option}</button>)}<button className="text-button" onClick={() => void state.dismissSignal(observation.id)}>Dismiss</button></div></article>)}{!visibleHealth.length && <p className="empty-state">You dismissed the current observations. They will not return unless new activity creates a different signal.</p>}</div>}</section>}
  </section>;
}

function MemoryCard({ memory, editing, onEdit, onSave, onDelete }: { memory: ProjectMemory; editing: boolean; onEdit: () => void; onSave: (patch: Pick<ProjectMemory, "content" | "category" | "scope" | "sensitive">) => Promise<void>; onDelete: () => void }) {
  const [content, setContent] = useState(memory.content);
  const [category, setCategory] = useState<MemoryCategory>(memory.category);
  const [scope, setScope] = useState<MemoryScope>(memory.scope);
  return <article className={memory.sensitive ? "memory-card sensitive" : "memory-card"}><div className="memory-card-head"><span className="evidence-badge">{MEMORY_CATEGORY_LABELS[memory.category]}</span><div>{memory.inferred && <b>Inferred</b>}{memory.sensitive && <b>Sensitive</b>}</div></div>{editing ? <><textarea value={content} onChange={event => setContent(event.target.value)} /><div className="memory-form-grid"><label>SCOPE<select value={scope} onChange={event => setScope(event.target.value as MemoryScope)}>{MEMORY_SCOPES.map(value => <option key={value} value={value}>{MEMORY_SCOPE_LABELS[value]}</option>)}</select></label><label>CATEGORY<select value={category} onChange={event => setCategory(event.target.value as MemoryCategory)}>{MEMORY_CATEGORIES.map(value => <option key={value} value={value}>{MEMORY_CATEGORY_LABELS[value]}</option>)}</select></label></div><div className="vision-actions"><button className="gold" onClick={() => onSave({ content, category, scope, sensitive: memory.sensitive })}>Save</button><button className="ghost" onClick={onEdit}>Cancel</button></div></> : <><p>{memory.content}</p><small>Source: {memory.source_label} · {MEMORY_SCOPE_LABELS[memory.scope]} · saved {new Date(memory.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small><div className="vision-actions"><button className="ghost" onClick={onEdit}>Edit</button><button className="text-button" onClick={onDelete}>Delete</button></div></>}</article>;
}
