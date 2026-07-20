"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";

type Note = { id: number; title: string; body: string; kind: string; date: string; tags: string[] };
type LoungePost = { id: number; author: string; body: string; topic: string; time: string; likes: number };
type ActiveView = "Creator’s Home" | "Projects" | "Bulk Import" | "Knowledge Vault" | "Book Architect" | "Writing Studio" | "Creative Timeline" | "Creation Journal" | "AI Studio" | "Lounge" | "Shop" | "Radio";

const initialNotes: Note[] = [
  { id: 1, title: "The night everything changed", body: "A testimony about the moment silence became an invitation instead of an absence.", kind: "Testimony", date: "May 14, 2022", tags: ["Surrender", "Awakening"] },
  { id: 2, title: "What surrender taught me", body: "Surrender was not losing myself. It was meeting the truest part of myself beneath the noise.", kind: "Reflection", date: "Jun 03, 2022", tags: ["Surrender", "Identity"] },
  { id: 3, title: "Scriptures on spiritual awakening", body: "Research and references for the chapter on listening, renewal, and the hidden life.", kind: "Research", date: "Aug 22, 2023", tags: ["Faith", "Reference"] },
  { id: 4, title: "Letter to my younger self", body: "You did not miss your moment. You were becoming ready to receive it.", kind: "Journal", date: "Jan 09, 2024", tags: ["Healing", "Identity"] },
];
const initialPosts: LoungePost[] = [
  { id: 1, author: "Dreamboard", body: "The Spiritual Awakening manuscript is open for its next chapter.", topic: "Creator update", time: "Today", likes: 18 },
  { id: 2, author: "The Circle", body: "What is one idea you are finally ready to give a real home?", topic: "Creative conversation", time: "Yesterday", likes: 43 },
];
const chapters = ["The Quiet Before", "When the Old Life Ended", "Learning to Listen", "Surrender Is a Door", "The Work of Becoming"];
const starterDraft = "There was a particular kind of silence that followed the surrender. Not empty — not at all. It was full of everything I had been too busy to hear.\n\nFor the first time, I understood that awakening wasn’t about becoming someone new. It was about remembering who I had always been beneath the noise.";
const nav: Array<[string, ActiveView]> = [["⌂", "Creator’s Home"], ["▦", "Projects"], ["⇧", "Bulk Import"], ["⌕", "Knowledge Vault"], ["✦", "Book Architect"], ["✎", "Writing Studio"], ["◷", "Creative Timeline"], ["◫", "Creation Journal"], ["✦", "AI Studio"], ["◉", "Lounge"], ["▣", "Shop"], ["◌", "Radio"]];
const shopItems = [
  { id: "book", name: "Spiritual Awakening", kind: "Book in progress", price: 24, note: "Connect publishing when the manuscript is ready." },
  { id: "journal", name: "The Dreamboard Journal", kind: "Creator tool", price: 18, note: "A guided companion for the work in progress." },
  { id: "print", name: "Above the Hill Print", kind: "Limited art", price: 42, note: "Artwork release preparation." },
];

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const saved = window.localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; } catch { return fallback; }
}

