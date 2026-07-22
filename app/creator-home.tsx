"use client";

import { QuickCaptureCard, type VisionVaultState } from "./vision-vault";

type Note = { id: number; title: string; body: string; kind: string; date: string; tags: string[] };
type Snapshot = { id: number; label: string; body: string; chapter: number; date: string; words: number };
type ImportBatch = { id: string; label: string; status: string; file_count: number; uploaded_count: number; failed_count: number; total_bytes: number; created_at: string };

export type HomeTarget = "Creator’s Home" | "Creator Compass" | "Projects" | "Bulk Import" | "Vision Vault" | "Knowledge Vault" | "Creative Graph" | "Book Architect" | "Writing Studio" | "Creative Timeline" | "Creation Journal" | "Version History" | "Reader" | "Audiobook Studio" | "AI Studio" | "Passport" | "Lounge" | "Shop" | "Radio" | "Settings";

type NextStep = { label: string; reason: string; target: HomeTarget };

// Deterministic, explainable "next meaningful step" — no fabricated insights.
// Priority: imports needing action → unprocessed ideas → active draft →
// unorganized sources → first capture.
export function nextMeaningfulStep({ notes, wordCount, organized, visionInbox, failedImports }: { notes: number; wordCount: number; organized: boolean; visionInbox: number; failedImports: number }): NextStep {
  if (failedImports > 0) return { label: "Finish your private import", reason: `${failedImports} import batch${failedImports === 1 ? "" : "es"} reported files that need another try.`, target: "Bulk Import" };
  if (visionInbox > 0) return { label: `Review ${visionInbox} captured idea${visionInbox === 1 ? "" : "s"}`, reason: "Ideas in your Vision Vault inbox are waiting to be developed or connected.", target: "Vision Vault" };
  if (wordCount > 0) return { label: "Continue writing", reason: `Your current chapter holds ${wordCount.toLocaleString()} words — momentum is the meaningful step.`, target: "Writing Studio" };
  if (notes > 0 && !organized) return { label: "Organize my notes", reason: `${notes} source piece${notes === 1 ? "" : "s"} in the Knowledge Vault haven't been organized into threads yet.`, target: "Knowledge Vault" };
  if (notes > 0) return { label: "Start writing", reason: "Your sources are organized; the next step is the first sentence.", target: "Writing Studio" };
  return { label: "Capture your first idea", reason: "Dreamboard is empty until you bring your own material — one idea or import starts the graph.", target: "Vision Vault" };
}

