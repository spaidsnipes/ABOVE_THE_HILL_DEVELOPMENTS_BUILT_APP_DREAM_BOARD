"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { templateForKind } from "../lib/project-types";
import type { Project } from "./projects";
import type { VisionEntry } from "./vision-vault";

type ExportRecord = { id: string; format: string; title: string; word_count: number; created_at: string };
type Snapshot = { id: number; label: string; date: string; words: number };

export type LegacyState = { exports: ExportRecord[]; loadState: "idle" | "loading" | "ready" | "needs-setup" };

export function useLegacy(user: User | null): LegacyState {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loadState, setLoadState] = useState<LegacyState["loadState"]>("idle");
  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setExports([]); setLoadState("idle"); return; }
      setLoadState("loading");
      const { data, error } = await supabase.from("dreamboard_exports").select("id,format,title,word_count,created_at").order("created_at", { ascending: false }).limit(100);
      if (error) { setLoadState("needs-setup"); return; }
      setExports((data || []) as ExportRecord[]);
      setLoadState("ready");
    };
    void load();
  }, [user]);
  return { exports, loadState };
}

function daysAgo(iso: string): number { return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); }

export function LegacyView({ legacy, projects, visionEntries, snapshots, signedIn, onPassport, onGo }: {
  legacy: LegacyState; projects: Project[]; visionEntries: VisionEntry[]; snapshots: Snapshot[];
  signedIn: boolean; onPassport: () => void; onGo: (target: "Vision Vault" | "Version History" | "Projects" | "Publishing") => void;
}) {
  const [tab, setTab] = useState<"time" | "legacy">("time");

  // On This Day: items created on today's month/day in an earlier period.
  const onThisDay = useMemo(() => {
    const now = new Date();
    const md = (iso: string) => { const d = new Date(iso); return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && daysAgo(iso) >= 1; };
    const items: Array<{ key: string; label: string; kind: string; when: string; target: "Vision Vault" | "Version History" }> = [];
    for (const entry of visionEntries) if (md(entry.created_at)) items.push({ key: `v-${entry.id}`, label: entry.title, kind: "idea", when: entry.created_at, target: "Vision Vault" });
    return items;
  }, [visionEntries]);

  const evolution = useMemo(() => projects.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)), [projects]);
  const finished = projects.filter(project => project.status === "completed" || project.status === "published");

  if (!signedIn && !visionEntries.length && !snapshots.length) return <section className="view"><div className="view-heading"><span className="eyebrow">TIME MACHINE & LEGACY</span><h2>The long view of your work.</h2><p>This is where your earlier ideas resurface and your finished work is preserved. It fills in as you create — sign in with your Passport to keep it across devices.</p></div><button className="gold" onClick={onPassport}>Set up Passport <b>→</b></button></section>;

  return <section className="view legacy-view">
    <div className="view-heading"><span className="eyebrow">TIME MACHINE & LEGACY LIBRARY</span><h2>{tab === "time" ? "What your work remembers." : "The work you finished."}</h2><p>{tab === "time" ? "Earlier ideas, past drafts, and how your thinking has changed — never a scoreboard, never shame for what is unfinished." : "Completed and published projects, and everything you have exported, preserved in one place."}</p></div>
    <div className="vision-filters" role="tablist"><button role="tab" aria-selected={tab === "time"} className={tab === "time" ? "season active" : "season"} onClick={() => setTab("time")}>Time Machine</button><button role="tab" aria-selected={tab === "legacy"} className={tab === "legacy" ? "season active" : "season"} onClick={() => setTab("legacy")}>Legacy Library</button></div>

    {tab === "time" && <>
      <section className="home-card"><div className="card-head"><div><span className="eyebrow">ON THIS DAY</span><h3>{onThisDay.length ? "You were here before." : "Nothing resurfaced today."}</h3></div>{onThisDay.length > 0 && <button onClick={() => onGo("Vision Vault")}>Open vault →</button>}</div>{onThisDay.length ? onThisDay.map(item => <button className="note-row" key={item.key} onClick={() => onGo(item.target)}><span>✧</span><div><b>{item.label}</b><small>{item.kind} · {new Date(item.when).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small></div><em>{daysAgo(item.when)}d ago</em></button>) : <p className="empty-state">Your timeline is still young — as the seasons pass, ideas from this day in earlier years will surface here.</p>}</section>
      <section className="home-card"><div className="card-head"><div><span className="eyebrow">HOW YOUR PROJECTS EVOLVED</span><h3>{evolution.length ? "Every project has a history." : "No projects yet."}</h3></div></div>{evolution.length ? <div className="research-list">{evolution.map(project => <article key={project.id}><b>{templateForKind(project.kind, project.custom_type_label).icon} {project.title}</b><small>Started {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · last touched {daysAgo(project.updated_at)}d ago · {project.status.replace(/_/g, " ")}</small></article>)}</div> : <p className="empty-state">Create a project and its evolution will be recorded here — including the directions you set aside, without judgment.</p>}</section>
      {snapshots.length > 0 && <section className="home-card"><div className="card-head"><div><span className="eyebrow">EARLIER DRAFTS</span><h3>Your writing has a way back.</h3></div><button onClick={() => onGo("Version History")}>Open history →</button></div>{snapshots.slice(0, 4).map(snapshot => <button className="note-row" key={snapshot.id} onClick={() => onGo("Version History")}><span>◫</span><div><b>{snapshot.label}</b><small>{snapshot.date} · {snapshot.words.toLocaleString()} words</small></div></button>)}</section>}
    </>}

    {tab === "legacy" && <>
      <section className="home-card"><div className="card-head"><div><span className="eyebrow">COMPLETED & PUBLISHED</span><h3>{finished.length ? `${finished.length} finished work${finished.length === 1 ? "" : "s"}` : "Nothing finished yet — and that's fine."}</h3></div><button onClick={() => onGo("Projects")}>Open Projects →</button></div>{finished.length ? <div className="research-list">{finished.map(project => <article key={project.id}><b>{templateForKind(project.kind, project.custom_type_label).icon} {project.title}</b><small>{project.status.replace(/_/g, " ")} · {templateForKind(project.kind, project.custom_type_label).label}</small></article>)}</div> : <p className="empty-state">When you mark a project completed or published, it is preserved here as part of your legacy.</p>}</section>
      <section className="home-card"><div className="card-head"><div><span className="eyebrow">EXPORT HISTORY</span><h3>Everything you shipped.</h3></div><button onClick={() => onGo("Publishing")}>Open Publishing →</button></div>{legacy.loadState === "needs-setup" ? <div className="connection-note"><b>Export history setup needed:</b><span>Run supabase/dreamboard-publishing.sql to keep a permanent export history.</span></div> : legacy.exports.length ? <div className="research-list">{legacy.exports.map(record => <article key={record.id}><b>{record.title || "Untitled"} · {record.format.toUpperCase()}</b><small>{new Date(record.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {record.word_count.toLocaleString()} words</small></article>)}</div> : <p className="empty-state">No exports yet. Every Markdown or EPUB you export is recorded here.</p>}</section>
    </>}
  </section>;
}
