"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export type VisionCaptureType = "text" | "voice" | "image" | "file" | "link" | "sketch" | "quick_capture";
export type VisionStatus = "inbox" | "developing" | "incubating" | "ready_for_project" | "archived";
export type VisionEntry = { id: string; title: string; content: string; capture_type: VisionCaptureType; status: VisionStatus; tags: string[]; project_id: string | null; created_at: string; updated_at: string; archived_at: string | null; local: boolean };

const LOCAL_KEY = "dreamboard-vision-entries";
const CLOUD_COLUMNS = "id,title,content,capture_type,status,tags,project_id,created_at,updated_at,archived_at";
const statusLabels: Array<[VisionStatus, string]> = [["inbox", "Inbox"], ["developing", "Developing"], ["incubating", "Incubating"], ["ready_for_project", "Ready for a project"], ["archived", "Archived"]];

function deriveTitle(content: string) {
  return content.trim().split(/\n|\.|!|\?/)[0].slice(0, 58).trim() || "Untitled idea";
}

function readLocalEntries(): VisionEntry[] {
  if (typeof window === "undefined") return [];
  try { const saved = window.localStorage.getItem(LOCAL_KEY); return saved ? (JSON.parse(saved) as VisionEntry[]) : []; } catch { return []; }
}

export type VisionVaultState = {
  entries: VisionEntry[];
  cloudState: "local" | "loading" | "ready" | "needs-setup";
  addEntry: (content: string, captureType?: VisionCaptureType) => Promise<void>;
  updateEntry: (id: string, patch: Partial<Pick<VisionEntry, "title" | "content" | "status">>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  secureToCloud: (id: string) => Promise<void>;
};

export function useVisionVault(user: User | null, notify: (message: string) => void, primaryProjectId: string | null = null): VisionVaultState {
  const [localEntries, setLocalEntries] = useState<VisionEntry[]>([]);
  const [cloudEntries, setCloudEntries] = useState<VisionEntry[]>([]);
  const [cloudState, setCloudState] = useState<VisionVaultState["cloudState"]>("local");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setLocalEntries(readLocalEntries()); setHydrated(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(localEntries)); }, [localEntries, hydrated]);
  useEffect(() => {
    const loadCloud = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setCloudEntries([]); setCloudState("local"); return; }
      setCloudState("loading");
      const { data, error } = await supabase.from("dreamboard_vision_entries").select(CLOUD_COLUMNS).order("updated_at", { ascending: false }).limit(500);
      if (error) { setCloudState("needs-setup"); return; }
      setCloudEntries(((data || []) as Array<Omit<VisionEntry, "local">>).map(entry => ({ ...entry, tags: entry.tags || [], project_id: entry.project_id ?? null, local: false })));
      setCloudState("ready");
    };
    void loadCloud();
  }, [user]);

  const entries = useMemo(() => [...localEntries, ...cloudEntries].sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [localEntries, cloudEntries]);

  const addEntry = async (content: string, captureType: VisionCaptureType = "text") => {
    const clean = content.trim();
    if (!clean) return;
    const supabase = getSupabaseBrowserClient();
    const now = new Date().toISOString();
    const title = deriveTitle(clean);
    if (supabase && user && cloudState !== "needs-setup") {
      const { data, error } = await supabase.from("dreamboard_vision_entries").insert({ owner_id: user.id, title, content: clean, capture_type: captureType, source_type: captureType === "quick_capture" ? "quick_capture" : "manual", project_id: primaryProjectId }).select(CLOUD_COLUMNS).single();
      if (!error && data) { setCloudEntries(previous => [{ ...(data as Omit<VisionEntry, "local">), tags: (data as { tags: string[] | null }).tags || [], project_id: (data as { project_id: string | null }).project_id ?? null, local: false }, ...previous]); notify("Captured to your private Vision Vault."); return; }
    }
    setLocalEntries(previous => [{ id: `local-${Date.now()}`, title, content: clean, capture_type: captureType, status: "inbox", tags: [], project_id: primaryProjectId, created_at: now, updated_at: now, archived_at: null, local: true }, ...previous]);
    notify(user ? "Captured on this device. Dreamboard could not reach your cloud Vision Vault yet." : "Captured on this device. Sign in with your Passport to keep ideas in your private cloud vault.");
  };

  const updateEntry = async (id: string, patch: Partial<Pick<VisionEntry, "title" | "content" | "status">>) => {
    const now = new Date().toISOString();
    const apply = (entry: VisionEntry): VisionEntry => entry.id === id ? { ...entry, ...patch, updated_at: now, archived_at: patch.status === "archived" ? now : patch.status ? null : entry.archived_at } : entry;
    if (id.startsWith("local-")) { setLocalEntries(previous => previous.map(apply)); return; }
    setCloudEntries(previous => previous.map(apply));
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_vision_entries").update({ ...patch, updated_at: now, ...(patch.status ? { archived_at: patch.status === "archived" ? now : null } : {}) }).eq("id", id);
    if (error) notify("That change is visible here but could not be saved to the cloud yet. Please try again.");
  };

  const deleteEntry = async (id: string) => {
    if (id.startsWith("local-")) { setLocalEntries(previous => previous.filter(entry => entry.id !== id)); notify("The idea was deleted from this device."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_vision_entries").delete().eq("id", id);
    if (error) { notify("Dreamboard could not delete that entry. Please try again."); return; }
    setCloudEntries(previous => previous.filter(entry => entry.id !== id));
    notify("The idea was permanently deleted from your Vision Vault.");
  };

  const secureToCloud = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    const entry = localEntries.find(item => item.id === id);
    if (!entry || !supabase || !user) return;
    const { data, error } = await supabase.from("dreamboard_vision_entries").insert({ owner_id: user.id, title: entry.title, content: entry.content, capture_type: entry.capture_type, status: entry.status, source_type: "migration", tags: entry.tags, project_id: entry.project_id }).select(CLOUD_COLUMNS).single();
    if (error || !data) { notify("This idea stays safe on this device. The cloud copy could not be saved yet."); return; }
    setCloudEntries(previous => [{ ...(data as Omit<VisionEntry, "local">), tags: (data as { tags: string[] | null }).tags || [], project_id: (data as { project_id: string | null }).project_id ?? null, local: false }, ...previous]);
    setLocalEntries(previous => previous.filter(item => item.id !== id));
    notify("This idea is now secured in your private cloud Vision Vault.");
  };

  return { entries, cloudState, addEntry, updateEntry, deleteEntry, secureToCloud };
}