export default function Dreamboard() {
  const [active, setActive] = useState<ActiveView>("Creator’s Home");
  const [notes, setNotes] = useState(initialNotes);
  const [query, setQuery] = useState("");
  const [importText, setImportText] = useState("");
  const [draft, setDraft] = useState(starterDraft);
  const [chapter, setChapter] = useState(2);
  const [journal, setJournal] = useState("");
  const [organized, setOrganized] = useState(false);
  const [notice, setNotice] = useState("Dreamboard is ready for your next real piece of work.");
  const [hydrated, setHydrated] = useState(false);
  const [loungeText, setLoungeText] = useState("");
  const [posts, setPosts] = useState(initialPosts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [radioStream, setRadioStream] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Help me find the strongest throughline in this chapter without rewriting my voice.");
  const [aiResult, setAiResult] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "working" | "ready" | "needs-connection">("idle");
  const fileInput = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setNotes(readLocal("dreamboard-notes", initialNotes));
    setDraft(readLocal("dreamboard-draft", starterDraft));
    setPosts(readLocal("dreamboard-lounge", initialPosts));
    setCart(readLocal("dreamboard-cart", {}));
    setRadioStream(readLocal("dreamboard-radio-stream", ""));
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-notes", JSON.stringify(notes)); }, [notes, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-draft", JSON.stringify(draft)); }, [draft, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-lounge", JSON.stringify(posts)); }, [posts, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-cart", JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-radio-stream", JSON.stringify(radioStream)); }, [radioStream, hydrated]);

  const filtered = useMemo(() => notes.filter(note => `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [notes, query]);
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = shopItems.reduce((total, item) => total + item.price * (cart[item.id] || 0), 0);
  const addNote = (body: string, kind = "Imported") => {
    const clean = body.trim(); if (!clean) return;
    const title = clean.split(/\n|\.|!/)[0].slice(0, 58) || "Untitled source";
    setNotes(prev => [{ id: Date.now(), title, body: clean, kind, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), tags: ["Unsorted"] }, ...prev]);
  };
  const importNotes = () => { addNote(importText); setImportText(""); setNotice("Source material was added to your Knowledge Vault."); setActive("Knowledge Vault"); };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { addNote(String(reader.result || ""), "Imported file"); setNotice(`${file.name} is now in your Knowledge Vault.`); setActive("Knowledge Vault"); }; reader.readAsText(file); };
  const exportDraft = () => { const blob = new Blob([`# Spiritual Awakening\n\n## Chapter ${chapter + 1}: ${chapters[chapter]}\n\n${draft}`], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "spiritual-awakening-chapter.md"; link.click(); URL.revokeObjectURL(url); setNotice("A Markdown copy of your chapter was downloaded."); };
  const saveJournal = () => { if (!journal.trim()) return; addNote(journal, "Journal"); setJournal(""); setNotice("Your journal entry was added to the vault as source material."); };
  const organize = () => { setOrganized(true); setNotes(prev => prev.map(note => note.tags.includes("Unsorted") ? { ...note, tags: ["Emerging thread"] } : note)); setNotice("Themes are ready to review. You remain in control of every assignment."); };
  const postToLounge = () => { const body = loungeText.trim(); if (!body) return; setPosts(prev => [{ id: Date.now(), author: "Above the Hill", body, topic: "From Dreamboard", time: "Just now", likes: 0 }, ...prev]); setLoungeText(""); setNotice("Your update is now in the Lounge on this device. Community accounts are the next connection."); };
  const addToCart = (itemId: string) => { setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 })); setNotice("Added to the Shop cart. Payments will be connected only when you choose your checkout provider."); };
  const toggleRadio = async () => {
    if (!radioStream.trim()) { setNotice("Paste a licensed stream URL first. Dreamboard will never invent a radio signal."); return; }
    if (!audio.current) return;
    if (isPlaying) { audio.current.pause(); setIsPlaying(false); return; }
    try { await audio.current.play(); setIsPlaying(true); setNotice("WM Radio is playing your connected stream."); } catch { setNotice("That stream could not play in this browser. Check the URL and stream permissions."); }
  };
  const askAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiStatus("working"); setAiResult("");
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt, context: `Project: Spiritual Awakening. Active chapter: ${chapters[chapter]}. Draft excerpt: ${draft.slice(0, 2200)}` }) });
      const data = await response.json() as { text?: string; error?: string; configured?: boolean };
      if (!response.ok) { setAiStatus("needs-connection"); setAiResult(data.error || "The AI connector still needs to be linked."); return; }
      setAiResult(data.text || "The connected model returned no text."); setAiStatus("ready");
    } catch { setAiStatus("needs-connection"); setAiResult("Dreamboard could not reach the AI connector. Check its hosted settings and try again."); }
  };

  return <main className="os-shell">
    <aside className="rail">
      <button className="wordmark dreamboard-mark" onClick={() => setActive("Creator’s Home")} aria-label="Dreamboard home"><span>DB</span><div><b>DREAMBOARD</b><small>BY WEALTHY MINDSETS</small></div></button>
      <div className="rail-title">CREATIVE OS <em>FOUNDATION</em></div>
      <nav>{nav.map(([icon, label]) => <button key={label} className={active === label ? "rail-link selected" : "rail-link"} onClick={() => setActive(label)}><i>{icon}</i><span>{label}</span></button>)}</nav>
      <div className="ecosystem"><p>WM ECOSYSTEM · BUILDING</p><button onClick={() => setActive("Lounge")}><span>◉</span> Lounge <b>OPEN</b></button><button onClick={() => setActive("Shop")}><span>◉</span> Shop <b>OPEN</b></button><button onClick={() => setActive("Radio")}><span>◉</span> Radio <b>OPEN</b></button></div>
      <div className="founder"><span>AH</span><div><b>Above the Hill</b><small>Founder workspace</small></div></div>
    </aside>
    <section className="stage">
      <header><div><span className="eyebrow">DREAMBOARD · CREATIVE OPERATING SYSTEM</span><h1>{active}</h1></div><div className="header-actions"><span className="presence"><i /> {hydrated ? "Saved on this device" : "Opening workspace"}</span><button className="ghost" onClick={() => setActive("Bulk Import")}>Import material</button><button className="gold" onClick={() => setActive("Writing Studio")}>Continue creating <b>→</b></button></div></header>
      <div className="notice" role="status"><span>✦</span>{notice}</div>
      {active === "Creator’s Home" && <Home notes={notes} draft={draft} wordCount={wordCount} organized={organized} onGo={setActive} onOrganize={organize} />}
      {active === "Bulk Import" && <section className="view import-view"><div className="view-heading"><span className="eyebrow">PRESERVE THE ORIGINAL</span><h2>Bring in the pieces you’ve been carrying.</h2><p>Paste a note or import a plain-text or Markdown file. It enters your Knowledge Vault untouched, ready for your review.</p></div><div className="import-grid"><div className="input-card"><label>PASTE SOURCE MATERIAL<textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="A prayer, voice-note transcript, scene, research excerpt, or unfinished thought..." /></label><button className="gold wide" onClick={importNotes} disabled={!importText.trim()}>Add to Knowledge Vault <b>→</b></button></div><div className="drop-card"><span>⇧</span><h3>Import a file</h3><p>Plain text and Markdown are ready in this first release. Original text is retained alongside the organized view.</p><input ref={fileInput} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleFile} hidden /><button className="ghost" onClick={() => fileInput.current?.click()}>Choose a file</button></div></div></section>}
      {active === "Knowledge Vault" && <section className="view"><div className="view-heading split"><div><span className="eyebrow">YOUR SOURCE LIBRARY</span><h2>Knowledge Vault</h2><p>{notes.length} pieces of material, all still yours.</p></div><button className="gold" onClick={organize}>✦ Organize my notes</button></div><label className="searchbox">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your stories, research, reflections, and journal entries" /></label><div className="vault-list">{filtered.map(note => <article key={note.id}><div className="vault-icon">{note.kind === "Research" ? "⌘" : "✦"}</div><div><span>{note.kind} · {note.date}</span><h3>{note.title}</h3><p>{note.body}</p></div><div className="tag-stack">{note.tags.map(tag => <b key={tag}>{tag}</b>)}</div></article>)}{!filtered.length && <p className="empty-state">Nothing matched that search. Your original material remains safe in the vault.</p>}</div></section>}
      {active === "Book Architect" && <section className="view architect"><div className="view-heading"><span className="eyebrow">MANUSCRIPT ARCHITECTURE</span><h2>Shape the path before you write it.</h2><p>Use these chapters as a working structure. The source material stays available beside the outline.</p></div><div className="outline"><div>{chapters.map((item, index) => <button key={item} className={chapter === index ? "chapter active-chapter" : "chapter"} onClick={() => setChapter(index)}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span><i>{index === chapter ? "Editing" : "Outline"}</i></button>)}</div><aside><span className="eyebrow">CHAPTER {chapter + 1}</span><h3>{chapters[chapter]}</h3><p>Source suggestions are drawn from your vault. They are suggestions only; you decide what becomes part of the manuscript.</p><div className="source-chips">{notes.slice(0, 3).map(n => <button key={n.id} onClick={() => setActive("Knowledge Vault")}>{n.title}</button>)}</div><button className="gold wide" onClick={() => setActive("Writing Studio")}>Write this chapter <b>→</b></button></aside></div></section>}
      {active === "Writing Studio" && <section className="view writing-view"><div className="writing-toolbar"><div><span className="eyebrow">SPIRITUAL AWAKENING / CHAPTER {chapter + 1}</span><h2>{chapters[chapter]}</h2></div><div><span className="draft-status">● Saved on this device</span><button className="ghost" onClick={exportDraft}>Export Markdown</button></div></div><textarea className="writer" value={draft} onChange={e => setDraft(e.target.value)} aria-label="Manuscript editor" /><footer className="writer-footer"><span>{wordCount.toLocaleString()} words in this chapter</span><button className="text-button" onClick={() => setActive("AI Studio")}>Ask Dreamboard AI →</button></footer></section>}
      {active === "Creation Journal" && <section className="view journal-view"><div className="view-heading"><span className="eyebrow">CREATION JOURNAL</span><h2>Leave a note for your future self.</h2><p>The journal becomes private source material for your work, not a public performance.</p></div><div className="journal-card"><span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</span><textarea value={journal} onChange={e => setJournal(e.target.value)} placeholder="Today, I want to remember..." /><button className="gold" onClick={saveJournal} disabled={!journal.trim()}>Keep this note <b>→</b></button></div></section>}
      {active === "Projects" && <section className="view"><div className="view-heading"><span className="eyebrow">ACTIVE CREATION</span><h2>Spiritual Awakening</h2><p>Your first proof that Dreamboard works: a real book made from the material only you could have gathered.</p></div><div className="project-focus"><div className="book-cover"><small>SPIRITUAL</small><strong>AWAKENING</strong><em>Above the Hill</em></div><div><span className="eyebrow">BOOK PROJECT · ACTIVE</span><h3>34% manuscript progress</h3><div className="meter"><i /></div><p>{wordCount.toLocaleString()} chapter words · {notes.length} source pieces · {organized ? "themes reviewed" : "themes ready to discover"}</p><button className="gold" onClick={() => setActive("Writing Studio")}>Open Writing Studio <b>→</b></button></div></div></section>}
      {active === "Creative Timeline" && <Timeline notes={notes} />}
      {active === "AI Studio" && <AIStudio prompt={aiPrompt} setPrompt={setAiPrompt} status={aiStatus} result={aiResult} onAsk={askAI} />}
      {active === "Lounge" && <Lounge posts={posts} text={loungeText} setText={setLoungeText} onPost={postToLounge} />}
      {active === "Shop" && <Shop cart={cart} total={cartTotal} count={cartCount} onAdd={addToCart} />}
      {active === "Radio" && <Radio stream={radioStream} setStream={setRadioStream} playing={isPlaying} onToggle={toggleRadio} audioRef={audio} />}
    </section>
  </main>;
}

