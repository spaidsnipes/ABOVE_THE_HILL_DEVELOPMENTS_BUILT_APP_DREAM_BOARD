"use client";

import { useMemo, useState } from "react";

const nav = [
  ["⌂", "Creator's Home"], ["▦", "Projects"], ["⇧", "Import"],
  ["⌕", "Knowledge Vault"], ["✦", "Book Architect"], ["✎", "Writing Studio"],
  ["◷", "Timeline"], ["◫", "Creation Journal"],
];

const vault = [
  { title: "The night everything changed", type: "Story", tag: "Testimony", date: "May 14, 2022" },
  { title: "What surrender taught me", type: "Reflection", tag: "Theme: Surrender", date: "Jun 03, 2022" },
  { title: "Scriptures on spiritual awakening", type: "Research", tag: "Reference", date: "Aug 22, 2023" },
  { title: "Letter to my younger self", type: "Journal", tag: "Personal", date: "Jan 09, 2024" },
];

const chapters = ["1  The Quiet Before", "2  When the Old Life Ended", "3  Learning to Listen", "4  Surrender Is a Door", "5  The Work of Becoming"];

export default function Home() {
  const [active, setActive] = useState("Creator's Home");
  const [query, setQuery] = useState("");
  const [organized, setOrganized] = useState(false);
  const [chapter, setChapter] = useState(3);
  const [saved, setSaved] = useState(true);
  const notes = useMemo(() => vault.filter(n => n.title.toLowerCase().includes(query.toLowerCase()) || n.tag.toLowerCase().includes(query.toLowerCase())), [query]);
  const selectNav = (item: string) => setActive(item);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">W</div><div><strong>WEALTHY</strong><span>MINDSETS</span></div></div>
        <div className="workspace-label">CREATIVE OS <b>PHASE 01</b></div>
        <nav>{nav.map(([icon, label]) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => selectNav(label)}><i>{icon}</i>{label}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="future-label">ECOSYSTEM</div>
          {["Reader", "Comic Studio", "Art Studio", "Audio Studio", "Marketplace"].map(x => <button className="nav-item muted" key={x} onClick={() => setActive(x)}><i>○</i>{x}<small>SOON</small></button>)}
          <button className="nav-item"><i>⚙</i>Settings</button>
          <div className="profile"><div className="avatar">AH</div><div><b>Above the Hill</b><span>Founder</span></div><em>⌄</em></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="crumb">CREATIONS <span>/</span> SPIRITUAL AWAKENING</div><div className="top-actions"><button className="icon-button">⌕</button><button className="icon-button">♧</button><button className="help">?</button></div></header>
        <div className="page-wrap">
          <section className="welcome-row"><div><p className="eyebrow">SUNDAY, JULY 19</p><h1>Make room for the work<br />only <em>you</em> can make.</h1><p className="subcopy">Your ideas have a home. Let’s turn what you’ve carried into what you’re called to share.</p></div><button className="new-button" onClick={() => setActive("Projects")}>+ New creation</button></section>

          <section className="project-card">
            <div className="cover"><span>SPIRITUAL</span><strong>AWAKENING</strong><i>Above the Hill</i></div>
            <div className="project-info"><div className="project-meta"><span className="pill">BOOK PROJECT</span><span>Last opened just now</span></div><h2>Spiritual Awakening</h2><p>A journey through surrender, transformation, and the quiet work of becoming.</p><div className="progress-row"><div><span>MANUSCRIPT PROGRESS</span><b>34%</b></div><div className="progress"><i /></div><small>18,420 / 54,000 words</small></div><div className="project-actions"><button className="primary" onClick={() => selectNav("Writing Studio")}>Continue writing <span>→</span></button><button className="secondary" onClick={() => selectNav("Book Architect")}>View outline</button></div></div>
            <div className="project-stats"><div><b>12</b><span>chapters</span></div><div><b>84</b><span>source notes</span></div><div><b>6</b><span>themes found</span></div><button onClick={() => setActive("Projects")}>Open project ↗</button></div>
          </section>

          <section className="grid two-up">
            <div className="panel vault-panel"><div className="panel-head"><div><p className="eyebrow">KNOWLEDGE VAULT</p><h3>Material worth returning to</h3></div><button onClick={() => selectNav("Knowledge Vault")}>Open vault →</button></div><label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your notes, stories, and sources" /></label><div className="note-list">{notes.map(n => <article key={n.title}><div className="note-icon">{n.type === "Research" ? "⌘" : "✦"}</div><div><h4>{n.title}</h4><p>{n.type} · {n.date}</p></div><span>{n.tag}</span></article>)}{notes.length === 0 && <p className="empty">Nothing matched that search yet.</p>}</div></div>
            <div className="panel organize"><div className="spark">✦</div><p className="eyebrow">CREATIVE INTELLIGENCE</p><h3>{organized ? "Your material has a shape." : "There’s meaning in the mess."}</h3><p>{organized ? "We found 6 recurring themes, 14 stories, and 9 unfinished ideas ready for your attention." : "You have 84 pieces of source material. Let’s discover the threads that connect them."}</p>{organized ? <div className="themes"><span>Surrender</span><span>Identity</span><span>Faith</span></div> : <button className="primary light" onClick={() => setOrganized(true)}>Organize my notes <span>→</span></button>}<small>{organized ? "Review suggestions in Book Architect" : "AI will suggest themes. You decide what belongs."}</small></div>
          </section>

          <section className="grid studio-grid">
            <div className="panel writing"><div className="panel-head"><div><p className="eyebrow">WRITING STUDIO</p><h3>Pick up where you left off</h3></div><span className={saved ? "saved" : "saving"}>{saved ? "● Saved" : "● Saving…"}</span></div><div className="manuscript"><div className="chapter-num">CHAPTER {chapter}</div><h2>{chapters[chapter - 1].slice(3)}</h2><p>There was a particular kind of silence that followed the surrender. Not empty — not at all. It was full of everything I had been too busy to hear.</p><p className="faded">For the first time, I understood that awakening wasn’t about becoming someone new. It was about remembering who I had always been beneath the noise.</p></div><div className="writing-foot"><span>1,284 words in this chapter</span><button onClick={() => { setSaved(false); setTimeout(() => setSaved(true), 700); }}>Open in Writing Studio →</button></div></div>
            <div className="panel journal"><p className="eyebrow">CREATION JOURNAL</p><h3>Leave a note for<br />your future self.</h3><div className="journal-paper"><span>JULY 19, 2026</span><p>Today, I want to remember...</p><button onClick={() => alert("Journal entry ready for your thoughts.")}>Begin entry <b>→</b></button></div></div>
          </section>

          <section className="lower-grid"><div className="panel timeline"><div className="panel-head"><div><p className="eyebrow">YOUR STORY’S TIMELINE</p><h3>Moments that shaped the manuscript</h3></div><button>View timeline →</button></div><div className="timeline-row"><div><span>2022</span><i /></div><article><b>May 14</b><p>The night everything changed</p></article><article><b>Aug 22</b><p>First notes on surrender</p></article><article><b>Dec 04</b><p>“The old life ended”</p></article></div></div><div className="panel publishing"><p className="eyebrow">WHEN YOU’RE READY</p><h3>Bring your book<br />into the world.</h3><p>Prepare a manuscript for your audience, the Lounge, and the Wealthy Mindsets Shop.</p><button className="secondary">Explore publishing <span>→</span></button></div></section>
        </div>
      </section>
    </main>
  );
}
