"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export type ChapterStatus = "outline" | "drafting" | "revising" | "complete";
export type Chapter = { id: string; project_id: string | null; part: string; title: string; purpose: string; notes: string; status: ChapterStatus; sort_order: number; local: boolean };

const LOCAL_KEY = "dreamboard-chapters";
const COLUMNS = "id,project_id,part,title,purpose,notes,status,sort_order";
const STATUS_LABELS: Array<[ChapterStatus, string]> = [["outline", "Outline"], ["drafting", "Drafting"], ["revising", "Revising"], ["complete", "Complete"]];

function readLocalChapters(): Chapter[] {
  if (typeof window === "undefined") return [];
  try { const saved = window.localStorage.getItem(LOCAL_KEY); return saved ? (JSON.parse(saved) as Chapter[]) : []; } catch { return []; }
}

export type ChaptersState = {
  chapters: Chapter[];
  loadState: "local" | "loading" | "ready" | "needs-setup";
  addChapter: (title: string) => Promise<void>;
  updateChapter: (id: string, patch: Partial<Pick<Chapter, "title" | "purpose" | "notes" | "status" | "part" | "project_id">>) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  duplicateChapter: (id: string) => Promise<void>;
  moveChapter: (id: string, direction: -1 | 1) => Promise<void>;
};

export function useChapters(user: User | null, notify: (message: string) => void): ChaptersState {
  const [localChapters, setLocalChapters] = useState<Chapter[]>([]);
  const [cloudChapters, setCloudChapters] = useState<Chapter[]>([]);
  const [loadState, setLoadState] = useState<ChaptersState["loadState"]>("local");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setLocalChapters(readLocalChapters()); setHydrated(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(localChapters)); }, [localChapters, hydrated]);
  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setCloudChapters([]); setLoadState("local"); return; }
      setLoadState("loading");
      const { data, error } = await supabase.from("dreamboard_chapters").select(COLUMNS).order("sort_order", { ascending: true }).limit(400);
      if (error) { setLoadState("needs-setup"); return; }
      setCloudChapters(((data || []) as Array<Omit<Chapter, "local">>).map(chapter => ({ ...chapter, local: false })));
      setLoadState("ready");
    };
    void load();
  }, [user]);

  const cloudMode = loadState === "ready";
  const chapters = useMemo(() => (cloudMode ? cloudChapters : localChapters).slice().sort((a, b) => a.sort_order - b.sort_order), [cloudMode, cloudChapters, localChapters]);

  const addChapter = async (title: string) => {
    const clean = title.trim().slice(0, 200);
    if (!clean) return;
    const nextOrder = chapters.length ? Math.max(...chapters.map(chapter => chapter.sort_order)) + 1 : 1;
    if (cloudMode) {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) return;
      const { data, error } = await supabase.from("dreamboard_chapters").insert({ owner_id: user.id, title: clean, sort_order: nextOrder }).select(COLUMNS).single();
      if (error || !data) { notify("Dreamboard could not add that chapter. Please try again."); return; }
      setCloudChapters(previous => [...previous, { ...(data as Omit<Chapter, "local">), local: false }]);
    } else {
      setLocalChapters(previous => [...previous, { id: `local-${Date.now()}`, project_id: null, part: "", title: clean, purpose: "", notes: "", status: "outline", sort_order: nextOrder, local: true }]);
    }
    notify(`Chapter “${clean.slice(0, 50)}” added to your outline.`);
  };

  const updateChapter = async (id: string, patch: Partial<Pick<Chapter, "title" | "purpose" | "notes" | "status" | "part" | "project_id">>) => {
    const apply = (chapter: Chapter): Chapter => chapter.id === id ? { ...chapter, ...patch } : chapter;
    if (!cloudMode || id.startsWith("local-")) { setLocalChapters(previous => previous.map(apply)); return; }
    setCloudChapters(previous => previous.map(apply));
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_chapters").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) notify("That chapter change could not save to the cloud yet. Please try again.");
  };

  const deleteChapter = async (id: string) => {
    if (!cloudMode || id.startsWith("local-")) { setLocalChapters(previous => previous.filter(chapter => chapter.id !== id)); notify("The chapter was removed from your outline."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_chapters").delete().eq("id", id);
    if (error) { notify("Dreamboard could not delete that chapter. Please try again."); return; }
    setCloudChapters(previous => previous.filter(chapter => chapter.id !== id));
    notify("The chapter was deleted. Saved manuscript versions are unaffected.");
  };

  const duplicateChapter = async (id: string) => {
    const source = chapters.find(chapter => chapter.id === id);
    if (!source) return;
    const nextOrder = source.sort_order + 1;
    if (cloudMode) {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) return;
      const { data, error } = await supabase.from("dreamboard_chapters").insert({ owner_id: user.id, project_id: source.project_id, part: source.part, title: `${source.title} (copy)`.slice(0, 200), purpose: source.purpose, notes: source.notes, status: "outline", sort_order: nextOrder }).select(COLUMNS).single();
      if (error || !data) { notify("Dreamboard could not duplicate that chapter."); return; }
      setCloudChapters(previous => [...previous, { ...(data as Omit<Chapter, "local">), local: false }]);
    } else {
      setLocalChapters(previous => [...previous, { ...source, id: `local-${Date.now()}`, title: `${source.title} (copy)`.slice(0, 200), status: "outline", sort_order: nextOrder }]);
    }
    notify("Chapter duplicated. Reorder it into place when ready.");
  };

  const moveChapter = async (id: string, direction: -1 | 1) => {
    const ordered = chapters;
    const index = ordered.findIndex(chapter => chapter.id === id);
    const swapWith = ordered[index + direction];
    if (index < 0 || !swapWith) return;
    const current = ordered[index];
    const patchPair = (list: Chapter[]) => list.map(chapter => chapter.id === current.id ? { ...chapter, sort_order: swapWith.sort_order } : chapter.id === swapWith.id ? { ...chapter, sort_order: current.sort_order } : chapter);
    if (!cloudMode) { setLocalChapters(patchPair); return; }
    setCloudChapters(patchPair);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const [first, second] = await Promise.all([
      supabase.from("dreamboard_chapters").update({ sort_order: swapWith.sort_order }).eq("id", current.id),
      supabase.from("dreamboard_chapters").update({ sort_order: current.sort_order }).eq("id", swapWith.id),
    ]);
    if (first.error || second.error) notify("The new order could not fully save. Refresh to see the stored order.");
  };

  return { chapters, loadState, addChapter, updateChapter, deleteChapter, duplicateChapter, moveChapter };
}