function Home({ notes, draft, wordCount, organized, onGo, onOrganize }: { notes: Note[]; draft: string; wordCount: number; organized: boolean; onGo: (view: ActiveView) => void; onOrganize: () => void }) { return <section className="home view"><div className="hero"><div className="hero-copy"><span className="eyebrow">THE HOME FOR YOUR WORK</span><h2>Make room for the work<br />only <em>you</em> can make.</h2><p>Turn what you’ve carried into what you’re called to share—without losing the truth of where it began.</p><div><button className="gold" onClick={() => onGo("Writing Studio")}>Continue writing <b>→</b></button><button className="text-button" onClick={() => onGo("Book Architect")}>View manuscript map</button></div></div><div className="hero-art"><div className="orbit" /><div className="record"><i /></div><span>SPIRITUAL<br />AWAKENING</span></div></div><div className="metrics"><div><span>MANUSCRIPT</span><b>34%</b><i><em /></i><small>{wordCount.toLocaleString()} current draft words</small></div><div><span>KNOWLEDGE VAULT</span><b>{notes.length}</b><small>Pieces of living source material</small></div><div><span>CREATOR VOICE</span><b>Yours</b><small>Review-first AI assistance</small></div></div><div className="home-grid"><section className="home-card vault-home"><div className="card-head"><div><span className="eyebrow">KNOWLEDGE VAULT</span><h3>Return to what matters.</h3></div><button onClick={() => onGo("Knowledge Vault")}>Open vault →</button></div>{notes.slice(0, 3).map(note => <button className="note-row" key={note.id} onClick={() => onGo("Knowledge Vault")}><span>✦</span><div><b>{note.title}</b><small>{note.kind} · {note.date}</small></div><em>{note.tags[0]}</em></button>)}</section><section className="home-card intelligence"><span className="spark">✦</span><span className="eyebrow">CREATIVE INTELLIGENCE</span><h3>{organized ? "Your threads are ready." : "There’s meaning in the mess."}</h3><p>{organized ? "Themes are organized as reviewable suggestions. Nothing was changed without you." : `You have ${notes.length} pieces of source material ready to become a coherent manuscript.`}</p><button className="gold pale" onClick={onOrganize}>{organized ? "Review the threads" : "Organize my notes"} <b>→</b></button></section></div><section className="writing-peek"><div><span className="eyebrow">WRITING STUDIO · ACTIVE DRAFT</span><h3>Learning to Listen</h3><p>{draft.slice(0, 220)}…</p><footer><span>{wordCount.toLocaleString()} words in this chapter</span><button onClick={() => onGo("Writing Studio")}>Open the studio →</button></footer></div></section></section>; }

