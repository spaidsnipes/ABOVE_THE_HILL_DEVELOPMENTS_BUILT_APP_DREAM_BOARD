"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type Note = { id: number; title: string; body: string; kind: string; date: string; tags: string[] };
type LoungePost = { id: string | number; author: string; body: string; topic: string; time: string; likes: number };
type Snapshot = { id: number; label: string; body: string; chapter: number; date: string; words: number };
type ActiveView = "Creator’s Home" | "Projects" | "Bulk Import" | "Knowledge Vault" | "Book Architect" | "Writing Studio" | "Creative Timeline" | "Creation Journal" | "Version History" | "Reader" | "Audiobook Studio" | "AI Studio" | "WM ID" | "Lounge" | "Shop" | "Radio";

const initialNotes: Note[] = [
  { id: 1, title: "The night everything changed", body: "A testimony about the moment silence became an invitation instead of an absence.", kind: "Testimony", date: "May 14, 2022", tags: ["Surrender", "Awakening"] },
  { id: 2, title: "What surrender taught me", body: "Surrender was not losing myself. It was meeting the truest part of myself beneath the noise.", kind: "Reflection", date: "Jun 03, 2022", tags: ["Surrender", "Identity"] },
  { id: 3, title: "Scriptures on spiritual awakening", body: "Research and references for the chapter on listening, renewal, and the hidden life.", kind: "Research", date: "Aug 22, 2023", tags: ["Faith", "Reference"] },
  { id: 4, title: "Letter to my younger self", body: "You did not miss your moment. You were becoming ready to receive it.", kind: "Journal", date: "Jan 09, 2024", tags: ["Healing", "Identity"] },
];
const initialPosts: LoungePost[] = [];
const chapters = ["The Quiet Before", "When the Old Life Ended", "Learning to Listen", "Surrender Is a Door", "The Work of Becoming"];
const starterDraft = "There was a particular kind of silence that followed the surrender. Not empty — not at all. It was full of everything I had been too busy to hear.\n\nFor the first time, I understood that awakening wasn’t about becoming someone new. It was about remembering who I had always been beneath the noise.";
const nav: Array<[string, ActiveView]> = [["⌂", "Creator’s Home"], ["◇", "WM ID"], ["▦", "Projects"], ["⇧", "Bulk Import"], ["⌕", "Knowledge Vault"], ["✦", "Book Architect"], ["✎", "Writing Studio"], ["◫", "Version History"], ["▤", "Reader"], ["◉", "Audiobook Studio"], ["◷", "Creative Timeline"], ["◫", "Creation Journal"], ["✦", "AI Studio"], ["◉", "Lounge"], ["▣", "Shop"], ["◌", "Radio"]];
const shopItems = [
  { id: "book", name: "Spiritual Awakening", kind: "Book in progress", price: 24, note: "Connect publishing when the manuscript is ready." },
  { id: "journal", name: "The Dreamboard Journal", kind: "Creator tool", price: 18, note: "A guided companion for the work in progress." },
  { id: "print", name: "Above the Hill Print", kind: "Limited art", price: 42, note: "Artwork release preparation." },
];

type CommunityStatus = "local" | "connecting" | "ready" | "needs-setup";
type CommunityPostRow = { id: string; body: string; topic: string; created_at: string; profiles: Array<{ display_name: string | null; wm_handle: string | null }> | { display_name: string | null; wm_handle: string | null } | null };