export function BookArchitectView({ state, activeIndex, onSelect, sourceTitles, onWrite, onVault }: { state: ChaptersState; activeIndex: number; onSelect: (index: number) => void; sourceTitles: string[]; onWrite: () => void; onVault: () => void }) {
  const [newTitle, setNewTitle] = useState("");
  const ordered = state.chapters;
  const active = ordered[Math.min(activeIndex, Math.max(0, ordered.length - 1))] || null;

  return <section className="view architect">
    <div className="view-heading"><span className="eyebrow">MANUSCRIPT ARCHITECTURE · REAL CHAPTERS</span><h2>Shape the path before you write it.</h2><p>{ordered.length ? `${ordered.length} chapter${ordered.length === 1 ? "" : "s"} in your structure — ${ordered.filter(chapter => chapter.status === "complete").length} complete. Nothing here is generated for you.` : "Your outline starts empty on purpose. Add the first chapter when you know its honest name."}</p></div>
    {state.loadState === "needs-setup" && <div className="connection-note"><b>Chapters setup needed:</b><span>Run supabase/dreamboard-book-architect.sql in your Supabase project to store your outline in the cloud. Until then, chapters stay on this device.</span></div>}
    {state.loadState === "local" && <div className="connection-note"><b>On this device:</b><span>Chapters are saved locally. Sign in with your Passport to keep your outline in your private cloud workspace.</span></div>}
    <div className="input-card architect-add"><label>NEW CHAPTER TITLE<input value={newTitle} onChange={event => setNewTitle(event.target.value)} maxLength={200} placeholder="e.g. Learning to Listen" onKeyDown={event => { if (event.key === "Enter" && newTitle.trim()) { void state.addChapter(newTitle); setNewTitle(""); } }} /></label><button className="gold" onClick={() => { void state.addChapter(newTitle); setNewTitle(""); }} disabled={!newTitle.trim()}>Add chapter <b>→</b></button></div>
    {ordered.length > 0 && <div className="outline">
      <div>{ordered.map((item, index) => <div key={item.id} className={index === activeIndex ? "chapter active-chapter chapter-row" : "chapter chapter-row"}><button className="chapter-main" onClick={() => onSelect(index)}><b>{String(index + 1).padStart(2, "0")}</b><span>{item.title}</span><i>{index === activeIndex ? "Editing" : STATUS_LABELS.find(([value]) => value === item.status)?.[1]}</i></button><span className="chapter-tools"><button onClick={() => void state.moveChapter(item.id, -1)} disabled={index === 0} aria-label={`Move ${item.title} up`}>↑</button><button onClick={() => void state.moveChapter(item.id, 1)} disabled={index === ordered.length - 1} aria-label={`Move ${item.title} down`}>↓</button></span></div>)}</div>
      {active && <aside>
        <span className="eyebrow">CHAPTER {Math.min(activeIndex, ordered.length - 1) + 1} · {STATUS_LABELS.find(([value]) => value === active.status)?.[1]?.toUpperCase()}</span>
        <ChapterEditor key={active.id} chapter={active} state={state} />
        <p>Source suggestions come from your vault. They are suggestions only; you decide what becomes part of the manuscript.</p>
        <div className="source-chips">{sourceTitles.slice(0, 3).map(title => <button key={title} onClick={onVault}>{title}</button>)}</div>
        <button className="gold wide" onClick={onWrite}>Write this chapter <b>→</b></button>
      </aside>}
    </div>}
  </section>;
}

function ChapterEditor({ chapter, state }: { chapter: Chapter; state: ChaptersState }) {
  const [title, setTitle] = useState(chapter.title);
  const [purpose, setPurpose] = useState(chapter.purpose);
  const [notes, setNotes] = useState(chapter.notes);
  const dirty = title !== chapter.title || purpose !== chapter.purpose || notes !== chapter.notes;
  return <div className="chapter-editor">
    <label>TITLE<input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} /></label>
    <label>PURPOSE<textarea value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="What the reader should carry away from this chapter." /></label>
    <label>WORKING NOTES<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Scenes, sources, and questions for this chapter." /></label>
    <div className="vision-actions">
      <button className="gold" onClick={() => void state.updateChapter(chapter.id, { title: title.trim() || chapter.title, purpose, notes })} disabled={!dirty}>{dirty ? "Save chapter" : "Saved"}</button>
      <label className="vision-status">STATUS<select value={chapter.status} onChange={event => void state.updateChapter(chapter.id, { status: event.target.value as ChapterStatus })}>{STATUS_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="ghost" onClick={() => void state.duplicateChapter(chapter.id)}>Duplicate</button>
      <button className="ghost" onClick={() => { if (window.confirm(`Delete chapter “${chapter.title}”? Saved manuscript versions are kept.`)) void state.deleteChapter(chapter.id); }}>Delete</button>
    </div>
  </div>;
}
