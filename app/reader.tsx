"use client";

import { useRef, useState } from "react";

export function ReaderView({ draft, chapterIndex, chapterTitles, onSelectChapter, projectTitle }: { draft: string; chapterIndex: number; chapterTitles: string[]; onSelectChapter: (index: number) => void; projectTitle: string }) {
  const [mode, setMode] = useState<"comfortable" | "night" | "paper">("comfortable");
  const [scale, setScale] = useState(18);
  const [progress, setProgress] = useState(0);
  const pageRef = useRef<HTMLElement>(null);

  const onScroll = () => {
    const page = pageRef.current;
    if (!page) return;
    const total = page.scrollHeight - page.clientHeight;
    setProgress(total > 0 ? Math.min(100, Math.round((page.scrollTop / total) * 100)) : 100);
  };

  const title = chapterTitles[Math.min(chapterIndex, chapterTitles.length - 1)];
  return <section className="view reader-view">
    <div className="reader-toolbar">
      <div><span className="eyebrow">DREAMBOARD READER · PREVIEW</span><h2>{projectTitle}</h2></div>
      <div className="reader-controls">
        {chapterTitles.length > 1 && <label className="vision-status">CHAPTER<select value={Math.min(chapterIndex, chapterTitles.length - 1)} onChange={event => onSelectChapter(Number(event.target.value))}>{chapterTitles.map((item, index) => <option key={`${item}-${index}`} value={index}>{index + 1}. {item}</option>)}</select></label>}
        <label>TYPE SIZE<input type="range" min="15" max="25" value={scale} onChange={event => setScale(Number(event.target.value))} /></label>
        <div>{(["comfortable", "night", "paper"] as const).map(item => <button key={item} className={mode === item ? "reader-mode selected" : "reader-mode"} onClick={() => setMode(item)}>{item}</button>)}</div>
        <button className="ghost" onClick={() => window.print()}>Proof / print preview</button>
      </div>
    </div>
    <div className="reader-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress"><i style={{ width: `${progress}%` }} /></div>
    <article ref={pageRef} onScroll={onScroll} className={`reader-page reader-${mode}`} style={{ fontSize: `${scale}px` }}>
      <span className="reader-kicker">CHAPTER {Math.min(chapterIndex, chapterTitles.length - 1) + 1}</span>
      <h3>{title}</h3>
      {draft.trim() ? draft.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="reader-empty">Your writing will appear here when you begin.</p>}
      {chapterTitles.length > 1 && <p className="reader-note">The Reader currently shows your working draft. Full-book reading across saved chapter documents arrives with per-chapter manuscripts.</p>}
      <footer><span>DREAMBOARD</span><b>{Math.min(chapterIndex, chapterTitles.length - 1) + 1}</b></footer>
    </article>
  </section>;
}