function Timeline({ notes }: { notes: Note[] }) { return <section className="view"><div className="view-heading"><span className="eyebrow">CREATIVE TIMELINE</span><h2>Moments that shaped the manuscript.</h2><p>Your source material, in the order it entered your story.</p></div><div className="timeline">{notes.map((note, index) => <article key={note.id}><i>{String(index + 1).padStart(2, "0")}</i><div><span>{note.date}</span><h3>{note.title}</h3><p>{note.body}</p></div></article>)}</div></section>; }

function AIStudio({ prompt, setPrompt, status, result, onAsk }: { prompt: string; setPrompt: (value: string) => void; status: string; result: string; onAsk: () => void }) { return <section className="view ai-studio"><div className="view-heading"><span className="eyebrow">OPEN-MODEL AI FOUNDATION</span><h2>Creative intelligence, under your direction.</h2><p>Dreamboard’s AI connection is real infrastructure: it only runs when you connect your chosen hosted, open-model provider in the app’s environment settings. It never silently changes your manuscript.</p></div><div className="ai-grid"><section className="ai-card"><div className="card-head"><div><span className="eyebrow">ASK FOR A REVIEW</span><h3>Keep your voice in charge.</h3></div><span className={status === "ready" ? "ai-pill connected" : "ai-pill"}>{status === "ready" ? "MODEL CONNECTED" : "CONNECTOR READY"}</span></div><textarea value={prompt} onChange={event => setPrompt(event.target.value)} aria-label="AI request" /><button className="gold" onClick={onAsk} disabled={status === "working"}>{status === "working" ? "Thinking…" : "Ask for a suggestion"} <b>→</b></button><p className="assist-note">Suggestions appear below for review. Nothing is applied to your draft automatically.</p></section><section className="ai-card ai-result"><span className="eyebrow">REVIEW PANEL</span><h3>{status === "needs-connection" ? "One connection left" : status === "ready" ? "A suggestion to review" : "Your next collaborator"}</h3><p>{result || "Connect your open-model provider once, then use this space for outlining, source discovery, chapter questions, and gentle editorial feedback."}</p>{status === "needs-connection" && <div className="connection-note"><b>What is already built:</b><span>The secure server connector, a review-first workflow, and a provider-neutral format. Add AI_BASE_URL, AI_API_KEY, and AI_MODEL to Vercel when you choose your provider.</span></div>}</section></div><section className="roadmap-strip"><span className="eyebrow">BUILT NEXT, WITHOUT BLOCKING YOUR BOOK</span><div><b>Creator profiles</b><b>Cloud vault</b><b>Reader</b><b>Audiobook studio</b><b>Comic studio</b></div></section></section>; }

