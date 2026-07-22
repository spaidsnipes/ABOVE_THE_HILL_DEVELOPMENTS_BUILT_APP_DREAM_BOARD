"use client";

import { useMemo, useState } from "react";
import { analyzeNotes, type OrganizeNote } from "../lib/organize";

export function OrganizeReview({ notes, onApply, onClose }: { notes: OrganizeNote[]; onApply: (assignments: Array<{ id: number; theme: string }>) => void; onClose: () => void }) {
  const proposal = useMemo(() => analyzeNotes(notes), [notes]);
  const [approved, setApproved] = useState<Set<string>>(new Set(proposal.clusters.map(cluster => cluster.keyword)));
  const noteById = useMemo(() => new Map(notes.map(note => [note.id, note])), [notes]);

  const toggle = (keyword: string) => setApproved(previous => { const next = new Set(previous); if (next.has(keyword)) next.delete(keyword); else next.add(keyword); return next; });
  const apply = () => {
    const assignments: Array<{ id: number; theme: string }> = [];
    for (const cluster of proposal.clusters) {
      if (!approved.has(cluster.keyword)) continue;
      for (const id of cluster.noteIds) assignments.push({ id, theme: cluster.label });
    }
    onApply(assignments);
  };

  return <section className="organize-review">
    <div className="card-head"><div><span className="eyebrow">ORGANIZE MY NOTES · DETERMINISTIC RULES — NO AI RAN</span><h3>A proposal, not a decision.</h3></div><button className="ghost" onClick={onClose}>Close without changes</button></div>
    <p className="import-truth">Dreamboard analyzed {proposal.analyzed} note{proposal.analyzed === 1 ? "" : "s"} using transparent word-recurrence rules on this device. Approve the theme groups you agree with — original tags are kept, and nothing changes until you apply.</p>
    {proposal.clusters.length ? <div className="organize-clusters">{proposal.clusters.map(cluster => <label key={cluster.keyword} className="organize-cluster"><input type="checkbox" checked={approved.has(cluster.keyword)} onChange={() => toggle(cluster.keyword)} /><div><b>{cluster.label}</b><small>{cluster.noteIds.length} notes share this word: {cluster.noteIds.slice(0, 4).map(id => `“${(noteById.get(id)?.title || "").slice(0, 34)}”`).join(", ")}{cluster.noteIds.length > 4 ? "…" : ""}</small></div></label>)}</div> : <p className="empty-state">No recurring themes found yet — that usually means the notes are still too few or too different. Nothing was changed.</p>}
    {proposal.duplicates.length > 0 && <div className="organize-extra"><span className="eyebrow">POSSIBLE DUPLICATES · REVIEW YOURSELF</span>{proposal.duplicates.slice(0, 6).map(([a, b]) => <p key={`${a}-${b}`}>“{(noteById.get(a)?.title || "").slice(0, 40)}” and “{(noteById.get(b)?.title || "").slice(0, 40)}” look very similar. Dreamboard never deletes — merge them yourself if they are the same.</p>)}</div>}
    {proposal.questions.length > 0 && <div className="organize-extra"><span className="eyebrow">OPEN QUESTIONS IN YOUR OWN WORDS</span><p>{proposal.questions.slice(0, 6).map(id => `“${(noteById.get(id)?.title || "").slice(0, 44)}”`).join(" · ")}</p></div>}
    <div className="vision-actions"><button className="gold" onClick={apply} disabled={![...approved].some(keyword => proposal.clusters.some(cluster => cluster.keyword === keyword))}>Apply approved themes <b>→</b></button><span className="import-truth">Approved theme tags are added alongside existing tags; “Unsorted” is removed only from themed notes.</span></div>
  </section>;
}