function toLoungePost(row: CommunityPostRow): LoungePost {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const author = profile?.display_name || (profile?.wm_handle ? `@${profile.wm_handle}` : "WM member");
  return { id: row.id, author, body: row.body, topic: row.topic, time: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(row.created_at)), likes: 0 };
}

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
  const [shopProducts, setShopProducts] = useState(shopItems);
  const [radioStream, setRadioStream] = useState("");
  const [communityStatus, setCommunityStatus] = useState<CommunityStatus>(() => getSupabaseBrowserClient() ? "connecting" : "local");
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Help me find the strongest throughline in this chapter without rewriting my voice.");
  const [aiResult, setAiResult] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "working" | "ready" | "needs-connection">("idle");
  const [wmUser, setWmUser] = useState<User | null>(null);
  const [wmEmail, setWmEmail] = useState("");
  const [wmHandle, setWmHandle] = useState("");
  const [wmStatus, setWmStatus] = useState<"ready" | "sending" | "sent" | "saving" | "saved" | "needs-connection" | "error">(() => getSupabaseBrowserClient() ? "ready" : "needs-connection");
  const [wmMessage, setWmMessage] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [readerMode, setReaderMode] = useState<"comfortable" | "night" | "paper">("comfortable");
  const [readerScale, setReaderScale] = useState(18);
  const [narrationUrl, setNarrationUrl] = useState("");
  const [narrationName, setNarrationName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const narrationInput = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotes(readLocal("dreamboard-notes", initialNotes));
      setDraft(readLocal("dreamboard-draft", starterDraft));
      setPosts(readLocal("dreamboard-lounge", initialPosts));
      setCart(readLocal("dreamboard-cart", {}));
      setRadioStream(readLocal("dreamboard-radio-stream", ""));
      setSnapshots(readLocal<Snapshot[]>("dreamboard-snapshots", []));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-notes", JSON.stringify(notes)); }, [notes, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-draft", JSON.stringify(draft)); }, [draft, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-lounge", JSON.stringify(posts)); }, [posts, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-cart", JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-radio-stream", JSON.stringify(radioStream)); }, [radioStream, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-snapshots", JSON.stringify(snapshots)); }, [snapshots, hydrated]);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const loadIdentity = async (user: User | null) => {
      setWmUser(user);
      if (!user) return;
      const { data } = await supabase.from("profiles").select("wm_handle, display_name").eq("id", user.id).maybeSingle();
      if (data?.wm_handle) setWmHandle(data.wm_handle);
      setWmStatus("ready");
    };
    void supabase.auth.getUser().then(({ data }) => loadIdentity(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void loadIdentity(session?.user ?? null); });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const loadCommunity = async () => {
      setCommunityStatus("connecting");
      const [loungeResult, stationResult, productResult] = await Promise.all([
        supabase.from("lounge_posts").select("id, body, topic, created_at, profiles(display_name, wm_handle)").order("created_at", { ascending: false }).limit(50),
        supabase.from("radio_stations").select("stream_url").eq("slug", "wm-radio").maybeSingle(),
        supabase.from("shop_products").select("sku, name, kind, price_cents, note").eq("is_active", true).order("sort_order"),
      ]);
      if (loungeResult.error || stationResult.error || productResult.error) { setCommunityStatus("needs-setup"); return; }
      setPosts((loungeResult.data || []).map(row => toLoungePost(row as CommunityPostRow)));
      if (stationResult.data?.stream_url) setRadioStream(stationResult.data.stream_url);
      if (productResult.data?.length) setShopProducts(productResult.data.map(product => ({ id: product.sku, name: product.name, kind: product.kind, price: product.price_cents / 100, note: product.note })));
      setCommunityStatus("ready");
    };
    void loadCommunity();
  }, []);

  const filtered = useMemo(() => notes.filter(note => `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [notes, query]);
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = shopProducts.reduce((total, item) => total + item.price * (cart[item.id] || 0), 0);
  const addNote = (body: string, kind = "Imported") => {
    const clean = body.trim(); if (!clean) return;
    const title = clean.split(/\n|\.|!/)[0].slice(0, 58) || "Untitled source";
    setNotes(prev => [{ id: Date.now(), title, body: clean, kind, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), tags: ["Unsorted"] }, ...prev]);
  };
  const importNotes = () => { addNote(importText); setImportText(""); setNotice("Source material was added to your Knowledge Vault."); setActive("Knowledge Vault"); };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { addNote(String(reader.result || ""), "Imported file"); setNotice(`${file.name} is now in your Knowledge Vault.`); setActive("Knowledge Vault"); }; reader.readAsText(file); };
  const exportDraft = () => { const blob = new Blob([`# Spiritual Awakening\n\n## Chapter ${chapter + 1}: ${chapters[chapter]}\n\n${draft}`], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "spiritual-awakening-chapter.md"; link.click(); URL.revokeObjectURL(url); setNotice("A Markdown copy of your chapter was downloaded."); };
  const saveSnapshot = () => { const words = draft.trim() ? draft.trim().split(/\s+/).length : 0; const snapshot: Snapshot = { id: Date.now(), label: `Chapter ${chapter + 1} · ${chapters[chapter]}`, body: draft, chapter, date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), words }; setSnapshots(prev => [snapshot, ...prev].slice(0, 20)); setNotice("A protected local version was saved. Cloud history will join it after WM ID is connected."); };
  const restoreSnapshot = (snapshot: Snapshot) => { setDraft(snapshot.body); setChapter(snapshot.chapter); setNotice(`Restored ${snapshot.label}. Your other saved versions are still available.`); setActive("Writing Studio"); };
  const handleNarrationFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setNarrationName(file.name); setNarrationUrl(URL.createObjectURL(file)); setNotice(`${file.name} is loaded into the Audiobook Studio for this browser session.`); };
  const saveJournal = () => { if (!journal.trim()) return; addNote(journal, "Journal"); setJournal(""); setNotice("Your journal entry was added to the vault as source material."); };
  const organize = () => { setOrganized(true); setNotes(prev => prev.map(note => note.tags.includes("Unsorted") ? { ...note, tags: ["Emerging thread"] } : note)); setNotice("Themes are ready to review. You remain in control of every assignment."); };
  const postToLounge = async () => { const body = loungeText.trim(); if (!body) return; const supabase = getSupabaseBrowserClient(); if (!supabase || !wmUser) { setNotice("Set up your WM ID before publishing to the shared Lounge."); setActive("WM ID"); return; } const { data, error } = await supabase.from("lounge_posts").insert({ author_id: wmUser.id, body, topic: "From Dreamboard" }).select("id, body, topic, created_at, profiles(display_name, wm_handle)").single(); if (error || !data) { setNotice("The Lounge database needs its Supabase setup script completed before this can publish."); return; } setPosts(prev => [toLoungePost(data as CommunityPostRow), ...prev]); setLoungeText(""); setNotice("Your update is now shared in the Lounge."); };
  const addToCart = (itemId: string) => { setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 })); setNotice("Added to the Shop cart. Payments will be connected only when you choose your checkout provider."); };
  const toggleRadio = async () => {
    if (!radioStream.trim()) { setNotice("Paste a licensed stream URL first. Dreamboard will never invent a radio signal."); return; }
    if (!audio.current) return;
    if (isPlaying) { audio.current.pause(); setIsPlaying(false); return; }
    try { await audio.current.play(); setIsPlaying(true); setNotice("WM Radio is playing your connected stream."); } catch { setNotice("That stream could not play in this browser. Check the URL and stream permissions."); }
  };
  const publishRadio = async () => { const stream = radioStream.trim(); const supabase = getSupabaseBrowserClient(); if (!stream) { setNotice("Paste your licensed stream URL first."); return; } if (!supabase || !wmUser) { setNotice("Set up your WM ID before publishing a shared station."); setActive("WM ID"); return; } const { error } = await supabase.from("radio_stations").upsert({ slug: "wm-radio", name: "WM Radio", owner_id: wmUser.id, stream_url: stream, is_live: true }, { onConflict: "slug" }); if (error) { setNotice("The Radio database needs its Supabase setup script completed, or this station belongs to another WM owner."); return; } setNotice("WM Radio is now published for Dreamboard visitors."); };
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
  const sendWmMagicLink = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setWmStatus("needs-connection"); setWmMessage("WM ID needs its Supabase connection values added in Vercel first."); return; }
    if (!wmEmail.trim()) { setWmStatus("error"); setWmMessage("Enter your email address first."); return; }
    setWmStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({ email: wmEmail.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) { setWmStatus("error"); setWmMessage(error.message); return; }
    setWmStatus("sent"); setWmMessage("Check your email for the WM ID sign-in link, then return here.");
  };
  const saveWmProfile = async () => {
    const supabase = getSupabaseBrowserClient();
    const handle = wmHandle.trim().toLowerCase();
    if (!supabase || !wmUser) return;
    if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(handle)) { setWmStatus("error"); setWmMessage("Choose 3–30 lowercase letters, numbers, _ or - for your WM ID."); return; }
    setWmStatus("saving");
    const { error } = await supabase.from("profiles").upsert({ id: wmUser.id, wm_handle: handle, display_name: handle });
    if (error) { setWmStatus("error"); setWmMessage("Your account is signed in, but the WM profile table needs the setup script run in Supabase."); return; }
    setWmStatus("saved"); setWmMessage(`WM ID @${handle} is ready across the Wealthy Mindsets ecosystem.`);
  };
  const signOutWm = async () => { const supabase = getSupabaseBrowserClient(); if (!supabase) return; await supabase.auth.signOut(); setWmUser(null); setWmHandle(""); setWmStatus("ready"); setWmMessage("Signed out of WM ID on this device."); };

  return <main className="os-shell">
    <aside className="rail">
      <button className="wordmark dreamboard-mark" onClick={() => setActive("Creator’s Home")} aria-label="Dreamboard home"><span>DB</span><div><b>DREAMBOARD</b><small>BY WEALTHY MINDSETS</small></div></button>
      <div className="rail-title">CREATIVE OS <em>FOUNDATION</em></div>
      <nav>{nav.map(([icon, label]) => <button key={label} className={active === label ? "rail-link selected" : "rail-link"} onClick={() => setActive(label)}><i>{icon}</i><span>{label}</span></button>)}</nav>
      <div className="ecosystem"><p>WM ECOSYSTEM · BUILDING</p><button onClick={() => setActive("Lounge")}><span>◉</span> Lounge <b>OPEN</b></button><button onClick={() => setActive("Shop")}><span>◉</span> Shop <b>OPEN</b></button><button onClick={() => setActive("Radio")}><span>◉</span> Radio <b>OPEN</b></button></div>
      <div className="founder"><span>AH</span><div><b>Above the Hill</b><small>Founder workspace</small></div></div>
    </aside>
    <section className="stage">
      <header><div><span className="eyebrow">DREAMBOARD · CREATIVE OPERATING SYSTEM</span><h1>{active}</h1></div><div className="header-actions"><button className="wm-account" onClick={() => setActive("WM ID")}>{wmUser ? `@${wmHandle || wmUser.email?.split("@")[0] || "member"}` : "Set up WM ID"}</button><span className="presence"><i /> {hydrated ? "Saved on this device" : "Opening workspace"}</span><button className="ghost" onClick={() => setActive("Bulk Import")}>Import material</button><button className="gold" onClick={() => setActive("Writing Studio")}>Continue creating <b>→</b></button></div></header>
      <div className="notice" role="status"><span>✦</span>{notice}</div>
      {active === "Creator’s Home" && <Home notes={notes} draft={draft} wordCount={wordCount} organized={organized} onGo={setActive} onOrganize={organize} />}
      {active === "Bulk Import" && <section className="view import-view"><div className="view-heading"><span className="eyebrow">PRESERVE THE ORIGINAL</span><h2>Bring in the pieces you’ve been carrying.</h2><p>Paste a note or import a plain-text or Markdown file. It enters your Knowledge Vault untouched, ready for your review.</p></div><div className="import-grid"><div className="input-card"><label>PASTE SOURCE MATERIAL<textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="A prayer, voice-note transcript, scene, research excerpt, or unfinished thought..." /></label><button className="gold wide" onClick={importNotes} disabled={!importText.trim()}>Add to Knowledge Vault <b>→</b></button></div><div className="drop-card"><span>⇧</span><h3>Import a file</h3><p>Plain text and Markdown are ready in this first release. Original text is retained alongside the organized view.</p><input ref={fileInput} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleFile} hidden /><button className="ghost" onClick={() => fileInput.current?.click()}>Choose a file</button></div></div></section>}
      {active === "Knowledge Vault" && <section className="view"><div className="view-heading split"><div><span className="eyebrow">YOUR SOURCE LIBRARY</span><h2>Knowledge Vault</h2><p>{notes.length} pieces of material, all still yours.</p></div><button className="gold" onClick={organize}>✦ Organize my notes</button></div><label className="searchbox">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your stories, research, reflections, and journal entries" /></label><div className="vault-list">{filtered.map(note => <article key={note.id}><div className="vault-icon">{note.kind === "Research" ? "⌘" : "✦"}</div><div><span>{note.kind} · {note.date}</span><h3>{note.title}</h3><p>{note.body}</p></div><div className="tag-stack">{note.tags.map(tag => <b key={tag}>{tag}</b>)}</div></article>)}{!filtered.length && <p className="empty-state">Nothing matched that search. Your original material remains safe in the vault.</p>}</div></section>}
      {active === "Book Architect" && <section className="view architect"><div className="view-heading"><span className="eyebrow">MANUSCRIPT ARCHITECTURE</span><h2>Shape the path before you write it.</h2><p>Use these chapters as a working structure. The source material stays available beside the outline.</p></div><div className="outline"><div>{chapters.map((item, index) => <button key={item} className={chapter === index ? "chapter active-chapter" : "chapter"} onClick={() => setChapter(index)}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span><i>{index === chapter ? "Editing" : "Outline"}</i></button>)}</div><aside><span className="eyebrow">CHAPTER {chapter + 1}</span><h3>{chapters[chapter]}</h3><p>Source suggestions are drawn from your vault. They are suggestions only; you decide what becomes part of the manuscript.</p><div className="source-chips">{notes.slice(0, 3).map(n => <button key={n.id} onClick={() => setActive("Knowledge Vault")}>{n.title}</button>)}</div><button className="gold wide" onClick={() => setActive("Writing Studio")}>Write this chapter <b>→</b></button></aside></div></section>}
      {active === "Writing Studio" && <section className="view writing-view"><div className="writing-toolbar"><div><span className="eyebrow">SPIRITUAL AWAKENING / CHAPTER {chapter + 1}</span><h2>{chapters[chapter]}</h2></div><div><span className="draft-status">● Saved on this device</span><button className="ghost" onClick={saveSnapshot}>Save version</button><button className="ghost" onClick={exportDraft}>Export Markdown</button></div></div><textarea className="writer" value={draft} onChange={e => setDraft(e.target.value)} aria-label="Manuscript editor" /><footer className="writer-footer"><span>{wordCount.toLocaleString()} words in this chapter</span><button className="text-button" onClick={() => setActive("AI Studio")}>Ask Dreamboard AI →</button></footer></section>}
      {active === "Creation Journal" && <section className="view journal-view"><div className="view-heading"><span className="eyebrow">CREATION JOURNAL</span><h2>Leave a note for your future self.</h2><p>The journal becomes private source material for your work, not a public performance.</p></div><div className="journal-card"><span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</span><textarea value={journal} onChange={e => setJournal(e.target.value)} placeholder="Today, I want to remember..." /><button className="gold" onClick={saveJournal} disabled={!journal.trim()}>Keep this note <b>→</b></button></div></section>}
      {active === "Projects" && <section className="view"><div className="view-heading"><span className="eyebrow">ACTIVE CREATION</span><h2>Spiritual Awakening</h2><p>Your first proof that Dreamboard works: a real book made from the material only you could have gathered.</p></div><div className="project-focus"><div className="book-cover"><small>SPIRITUAL</small><strong>AWAKENING</strong><em>Above the Hill</em></div><div><span className="eyebrow">BOOK PROJECT · ACTIVE</span><h3>34% manuscript progress</h3><div className="meter"><i /></div><p>{wordCount.toLocaleString()} chapter words · {notes.length} source pieces · {organized ? "themes reviewed" : "themes ready to discover"}</p><button className="gold" onClick={() => setActive("Writing Studio")}>Open Writing Studio <b>→</b></button></div></div></section>}
      {active === "Creative Timeline" && <Timeline notes={notes} />}
      {active === "Version History" && <VersionHistory snapshots={snapshots} onSave={saveSnapshot} onRestore={restoreSnapshot} onWrite={() => setActive("Writing Studio")} />}
      {active === "Reader" && <Reader draft={draft} chapter={chapter} mode={readerMode} setMode={setReaderMode} scale={readerScale} setScale={setReaderScale} />}
      {active === "Audiobook Studio" && <AudiobookStudio fileName={narrationName} source={narrationUrl} inputRef={narrationInput} onFile={handleNarrationFile} />}
      {active === "WM ID" && <WmId user={wmUser} email={wmEmail} setEmail={setWmEmail} handle={wmHandle} setHandle={setWmHandle} status={wmStatus} message={wmMessage} onSend={sendWmMagicLink} onSave={saveWmProfile} onSignOut={signOutWm} />}
      {active === "AI Studio" && <AIStudio prompt={aiPrompt} setPrompt={setAiPrompt} status={aiStatus} result={aiResult} onAsk={askAI} />}
      {active === "Lounge" && <Lounge posts={posts} text={loungeText} setText={setLoungeText} onPost={postToLounge} status={communityStatus} />}
      {active === "Shop" && <Shop total={cartTotal} count={cartCount} onAdd={addToCart} items={shopProducts} status={communityStatus} />}
      {active === "Radio" && <Radio stream={radioStream} setStream={setRadioStream} playing={isPlaying} onToggle={toggleRadio} onPublish={publishRadio} audioRef={audio} status={communityStatus} />}
    </section>
  </main>;
}