function Lounge({ posts, text, setText, onPost }: { posts: LoungePost[]; text: string; setText: (value: string) => void; onPost: () => void }) { return <section className="view ecosystem-view"><div className="view-heading"><span className="eyebrow">WEALTHY MINDSETS LOUNGE</span><h2>Let the work find its people.</h2><p>The Lounge begins inside Dreamboard: share a creator update, keep the work connected to its community, and make every public moment intentional.</p></div><div className="lounge-layout"><section className="lounge-composer"><div className="card-head"><div><span className="eyebrow">FROM YOUR CREATIVE DESK</span><h3>Post to the Lounge</h3></div><span className="live-dot">LOCAL FIRST</span></div><textarea value={text} onChange={event => setText(event.target.value)} placeholder="Share a thought, a milestone, or an invitation…" /><div><button className="ghost">Add source</button><button className="gold" onClick={onPost} disabled={!text.trim()}>Share update <b>→</b></button></div><p>Posts are saved in this Dreamboard session now. WM ID community publishing is the next secure connection.</p></section><section className="lounge-feed">{posts.map(post => <article key={post.id}><div className="post-avatar">WM</div><div><header><span><b>{post.author}</b><small>{post.topic} · {post.time}</small></span><button aria-label="More post options">•••</button></header><p>{post.body}</p><footer><button>♡ {post.likes}</button><button>⌁ Reply</button><button>↗ Share</button></footer></div></article>)}</section></div></section>; }

