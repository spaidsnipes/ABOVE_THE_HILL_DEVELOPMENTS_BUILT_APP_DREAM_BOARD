"use client";

import { useState } from "react";

type Source = { id: number; title: string; body: string };

export function WritingStudioView({ projectTitle, chapterNumber, chapterTitle, draft, setDraft, saveStatus, signedIn, onSaveVersion, onExport, onAskAI, sources, focusMode, setFocusMode, wordCount }: {
  projectTitle: string; chapterNumber: number; chapterTitle: string; draft: string; setDraft: (value: string) => void;
  saveStatus: "saving" | "saved"; signedIn: boolean; onSaveVersion: () => void; onExport: () => void; onAskAI: () => void;
  sources: Source[]; focusMode: boolean; setFocusMode: (value: boolean) => void; wordCount: number;
}) {
  const [showSources, setShowSources] = useState(false);

  return <section className={showSources && !focusMode ? "view writing-view with-sources" : "view writing-view"}>
    <div className="writing-toolbar">
      <div><span className="eyebrow">{projectTitle.toUpperCase()} / CHAPTER {chapterNumber}</span><h2>{chapterTitle}</h2></div>
      <div>
        <span className="draft-status" role="status">{saveStatus === "saving" ? "● Saving…" : signedIn ? "● Saved on this device · versions in your cloud" : "● Saved on this device"}</span>
        <button className="ghost" onClick={() => setShowSources(previous => !previous)} aria-pressed={showSources}>{showSources ? "Hide sources" : "Sources"}</button>
        <button className="ghost" onClick={() => setFocusMode(!focusMode)} aria-pressed={focusMode}>{focusMode ? "Exit focus" : "Focus mode"}</button>
        <button className="ghost" onClick={onSaveVersion}>Save version</button>
        <button className="ghost" onClick={onExport}>Export Markdown</button>
      </div>
    </div>
    <div className="writing-body">
      <textarea
        className="writer"
        value={draft}
        onChange={event => setDraft(event.target.value)}
        aria-label="Manuscript editor"
        placeholder="Start with the words you have. Dreamboard will help you protect, organize, and develop them."
        onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); onSaveVersion(); } }}
      />
      {showSources && !focusMode && <aside className="source-panel" aria-label="Your sources">
        <span className="eyebrow">YOUR SOURCES · READ-ONLY</span>
        {sources.length ? sources.slice(0, 6).map(source => <article key={source.id}><b>{source.title}</b><p>{source.body.slice(0, 220)}{source.body.length > 220 ? "…" : ""}</p></article>) : <p className="empty-state">Material you save to your vaults appears here beside the page.</p>}
      </aside>}
    </div>
    <footer className="writer-footer"><span>{wordCount.toLocaleString()} words in this chapter · ⌘S saves a version</span><button className="text-button" onClick={onAskAI}>Ask Dreamboard AI →</button></footer>
  </section>;
}
