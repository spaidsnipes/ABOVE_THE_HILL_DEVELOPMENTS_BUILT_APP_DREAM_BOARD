"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { buildEpub } from "../lib/epub";
import type { Project } from "./projects";
import type { Chapter } from "./book-architect";

type ExportRecord = { id: string; format: string; title: string; word_count: number; created_at: string };
const COLUMNS = "id,format,title,word_count,created_at";

export function PublishingView({ user, notify, projects, chapters, chapterTitle, draft, projectTitle, displayName }: {
  user: User | null; notify: (message: string) => void; projects: Project[]; chapters: Chapter[];
  chapterTitle: string; draft: string; projectTitle: string; displayName: string;
}) {
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [historyState, setHistoryState] = useState<"local" | "loading" | "ready" | "needs-setup">("local");
  const [working, setWorking] = useState<"" | "markdown" | "epub">("");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setHistoryState("local"); return; }
      setHistoryState("loading");
      const { data, error } = await supabase.from("dreamboard_exports").select(COLUMNS).order("created_at", { ascending: false }).limit(30);
      if (error) { setHistoryState("needs-setup"); return; }
      setHistory((data || []) as ExportRecord[]);
      setHistoryState("ready");
    };
    void load();
  }, [user]);

  const readyProjects = projects.filter(project => project.status === "ready_to_publish" || project.status === "published");
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  const recordExport = async (format: "markdown" | "epub") => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || historyState !== "ready") return;
    const { data } = await supabase.from("dreamboard_exports").insert({ owner_id: user.id, format, title: projectTitle, word_count: wordCount }).select(COLUMNS).single();
    if (data) setHistory(previous => [data as ExportRecord, ...previous]);
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = async () => {
    setWorking("markdown");
    const outline = chapters.length ? `\n## Outline\n\n${chapters.map((chapter, index) => `${index + 1}. ${chapter.title}${chapter.status === "complete" ? " ✓" : ""}`).join("\n")}\n` : "";
    const body = `# ${projectTitle}\n${outline}\n## ${chapterTitle}\n\n${draft}\n`;
    download(new Blob([body], { type: "text/markdown" }), `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`);
    await recordExport("markdown");
    setWorking("");
    notify("A Markdown export of your manuscript was downloaded.");
  };

  const exportEpub = async () => {
    setWorking("epub");
    try {
      const blob = await buildEpub({ bookTitle: projectTitle, chapterTitle, author: displayName || "Dreamboard creator", draft });
      download(blob, `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.epub`);
      await recordExport("epub");
      notify("An EPUB of your current manuscript was downloaded — openable in Apple Books and every major reader.");
    } catch {
      notify("The EPUB could not be built on this device. Your manuscript is unchanged.");
    }
    setWorking("");
  };

  return <section className="view publishing-view">
    <div className="view-heading"><span className="eyebrow">PUBLISHING · FROM ONE SOURCE OF TRUTH</span><h2>Ship the real thing, on purpose.</h2><p>Exports are built from your actual manuscript on this device. Nothing is published anywhere public — every output is a file you hold.</p></div>
    <div className="publish-grid">
      <section className="home-card"><span className="eyebrow">READINESS</span><h3>{readyProjects.length ? `${readyProjects.length} project${readyProjects.length === 1 ? "" : "s"} marked ready` : "No project is marked ready yet"}</h3><p>{readyProjects.length ? readyProjects.map(project => `“${project.title}” (${project.status.replace(/_/g, " ")})`).join(" · ") : "Use the Finishing Engine inside a project — the ready mark unlocks only when every readiness rule passes."}</p><p className="import-truth">Exporting is always allowed; the readiness mark is guidance, not a gate on your own work.</p></section>
      <section className="home-card"><span className="eyebrow">EXPORT · {wordCount.toLocaleString()} WORDS IN THE CURRENT MANUSCRIPT</span><h3>{projectTitle}</h3>
        <div className="vision-actions">
          <button className="gold" onClick={() => void exportMarkdown()} disabled={working !== ""}>{working === "markdown" ? "Building…" : "Export Markdown"} <b>→</b></button>
          <button className="gold" onClick={() => void exportEpub()} disabled={working !== ""}>{working === "epub" ? "Building…" : "Export EPUB"} <b>→</b></button>
        </div>
        <div className="connection-note"><b>Not available yet (and not faked):</b><span>PDF export, a public preview page, and direct destinations (blog, newsletter, print) ship as real integrations later. No button here pretends otherwise.</span></div>
      </section>
    </div>
    <section className="batch-history"><div className="card-head"><div><span className="eyebrow">EXPORT HISTORY</span><h3>Every version you shipped.</h3></div></div>
      {historyState === "needs-setup" && <div className="connection-note"><b>History setup needed:</b><span>Run supabase/dreamboard-publishing.sql to keep a versioned export history under your Passport.</span></div>}
      {historyState === "local" && <p className="empty-state">Sign in with your Passport to keep a permanent export history. Downloads work either way.</p>}
      {historyState === "ready" && (history.length ? <div>{history.map(record => <article key={record.id}><span className="batch-dot uploaded" /><div><b>{record.title || "Untitled"} · {record.format.toUpperCase()}</b><small>{new Date(record.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {record.word_count.toLocaleString()} words</small></div><em>{record.format}</em></article>)}</div> : <p className="empty-state">No exports recorded yet. Your first one appears here with its word count and date.</p>)}
    </section>
  </section>;
}