export function QuickCaptureCard({ vault, onOpen }: { vault: VisionVaultState; onOpen: () => void }) {
  const [text, setText] = useState("");
  const capture = async () => { const clean = text.trim(); if (!clean) return; await vault.addEntry(clean, "quick_capture"); setText(""); };
  return <section className="home-card quick-capture">
    <div className="card-head"><div><span className="eyebrow">VISION VAULT · QUICK CAPTURE</span><h3>Catch the idea before it fades.</h3></div><button onClick={onOpen}>Open vault →</button></div>
    <textarea value={text} onChange={event => setText(event.target.value)} placeholder="An idea, a dream, a sentence worth keeping…" aria-label="Quick capture" onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void capture(); }} />
    <button className="gold" onClick={() => void capture()} disabled={!text.trim()}>Capture <b>→</b></button>
  </section>;
}

export function VisionVaultView({ vault, signedIn, onPassport, includes, filtersOn, contextLabel, onShowAll }: { vault: VisionVaultState; signedIn: boolean; onPassport: () => void; includes: (projectId: string | null | undefined) => boolean; filtersOn: boolean; contextLabel: string; onShowAll: () => void }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VisionStatus | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const activeCount = vault.entries.filter(entry => entry.status !== "archived").length;
  const visible = useMemo(() => vault.entries
    .filter(entry => includes(entry.project_id))
    .filter(entry => statusFilter === "all" ? entry.status !== "archived" : entry.status === statusFilter)
    .filter(entry => `${entry.title} ${entry.content}`.toLowerCase().includes(query.toLowerCase())), [vault.entries, statusFilter, query, includes]);

  const startEdit = (entry: VisionEntry) => { setEditingId(entry.id); setEditTitle(entry.title); setEditContent(entry.content); };
  const saveEdit = async () => { if (!editingId) return; await vault.updateEntry(editingId, { title: editTitle.trim() || "Untitled idea", content: editContent }); setEditingId(null); };
  const confirmDelete = (entry: VisionEntry) => { if (window.confirm(`Permanently delete “${entry.title}”? This cannot be undone.`)) void vault.deleteEntry(entry.id); };

  return <section className="view vision-view">
    <div className="view-heading split"><div><span className="eyebrow">YOUR OWN EMERGING MATERIAL · PRIVATE BY DEFAULT</span><h2>Vision Vault</h2><p>{activeCount ? `${activeCount} idea${activeCount === 1 ? "" : "s"} in motion. Nothing here is shared unless you choose to share it.` : "Ideas, dreams, goals, and sparks live here — separate from your research in the Knowledge Vault."}</p></div></div>
    {filtersOn && <div className="context-banner"><span>◈ Showing {contextLabel}</span><button className="text-button" onClick={onShowAll}>Show all projects</button></div>}
    {vault.cloudState === "needs-setup" && <div className="connection-note"><b>Cloud vault setup needed:</b><span>Run supabase/dreamboard-vision-vault.sql in your Supabase project to enable the private cloud Vision Vault. Until then, captures stay on this device.</span></div>}
    <div className="input-card vision-capture"><label>CAPTURE AN IDEA<textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="A dream, a goal, an observation, an unfinished thought…" /></label><button className="gold" onClick={() => { void vault.addEntry(draft); setDraft(""); }} disabled={!draft.trim()}>Keep this idea <b>→</b></button></div>
    <div className="vision-filters" role="group" aria-label="Filter by status"><button className={statusFilter === "all" ? "season active" : "season"} onClick={() => setStatusFilter("all")}>All active</button>{statusLabels.map(([value, label]) => <button key={value} className={statusFilter === value ? "season active" : "season"} onClick={() => setStatusFilter(value)}>{label}</button>)}</div>
    <label className="searchbox">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your ideas, dreams, and goals" /></label>
    <div className="vault-list">
      {visible.map(entry => <article key={entry.id}>
        <div className="vault-icon">✧</div>
        {editingId === entry.id
          ? <div className="vision-edit"><input value={editTitle} onChange={event => setEditTitle(event.target.value)} aria-label="Idea title" maxLength={240} /><textarea value={editContent} onChange={event => setEditContent(event.target.value)} aria-label="Idea content" /><div className="vision-actions"><button className="gold" onClick={() => void saveEdit()}>Save</button><button className="ghost" onClick={() => setEditingId(null)}>Cancel</button></div></div>
          : <div><span>{entry.capture_type.replace("_", " ")} · {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{entry.local ? " · on this device" : ""}</span><h3>{entry.title}</h3><p>{entry.content}</p>
            <div className="vision-actions">
              <label className="vision-status">STATUS<select value={entry.status} onChange={event => void vault.updateEntry(entry.id, { status: event.target.value as VisionStatus })}>{statusLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <button className="ghost" onClick={() => startEdit(entry)}>Edit</button>
              {entry.status === "archived"
                ? <><button className="ghost" onClick={() => void vault.updateEntry(entry.id, { status: "inbox" })}>Restore</button><button className="ghost" onClick={() => confirmDelete(entry)}>Delete</button></>
                : <button className="ghost" onClick={() => void vault.updateEntry(entry.id, { status: "archived" })}>Archive</button>}
              {entry.local && signedIn && vault.cloudState === "ready" && <button className="ghost" onClick={() => void vault.secureToCloud(entry.id)}>Secure to cloud</button>}
            </div></div>}
        <div className="tag-stack"><b>{statusLabels.find(([value]) => value === entry.status)?.[1] || entry.status}</b></div>
      </article>)}
      {!visible.length && <p className="empty-state">{query || statusFilter !== "all" ? "Nothing matched that view. Your ideas remain safe in the vault." : "Your Vision Vault is ready. Capture the first idea above — it stays private to you."}</p>}
    </div>
    {!signedIn && <section className="graph-truth"><div><span className="eyebrow">PRIVATE BY DEFAULT</span><h3>Your ideas, on your terms.</h3></div><p>Ideas captured now stay on this device. <button className="text-button" onClick={onPassport}>Set up your Passport</button> to keep them in your private cloud vault, available wherever you sign in.</p></section>}
  </section>;
}