export function CreatorHome({ notes, draft, wordCount, organized, wisdomMode, creatorSeason, onGo, onOrganize, vault, snapshots, importBatches, projectTitle }: {
  notes: Note[]; draft: string; wordCount: number; organized: boolean; wisdomMode: boolean; creatorSeason: string;
  onGo: (view: HomeTarget) => void; onOrganize: () => void; vault: VisionVaultState; snapshots: Snapshot[]; importBatches: ImportBatch[]; projectTitle: string | null;
}) {
  const recentIdeas = vault.entries.filter(entry => entry.status !== "archived").slice(0, 3);
  const visionInbox = vault.entries.filter(entry => entry.status === "inbox").length;
  const failedImports = importBatches.filter(batch => batch.status === "partial" || batch.status === "failed").length;
  const step = nextMeaningfulStep({ notes: notes.length, wordCount, organized, visionInbox, failedImports });

  return <section className="home view">
    <div className="hero"><div className="hero-copy"><span className="eyebrow">THE HOME FOR YOUR WORK</span><h2>Write the vision.<br />Make it <em>plain.</em></h2><p>Dreamboard is empty until you bring your own material. Your story, your voice, and your work stay in the lead.</p><div><button className="gold" onClick={() => onGo("Writing Studio")}>{wordCount ? "Continue writing" : "Start writing"} <b>→</b></button><button className="text-button" onClick={() => onGo("Creator Compass")}>Open creator compass</button></div></div><div className="hero-art hero-manuscript"><div className="orbit" /><div className="manuscript-card"><span>{projectTitle ? projectTitle.toUpperCase().slice(0, 32) : "YOUR PROJECT"}</span><b>{wordCount ? "DRAFT IN PROGRESS" : "READY WHEN YOU ARE"}</b><i>{notes.length ? `${notes.length} private source pieces` : "Your material belongs here"}</i><p>{wordCount ? `${wordCount.toLocaleString()} words preserved in your current draft.` : "Begin with a note, an import, or the first sentence."}</p><footer><em /> Your voice leads</footer></div><div className="margin-note">YOUR<br />VOICE<br />LEADS</div></div></div>
    <section className="next-step-card"><div><span className="eyebrow">NEXT MEANINGFUL STEP</span><h3>{step.label}</h3><p>{step.reason}</p></div><button className="gold" onClick={() => onGo(step.target)}>{step.label} <b>→</b></button></section>
    <div className="metrics"><div><span>WRITING</span><b>{wordCount.toLocaleString()}</b><i><em style={{ width: `${Math.min(100, Math.max(4, wordCount / 20))}%` }} /></i><small>Words in your current draft</small></div><div><span>VISION VAULT</span><b>{vault.entries.filter(entry => entry.status !== "archived").length}</b><small>Ideas in motion, private to you</small></div><div><span>KNOWLEDGE VAULT</span><b>{notes.length}</b><small>Pieces of living source material</small></div><div><span>CREATOR SEASON</span><b>{creatorSeason.replace("-", " ")}</b><small>{wisdomMode ? "Wisdom reflections on" : "Your pace, your direction"}</small></div></div>
    <div className="home-grid">
      <QuickCaptureCard vault={vault} onOpen={() => onGo("Vision Vault")} />
      <section className="home-card vault-home"><div className="card-head"><div><span className="eyebrow">VISION VAULT · RECENT CAPTURES</span><h3>{recentIdeas.length ? "Ideas in motion." : "Your ideas belong here."}</h3></div><button onClick={() => onGo("Vision Vault")}>{recentIdeas.length ? "Open vault →" : "Capture →"}</button></div>{recentIdeas.length ? recentIdeas.map(entry => <button className="note-row" key={entry.id} onClick={() => onGo("Vision Vault")}><span>✧</span><div><b>{entry.title}</b><small>{entry.capture_type.replace("_", " ")} · {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{entry.local ? " · on this device" : ""}</small></div><em>{entry.status.replace(/_/g, " ")}</em></button>) : <p className="empty-state">No captures yet. Use quick capture — ideas stay private to you.</p>}</section>
      <section className="home-card vault-home"><div className="card-head"><div><span className="eyebrow">KNOWLEDGE VAULT</span><h3>{notes.length ? "Return to what matters." : "Your vault is ready."}</h3></div><button onClick={() => onGo("Knowledge Vault")}>{notes.length ? "Open vault →" : "Add material →"}</button></div>{notes.length ? notes.slice(0, 3).map(note => <button className="note-row" key={note.id} onClick={() => onGo("Knowledge Vault")}><span>✦</span><div><b>{note.title}</b><small>{note.kind} · {note.date}</small></div><em>{note.tags[0]}</em></button>) : <p className="empty-state">No example material is stored here. Import a file, save a journal entry, or begin with one real note.</p>}</section>
      <section className="home-card intelligence"><span className="spark">✦</span><span className="eyebrow">CREATIVE INTELLIGENCE</span><h3>{organized ? "Your threads are ready." : "There’s meaning in the material."}</h3><p>{organized ? "Themes are organized as reviewable suggestions. Nothing was changed without you." : notes.length ? `You have ${notes.length} pieces of source material ready to organize.` : "When you bring in your first material, Dreamboard can help you map it without replacing your point of view."}</p><button className="gold pale" onClick={onOrganize} disabled={!notes.length}>{organized ? "Review the threads" : "Organize my notes"} <b>→</b></button></section>
    </div>
    {(snapshots.length > 0 || failedImports > 0) && <div className="home-grid">
      {snapshots.length > 0 && <section className="home-card vault-home"><div className="card-head"><div><span className="eyebrow">VERSION HISTORY · RECENT</span><h3>Every brave edit has a way back.</h3></div><button onClick={() => onGo("Version History")}>Open history →</button></div>{snapshots.slice(0, 2).map(snapshot => <button className="note-row" key={snapshot.id} onClick={() => onGo("Version History")}><span>◫</span><div><b>{snapshot.label}</b><small>{snapshot.date} · {snapshot.words.toLocaleString()} words</small></div></button>)}</section>}
      {failedImports > 0 && <section className="home-card vault-home"><div className="card-head"><div><span className="eyebrow">PRIVATE IMPORTS</span><h3>An import needs attention.</h3></div><button onClick={() => onGo("Bulk Import")}>Open imports →</button></div><p className="empty-state">{failedImports} batch{failedImports === 1 ? "" : "es"} finished with files that need another try. Your batch records are saved.</p></section>}
    </div>}
    <section className="writing-peek"><div><span className="eyebrow">WRITING STUDIO · CURRENT DRAFT</span><h3>{wordCount ? "Your work in progress" : "A blank page, kept for you."}</h3><p>{draft ? `${draft.slice(0, 220)}${draft.length > 220 ? "…" : ""}` : "No sample chapter is waiting here. Start with the sentence that is true for your project."}</p><footer><span>{wordCount.toLocaleString()} words in this chapter</span><button onClick={() => onGo("Writing Studio")}>Open the studio →</button></footer></div></section>
  </section>;
}