function Home({ notes, draft, wordCount, organized, onGo, onOrganize }: { notes: Note[]; draft: string; wordCount: number; organized: boolean; onGo: (view: ActiveView) => void; onOrganize: () => void }) { return <section className="home view"><div className="hero"><div className="hero-copy"><span className="eyebrow">THE HOME FOR YOUR WORK</span><h2>Make room for the work<br />only <em>you</em> can make.</h2><p>Turn what you’ve carried into what you’re called to share—without losing the truth of where it began.</p><div><button className="gold" onClick={() => onGo("Writing Studio")}>Continue writing <b>→</b></button><button className="text-button" onClick={() => onGo("Book Architect")}>View manuscript map</button></div></div><div className="hero-art hero-manuscript"><div className="orbit" /><div className="manuscript-card"><span>SPIRITUAL AWAKENING</span><b>CHAPTER 03</b><i>Learning to Listen</i><p>There was a particular kind of silence that followed the surrender.</p><footer><em /> Draft in progress</footer></div><div className="margin-note">YOUR<br />VOICE<br />LEADS</div></div></div><div className="metrics"><div><span>MANUSCRIPT</span><b>34%</b><i><em /></i><small>{wordCount.toLocaleString()} current draft words</small></div><div><span>KNOWLEDGE VAULT</span><b>{notes.length}</b><small>Pieces of living source material</small></div><div><span>CREATOR VOICE</span><b>Yours</b><small>Review-first AI assistance</small></div></div><div className="home-grid"><section className="home-card vault-home"><div className="card-head"><div><span className="eyebrow">KNOWLEDGE VAULT</span><h3>Return to what matters.</h3></div><button onClick={() => onGo("Knowledge Vault")}>Open vault →</button></div>{notes.slice(0, 3).map(note => <button className="note-row" key={note.id} onClick={() => onGo("Knowledge Vault")}><span>✦</span><div><b>{note.title}</b><small>{note.kind} · {note.date}</small></div><em>{note.tags[0]}</em></button>)}</section><section className="home-card intelligence"><span className="spark">✦</span><span className="eyebrow">CREATIVE INTELLIGENCE</span><h3>{organized ? "Your threads are ready." : "There’s meaning in the mess."}</h3><p>{organized ? "Themes are organized as reviewable suggestions. Nothing was changed without you." : `You have ${notes.length} pieces of source material ready to become a coherent manuscript.`}</p><button className="gold pale" onClick={onOrganize}>{organized ? "Review the threads" : "Organize my notes"} <b>→</b></button></section></div><section className="writing-peek"><div><span className="eyebrow">WRITING STUDIO · ACTIVE DRAFT</span><h3>Learning to Listen</h3><p>{draft.slice(0, 220)}…</p><footer><span>{wordCount.toLocaleString()} words in this chapter</span><button onClick={() => onGo("Writing Studio")}>Open the studio →</button></footer></div></section></section>; }