function Shop({ cart, total, count, onAdd }: { cart: Record<string, number>; total: number; count: number; onAdd: (itemId: string) => void }) { return <section className="view ecosystem-view"><div className="view-heading split"><div><span className="eyebrow">WEALTHY MINDSETS SHOP</span><h2>Build the shelf around your work.</h2><p>Products live beside their source project so books, art, journals, and future releases can move into the Shop intentionally.</p></div><div className="cart-summary"><span>YOUR CART</span><b>{count} item{count === 1 ? "" : "s"}</b><small>${total.toFixed(2)}</small></div></div><div className="shop-grid">{shopItems.map((item, index) => <article className={`shop-item tone-${index + 1}`} key={item.id}><div className="shop-art"><span>{index === 0 ? "SPIRITUAL\nAWAKENING" : index === 1 ? "DREAM\nBOARD" : "ABOVE\nTHE HILL"}</span></div><div><span>{item.kind}</span><h3>{item.name}</h3><p>{item.note}</p><footer><b>${item.price.toFixed(2)}</b><button className="cart-button" onClick={() => onAdd(item.id)}>Add to cart +</button></footer></div></article>)}</div><div className="shop-connection"><span>PAYMENTS ARE NOT PRETENDING TO BE LIVE</span><p>Your catalog and cart are working. The secure checkout connection comes next, after you decide which payment provider and account Dreamboard should use.</p></div></section>; }

function Radio({ stream, setStream, playing, onToggle, audioRef }: { stream: string; setStream: (value: string) => void; playing: boolean; onToggle: () => void; audioRef: RefObject<HTMLAudioElement | null> }) { return <section className="view ecosystem-view radio-view"><div className="view-heading"><span className="eyebrow">WEALTHY MINDSETS RADIO</span><h2>A home for the sound behind the work.</h2><p>Connect a licensed live stream and use Dreamboard as the first real WM Radio control room.</p></div><div className="radio-console"><div className="radio-record"><i /></div><div className="radio-main"><div className="live-label">{playing ? "● LIVE NOW" : "○ STATION READY"}</div><h3>WM Radio</h3><p>{stream ? "Your connected station is ready to play." : "No stream connected yet — add your station URL below."}</p><div className="wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><button className="radio-play" onClick={onToggle} aria-label={playing ? "Pause WM Radio" : "Play WM Radio"}>{playing ? "Ⅱ" : "▶"}</button><audio ref={audioRef} src={stream || undefined} /></div><div className="radio-connect"><span className="eyebrow">STATION CONNECTION</span><label>LICENSED STREAM URL<input value={stream} onChange={event => setStream(event.target.value)} placeholder="https://your-radio-stream…" /></label><p>This is a real audio player. Use only a stream you own or are licensed to broadcast.</p><button className="ghost" onClick={() => setStream("")}>Clear station</button></div></div></section>; }