function Timeline({ notes }: { notes: Note[] }) { return <section className="view"><div className="view-heading"><span className="eyebrow">CREATIVE TIMELINE</span><h2>Moments that shaped the manuscript.</h2><p>Your source material, in the order it entered your story.</p></div><div className="timeline">{notes.map((note, index) => <article key={note.id}><i>{String(index + 1).padStart(2, "0")}</i><div><span>{note.date}</span><h3>{note.title}</h3><p>{note.body}</p></div></article>)}</div></section>; }

function VersionHistory({ snapshots, onSave, onRestore, onWrite }: { snapshots: Snapshot[]; onSave: () => void; onRestore: (snapshot: Snapshot) => void; onWrite: () => void }) { return <section className="view version-view"><div className="view-heading split"><div><span className="eyebrow">LOCAL VERSION HISTORY</span><h2>Every brave edit has a way back.</h2><p>Versions stay on this device today. After WM ID is connected, this same system will become your cloud-backed project history.</p></div><button className="gold" onClick={onSave}>Save a version <b>→</b></button></div>{snapshots.length ? <div className="snapshot-list">{snapshots.map(snapshot => <article key={snapshot.id}><div className="snapshot-seal">{String(snapshot.chapter + 1).padStart(2, "0")}</div><div><span>{snapshot.date} · {snapshot.words.toLocaleString()} words</span><h3>{snapshot.label}</h3><p>{snapshot.body.slice(0, 180)}{snapshot.body.length > 180 ? "…" : ""}</p></div><button className="ghost" onClick={() => onRestore(snapshot)}>Restore</button></article>)}</div> : <section className="empty-workspace"><span>◫</span><h3>Your first saved version is waiting.</h3><p>Keep writing, then choose Save version. Dreamboard will preserve up to 20 local versions while cloud history is being connected.</p><button className="gold" onClick={onWrite}>Open Writing Studio <b>→</b></button></section>}</section>; }

function Reader({ draft, chapter, mode, setMode, scale, setScale }: { draft: string; chapter: number; mode: "comfortable" | "night" | "paper"; setMode: (mode: "comfortable" | "night" | "paper") => void; scale: number; setScale: (value: number) => void }) { return <section className="view reader-view"><div className="reader-toolbar"><div><span className="eyebrow">DREAMBOARD READER · PREVIEW</span><h2>Spiritual Awakening</h2></div><div className="reader-controls"><label>TYPE SIZE<input type="range" min="15" max="25" value={scale} onChange={event => setScale(Number(event.target.value))} /></label><div>{(["comfortable", "night", "paper"] as const).map(item => <button key={item} className={mode === item ? "reader-mode selected" : "reader-mode"} onClick={() => setMode(item)}>{item}</button>)}</div></div></div><article className={`reader-page reader-${mode}`} style={{ fontSize: `${scale}px` }}><span className="reader-kicker">CHAPTER {chapter + 1}</span><h3>{chapters[chapter]}</h3>{draft.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}<footer><span>SPIRITUAL AWAKENING</span><b>{chapter + 1}</b></footer></article></section>; }

function AudiobookStudio({ fileName, source, inputRef, onFile }: { fileName: string; source: string; inputRef: RefObject<HTMLInputElement | null>; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) { return <section className="view audio-studio"><div className="view-heading"><span className="eyebrow">AUDIOBOOK STUDIO · FOUNDATION</span><h2>Give the manuscript a voice.</h2><p>Bring in approved human narration one chapter at a time. Dreamboard keeps this first release focused on your owned or licensed audio.</p></div><div className="audio-grid"><section className="audio-card audio-upload"><span className="audio-icon">◉</span><h3>{fileName || "Add a narration file"}</h3><p>{fileName ? "Loaded for playback in this browser session. Cloud audio storage comes with the Supabase connection." : "MP3, WAV, M4A, and OGG are ready for a first listening pass."}</p><input ref={inputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/ogg" onChange={onFile} hidden /><button className="gold" onClick={() => inputRef.current?.click()}>{fileName ? "Replace audio" : "Choose audio"} <b>→</b></button></section><section className="audio-card audio-deck"><span className="eyebrow">CHAPTER 03 · LEARNING TO LISTEN</span><h3>{fileName || "Narration deck"}</h3>{source ? <audio controls src={source} className="narration-player">Your browser does not support audio playback.</audio> : <div className="audio-empty"><i>▶</i><span>Audio appears here after you select a file.</span></div>}<div className="audio-timeline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><footer><span>Human narration only</span><span>Cloud publishing · next</span></footer></section></div></section>; }

function WmId({ user, email, setEmail, handle, setHandle, status, message, onSend, onSave, onSignOut }: { user: User | null; email: string; setEmail: (value: string) => void; handle: string; setHandle: (value: string) => void; status: string; message: string; onSend: () => void; onSave: () => void; onSignOut: () => void }) { const missingConnection = status === "needs-connection"; return <section className="view wm-id"><div className="view-heading"><span className="eyebrow">ONE ID · EVERY WM SPACE</span><h2>Your Wealthy Mindsets identity.</h2><p>One secure WM ID will carry your creator profile into Dreamboard, Lounge, Shop, Radio, and the experiences still being built.</p></div><div className="wm-grid"><section className="wm-card wm-orbit-card"><div className="wm-seal">WM</div><span className="eyebrow">WEALTHY MINDSETS ID</span><h3>{user ? `Welcome, ${user.email}` : "Make the work yours."}</h3><p>{user ? "Your account is verified by Supabase. Choose a WM ID below to give it a home across the ecosystem." : "Sign in with a passwordless email link. No separate Dreamboard password to remember."}</p><div className="wm-path"><span>Dreamboard</span><i>→</i><span>Lounge</span><i>→</i><span>Shop</span><i>→</i><span>Radio</span></div></section><section className="wm-card wm-form">{missingConnection ? <><span className="eyebrow">CONNECTION REQUIRED</span><h3>Link the Supabase project.</h3><p>WM ID is built into Dreamboard. Add the project URL and publishable key in Vercel, then it becomes live for every visitor.</p><div className="connection-note"><b>Safe connection values only:</b><span>Use your Project URL and Publishable key. Never use a secret key or service-role key in Dreamboard.</span></div></> : !user ? <><span className="eyebrow">CREATE OR SIGN IN</span><h3>Start with your email.</h3><label>EMAIL ADDRESS<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><button className="gold wide" onClick={onSend} disabled={status === "sending"}>{status === "sending" ? "Sending link…" : "Send my WM ID link"} <b>→</b></button><p className="wm-message">{message || "We’ll email a secure sign-in link instead of asking you to make another password."}</p></> : <><span className="eyebrow">CLAIM YOUR WM ID</span><h3>Choose the name people will know.</h3><label>WM ID<input value={handle} onChange={event => setHandle(event.target.value)} placeholder="above_the_hill" autoCapitalize="none" /></label><button className="gold wide" onClick={onSave} disabled={status === "saving"}>{status === "saving" ? "Saving WM ID…" : "Save my WM ID"} <b>→</b></button><p className="wm-message">{message || "Your WM ID is private until you choose to share it in the Lounge or a creator profile."}</p><button className="text-button" onClick={onSignOut}>Sign out on this device</button></>}</section></div></section>; }

function AIStudio({ prompt, setPrompt, status, result, onAsk }: { prompt: string; setPrompt: (value: string) => void; status: string; result: string; onAsk: () => void }) { return <section className="view ai-studio"><div className="view-heading"><span className="eyebrow">OPEN-MODEL AI FOUNDATION</span><h2>Creative intelligence, under your direction.</h2><p>Dreamboard’s AI connection is real infrastructure: it only runs when you connect your chosen hosted, open-model provider in the app’s environment settings. It never silently changes your manuscript.</p></div><div className="ai-grid"><section className="ai-card"><div className="card-head"><div><span className="eyebrow">ASK FOR A REVIEW</span><h3>Keep your voice in charge.</h3></div><span className={status === "ready" ? "ai-pill connected" : "ai-pill"}>{status === "ready" ? "MODEL CONNECTED" : "CONNECTOR READY"}</span></div><textarea value={prompt} onChange={event => setPrompt(event.target.value)} aria-label="AI request" /><button className="gold" onClick={onAsk} disabled={status === "working"}>{status === "working" ? "Thinking…" : "Ask for a suggestion"} <b>→</b></button><p className="assist-note">Suggestions appear below for review. Nothing is applied to your draft automatically.</p></section><section className="ai-card ai-result"><span className="eyebrow">REVIEW PANEL</span><h3>{status === "needs-connection" ? "One connection left" : status === "ready" ? "A suggestion to review" : "Your next collaborator"}</h3><p>{result || "Connect your open-model provider once, then use this space for outlining, source discovery, chapter questions, and gentle editorial feedback."}</p>{status === "needs-connection" && <div className="connection-note"><b>What is already built:</b><span>The secure server connector, a review-first workflow, and a provider-neutral format. Add AI_BASE_URL, AI_API_KEY, and AI_MODEL to Vercel when you choose your provider.</span></div>}</section></div><section className="roadmap-strip"><span className="eyebrow">BUILT NEXT, WITHOUT BLOCKING YOUR BOOK</span><div><b>Creator profiles</b><b>Cloud vault</b><b>Reader</b><b>Audiobook studio</b><b>Comic studio</b></div></section></section>; }

function Lounge({ posts, text, setText, onPost, status }: { posts: LoungePost[]; text: string; setText: (value: string) => void; onPost: () => Promise<void>; status: CommunityStatus }) { const shared = status === "ready"; return <section className="view ecosystem-view"><div className="view-heading"><span className="eyebrow">WEALTHY MINDSETS LOUNGE</span><h2>Let the work find its people.</h2><p>The Lounge begins inside Dreamboard: share a creator update, keep the work connected to its community, and make every public moment intentional.</p></div><div className="lounge-layout"><section className="lounge-composer"><div className="card-head"><div><span className="eyebrow">FROM YOUR CREATIVE DESK</span><h3>Post to the Lounge</h3></div><span className="live-dot">{shared ? "SHARED" : "SETUP REQUIRED"}</span></div><textarea value={text} onChange={event => setText(event.target.value)} placeholder="Share a thought, a milestone, or an invitation…" /><div><button className="ghost">Add source</button><button className="gold" onClick={() => void onPost()} disabled={!text.trim()}>Share update <b>→</b></button></div><p>{shared ? "Posts are stored in the shared Lounge. A WM ID is required before publishing." : "Connect Supabase and run the Dreamboard community script to publish shared Lounge posts."}</p></section><section className="lounge-feed">{posts.length ? posts.map(post => <article key={post.id}><div className="post-avatar">WM</div><div><header><span><b>{post.author}</b><small>{post.topic} · {post.time}</small></span><button aria-label="More post options">•••</button></header><p>{post.body}</p><footer><button>♡ {post.likes}</button><button>⌁ Reply</button><button>↗ Share</button></footer></div></article>) : <div className="empty-workspace"><span>◉</span><h3>The Lounge is waiting for its first shared post.</h3><p>Set up WM ID, then publish the thought that starts the room.</p></div>}</section></div></section>; }

function Shop({ total, count, onAdd, items, status }: { total: number; count: number; onAdd: (itemId: string) => void; items: typeof shopItems; status: CommunityStatus }) { return <section className="view ecosystem-view"><div className="view-heading split"><div><span className="eyebrow">WEALTHY MINDSETS SHOP</span><h2>Build the shelf around your work.</h2><p>Products live beside their source project so books, art, journals, and future releases can move into the Shop intentionally.</p></div><div className="cart-summary"><span>YOUR CART</span><b>{count} item{count === 1 ? "" : "s"}</b><small>${total.toFixed(2)}</small></div></div><div className="shop-grid">{items.map((item, index) => <article className={`shop-item tone-${index + 1}`} key={item.id}><div className="shop-art"><span>{index === 0 ? "SPIRITUAL\nAWAKENING" : index === 1 ? "DREAM\nBOARD" : "ABOVE\nTHE HILL"}</span></div><div><span>{item.kind}</span><h3>{item.name}</h3><p>{item.note}</p><footer><b>${item.price.toFixed(2)}</b><button className="cart-button" onClick={() => onAdd(item.id)}>Add to cart +</button></footer></div></article>)}</div><div className="shop-connection"><span>{status === "ready" ? "SHARED CATALOG · CHECKOUT NEXT" : "PAYMENTS ARE NOT PRETENDING TO BE LIVE"}</span><p>{status === "ready" ? "The catalog now comes from Dreamboard’s shared database. The cart works on this device; secure checkout needs the payment account you choose." : "Your catalog and cart are working. The secure checkout connection comes next, after you decide which payment provider and account Dreamboard should use."}</p></div></section>; }

function Radio({ stream, setStream, playing, onToggle, onPublish, audioRef, status }: { stream: string; setStream: (value: string) => void; playing: boolean; onToggle: () => void; onPublish: () => Promise<void>; audioRef: RefObject<HTMLAudioElement | null>; status: CommunityStatus }) { return <section className="view ecosystem-view radio-view"><div className="view-heading"><span className="eyebrow">WEALTHY MINDSETS RADIO</span><h2>A home for the sound behind the work.</h2><p>Connect a licensed live stream and use Dreamboard as the first real WM Radio control room.</p></div><div className="radio-console"><div className="radio-record"><i /></div><div className="radio-main"><div className="live-label">{playing ? "● LIVE NOW" : status === "ready" ? "○ SHARED STATION READY" : "○ STATION SETUP"}</div><h3>WM Radio</h3><p>{stream ? "Your connected station is ready to play." : "No stream connected yet — add your station URL below."}</p><div className="wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><button className="radio-play" onClick={onToggle} aria-label={playing ? "Pause WM Radio" : "Play WM Radio"}>{playing ? "Ⅱ" : "▶"}</button><audio ref={audioRef} src={stream || undefined} /></div><div className="radio-connect"><span className="eyebrow">STATION CONNECTION</span><label>LICENSED STREAM URL<input value={stream} onChange={event => setStream(event.target.value)} placeholder="https://your-radio-stream…" /></label><p>This is a real audio player. Use only a stream you own or are licensed to broadcast.</p><button className="gold" onClick={() => void onPublish()}>Publish WM Radio <b>→</b></button><button className="ghost" onClick={() => setStream("")}>Clear station</button></div></div></section>; }
