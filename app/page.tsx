"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { VisionVaultView, useVisionVault } from "./vision-vault";
import { CreativeGraphView, useCreativeGraph } from "./creative-graph";
import { CreatorHome } from "./creator-home";
import { PassportView } from "./passport";
import { ProjectsView, useProjects } from "./projects";
import { BookArchitectView, useChapters } from "./book-architect";
import { SearchView } from "./search";
import { ImportProcessingPanel, useImportPipeline } from "./import-pipeline";
import { DriveImportPanel } from "./drive-import";
import { AIStudioView, type CompanionRun } from "./ai-studio";

type Note = { id: number; title: string; body: string; kind: string; date: string; tags: string[] };
type LoungePost = { id: string | number; author: string; body: string; topic: string; time: string; likes: number };
type Snapshot = { id: number; label: string; body: string; chapter: number; date: string; words: number };
type ActiveView = "Creator’s Home" | "Search" | "Creator Compass" | "Projects" | "Bulk Import" | "Vision Vault" | "Knowledge Vault" | "Creative Graph" | "Book Architect" | "Writing Studio" | "Creative Timeline" | "Creation Journal" | "Version History" | "Reader" | "Audiobook Studio" | "AI Studio" | "Passport" | "Lounge" | "Shop" | "Radio" | "Settings";
type CreatorSeason = "planting" | "growing" | "building" | "blooming" | "harvest" | "stewardship" | "new-seeds";
type DreamTheme = "emerald-gold" | "midnight-gold" | "violet-gold" | "blue-gold";
type ImportBatch = { id: string; label: string; status: string; file_count: number; uploaded_count: number; failed_count: number; total_bytes: number; created_at: string };
type VaultEntry = { id: string; title: string; content: string; source_type: string; status: string; tags: string[]; created_at: string; updated_at: string };
type WritingDocument = { id: string; title: string; chapter_number: number; body: string; updated_at: string };

const initialNotes: Note[] = [];
const initialPosts: LoungePost[] = [];
const starterDraft = "";
const nav: Array<[string, ActiveView]> = [["⌂", "Creator’s Home"], ["⌖", "Search"], ["◇", "Passport"], ["✧", "Creator Compass"], ["▦", "Projects"], ["⇧", "Bulk Import"], ["✧", "Vision Vault"], ["⌕", "Knowledge Vault"], ["⌬", "Creative Graph"], ["✦", "Book Architect"], ["✎", "Writing Studio"], ["◫", "Version History"], ["▤", "Reader"], ["◉", "Audiobook Studio"], ["◷", "Creative Timeline"], ["◫", "Creation Journal"], ["✦", "AI Studio"], ["◉", "Lounge"], ["▣", "Shop"], ["◌", "Radio"]];
const shopItems: Array<{ id: string; name: string; kind: string; price: number; note: string }> = [];
const wowWorldUrl = "https://wealthymindsets-pro.vercel.app";

type CommunityStatus = "local" | "connecting" | "ready" | "needs-setup";
type CommunityPostRow = { id: string; body: string; topic: string; created_at: string; author_label: string };

function toLoungePost(row: CommunityPostRow): LoungePost {
  return { id: row.id, author: row.author_label, body: row.body, topic: row.topic, time: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(row.created_at)), likes: 0 };
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const saved = window.localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; } catch { return fallback; }
}

function storageSafeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-file";
}

export default function Dreamboard() {
  const [active, setActive] = useState<ActiveView>("Creator’s Home");
  const [notes, setNotes] = useState(initialNotes);
  const [query, setQuery] = useState("");
  const [importText, setImportText] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importLabel, setImportLabel] = useState("My source library");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ uploaded: 0, failed: 0, total: 0 });
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [companionRuns, setCompanionRuns] = useState<CompanionRun[]>([]);
  const [writingDocument, setWritingDocument] = useState<WritingDocument | null>(null);
  const [draft, setDraft] = useState(starterDraft);
  const [chapter, setChapter] = useState(0);
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
  const [passportUser, setPassportUser] = useState<User | null>(null);
  const [passportEmail, setPassportEmail] = useState("");
  const [passportHandle, setPassportHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [wisdomMode, setWisdomMode] = useState(false);
  const [creatorSeason, setCreatorSeason] = useState<CreatorSeason>("planting");
  const [dreamTheme, setDreamTheme] = useState<DreamTheme>("emerald-gold");
  const [passportStatus, setPassportStatus] = useState<"ready" | "sending" | "sent" | "saving" | "saved" | "needs-connection" | "error">(() => getSupabaseBrowserClient() ? "ready" : "needs-connection");
  const [passportMessage, setPassportMessage] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [readerMode, setReaderMode] = useState<"comfortable" | "night" | "paper">("comfortable");
  const [readerScale, setReaderScale] = useState(18);
  const [narrationUrl, setNarrationUrl] = useState("");
  const [narrationName, setNarrationName] = useState("");
  const visionVault = useVisionVault(passportUser, setNotice);
  const creativeGraph = useCreativeGraph(passportUser, setNotice);
  const projects = useProjects(passportUser, setNotice, writingDocument?.id || null);
  const bookChapters = useChapters(passportUser, setNotice);
  const importPipeline = useImportPipeline(passportUser, setNotice);
  const chapterTitles = bookChapters.chapters.length ? bookChapters.chapters.map(item => item.title) : ["Untitled chapter"];
  const chapterTitle = chapterTitles[Math.min(chapter, chapterTitles.length - 1)];
  const fileInput = useRef<HTMLInputElement>(null);
  const bulkFileInput = useRef<HTMLInputElement>(null);
  const narrationInput = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotes(readLocal("dreamboard-notes-v2", initialNotes));
      setDraft(readLocal("dreamboard-draft-v2", starterDraft));
      setPosts(readLocal("dreamboard-lounge", initialPosts));
      setCart(readLocal("dreamboard-cart", {}));
      setRadioStream(readLocal("dreamboard-radio-stream", ""));
      setSnapshots(readLocal<Snapshot[]>("dreamboard-snapshots", []));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !passportUser) return;
    const loadBatches = async () => {
      const { data } = await supabase.from("dreamboard_import_batches").select("id, label, status, file_count, uploaded_count, failed_count, total_bytes, created_at").order("created_at", { ascending: false }).limit(8);
      if (data) setImportBatches(data as ImportBatch[]);
    };
    void loadBatches();
  }, [passportUser]);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !passportUser) return;
    const loadWorkspace = async () => {
      const [vaultResult, companionResult, documentsResult] = await Promise.all([
        supabase.from("dreamboard_vault_entries").select("id,title,content,source_type,status,tags,created_at,updated_at").order("updated_at", { ascending: false }).limit(500),
        supabase.from("dreamboard_companion_runs").select("id,prompt,selected_skills,selected_persona,wisdom_enabled,output,provider,created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("dreamboard_writing_documents").select("id,title,chapter_number,body,updated_at").order("updated_at", { ascending: false }).limit(1),
      ]);
      if (vaultResult.data) {
        const remoteVault = vaultResult.data as VaultEntry[];
        if (remoteVault.length) setNotes(remoteVault.map((entry, index) => ({ id: index + 1, title: entry.title, body: entry.content, kind: entry.source_type, date: new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), tags: entry.tags || [] })));
      }
      if (companionResult.data) setCompanionRuns(companionResult.data as CompanionRun[]);
      if (documentsResult.data?.[0]) { const document = documentsResult.data[0] as WritingDocument; setWritingDocument(document); setDraft(document.body); setChapter(Math.max(0, document.chapter_number - 1)); }
    };
    void loadWorkspace();
  }, [passportUser]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-notes-v2", JSON.stringify(notes)); }, [notes, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-draft-v2", JSON.stringify(draft)); }, [draft, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-lounge", JSON.stringify(posts)); }, [posts, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-cart", JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-radio-stream", JSON.stringify(radioStream)); }, [radioStream, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("dreamboard-snapshots", JSON.stringify(snapshots)); }, [snapshots, hydrated]);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const loadIdentity = async (user: User | null) => {
      setPassportUser(user);
      if (!user) return;
      const [passportResult, profileResult] = await Promise.all([
        supabase.from("wm_id").select("wm_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("dreamboard_profiles").select("display_name, wisdom_mode, creator_season, theme").eq("id", user.id).maybeSingle(),
      ]);
      if (passportResult.data?.wm_id) setPassportHandle(passportResult.data.wm_id);
      if (profileResult.data) {
        setDisplayName(profileResult.data.display_name || "");
        setWisdomMode(profileResult.data.wisdom_mode);
        setCreatorSeason(profileResult.data.creator_season as CreatorSeason);
        setDreamTheme(profileResult.data.theme as DreamTheme);
      }
      setPassportStatus("ready");
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
        supabase.from("dreamboard_lounge_posts").select("id, author_label, body, topic, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("dreamboard_radio_stations").select("stream_url").eq("slug", "wow-radio").maybeSingle(),
        supabase.from("dreamboard_shop_products").select("sku, name, kind, price_cents, note").eq("is_active", true).order("sort_order"),
      ]);
      if (loungeResult.error || stationResult.error || productResult.error) { setCommunityStatus("needs-setup"); return; }
      setPosts((loungeResult.data || []).map(row => toLoungePost(row as CommunityPostRow)));
      if (stationResult.data?.stream_url) setRadioStream(stationResult.data.stream_url);
      if (productResult.data?.length) setShopProducts(productResult.data.filter(product => !["spiritual-awakening", "dreamboard-journal", "above-the-hill-print"].includes(product.sku)).map(product => ({ id: product.sku, name: product.name, kind: product.kind, price: product.price_cents / 100, note: product.note })));
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
    const localNote: Note = { id: Date.now(), title, body: clean, kind, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), tags: ["Unsorted"] };
    setNotes(prev => [localNote, ...prev]);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !passportUser) return;
    void (async () => {
      const sourceType = kind === "Journal" ? "journal" : kind === "Research" ? "research" : "manual";
      const { data: entry, error } = await supabase.from("dreamboard_vault_entries").insert({ owner_id: passportUser.id, title, content: clean, source_type: sourceType, tags: ["Unsorted"] }).select("id,title,content,source_type,status,tags,created_at,updated_at").single();
      if (error || !entry) { setNotice("This note remains safely on this device. Dreamboard could not save its cloud copy yet."); return; }
      const saved = entry as VaultEntry;
      await supabase.from("dreamboard_graph_nodes").insert({ owner_id: passportUser.id, vault_entry_id: saved.id, node_type: "source", label: saved.title, description: saved.content.slice(0, 360) });
      setNotice("Saved to your private Knowledge Vault and added to your Creative Graph.");
    })();
  };
  const importNotes = () => { addNote(importText); setImportText(""); setNotice("Source material was added to your Knowledge Vault."); setActive("Knowledge Vault"); };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { addNote(String(reader.result || ""), "Imported file"); setNotice(`${file.name} is now in your Knowledge Vault.`); setActive("Knowledge Vault"); }; reader.readAsText(file); };
  const chooseImportFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImportFiles(files);
    setImportProgress({ uploaded: 0, failed: 0, total: files.length });
    if (files.length) setNotice(`${files.length.toLocaleString()} file${files.length === 1 ? "" : "s"} staged. Nothing uploads until you start the private import.`);
  };
  const uploadImportBatch = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !passportUser) { setNotice("Set up your Passport before starting a private import."); setActive("Passport"); return; }
    if (!importFiles.length) { setNotice("Choose one or more files first."); return; }
    setImporting(true);
    setImportProgress({ uploaded: 0, failed: 0, total: importFiles.length });
    const totalBytes = importFiles.reduce((total, file) => total + file.size, 0);
    const { data: batch, error: batchError } = await supabase.from("dreamboard_import_batches").insert({ owner_id: passportUser.id, source: "device", label: importLabel.trim() || "My source library", file_count: importFiles.length, total_bytes: totalBytes }).select("id, label, status, file_count, uploaded_count, failed_count, total_bytes, created_at").single();
    if (batchError || !batch) { setImporting(false); setNotice("Dreamboard could not open the private import batch. Please try again."); return; }
    let nextIndex = 0;
    let uploaded = 0;
    let failed = 0;
    const uploadOne = async () => {
      while (nextIndex < importFiles.length) {
        const index = nextIndex++;
        const file = importFiles[index];
        const path = `${passportUser.id}/${batch.id}/${String(index + 1).padStart(5, "0")}-${storageSafeName(file.name)}`;
        const { error: storageError } = await supabase.storage.from("dreamboard-private").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        const { error: documentError } = storageError ? { error: storageError } : await supabase.from("dreamboard_source_documents").insert({ owner_id: passportUser.id, batch_id: batch.id, file_name: file.name, mime_type: file.type || "application/octet-stream", storage_path: path, byte_size: file.size, source: "device" });
        if (documentError) failed += 1; else uploaded += 1;
        setImportProgress({ uploaded, failed, total: importFiles.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, importFiles.length) }, () => uploadOne()));
    const status = failed ? (uploaded ? "partial" : "failed") : "uploaded";
    await supabase.from("dreamboard_import_batches").update({ status, uploaded_count: uploaded, failed_count: failed, updated_at: new Date().toISOString() }).eq("id", batch.id);
    setImportBatches(previous => [{ ...batch, status, uploaded_count: uploaded, failed_count: failed }, ...previous].slice(0, 8));
    setImporting(false);
    setNotice(failed ? `${uploaded.toLocaleString()} files were secured; ${failed.toLocaleString()} need another try. Your batch record is saved.` : `${uploaded.toLocaleString()} files are now privately secured in your Dreamboard vault. Text extraction and indexing come next.`);
  };
  const exportDraft = () => { const blob = new Blob([`# ${writingDocument?.title || "Untitled project"}\n\n## Chapter ${chapter + 1}: ${chapterTitle}\n\n${draft}`], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "dreamboard-chapter.md"; link.click(); URL.revokeObjectURL(url); setNotice("A Markdown copy of your chapter was downloaded."); };
  const saveSnapshot = () => { const words = draft.trim() ? draft.trim().split(/\s+/).length : 0; const snapshot: Snapshot = { id: Date.now(), label: `Chapter ${chapter + 1} · ${chapterTitle}`, body: draft, chapter, date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), words }; setSnapshots(prev => [snapshot, ...prev].slice(0, 20)); const supabase = getSupabaseBrowserClient(); const existingDocumentId = writingDocument?.id; const existingDocumentTitle = writingDocument?.title; if (!supabase || !passportUser) { setNotice("A protected local version was saved. Sign in with your Passport to add cloud history."); return; } void (async () => { let documentId = existingDocumentId; if (!documentId) { const { data } = await supabase.from("dreamboard_writing_documents").insert({ owner_id: passportUser.id, title: `Untitled project — ${chapterTitle}`, chapter_number: chapter + 1, body: draft }).select("id,title,chapter_number,body,updated_at").single(); if (data) { const next = data as WritingDocument; setWritingDocument(next); documentId = next.id; } } else { await supabase.from("dreamboard_writing_documents").update({ title: existingDocumentTitle || `Untitled project — ${chapterTitle}`, chapter_number: chapter + 1, body: draft, updated_at: new Date().toISOString() }).eq("id", documentId); }
      if (documentId) await supabase.from("dreamboard_document_versions").insert({ owner_id: passportUser.id, document_id: documentId, label: snapshot.label, body: draft, word_count: words });
      setNotice("A local and private cloud version were saved."); })(); };
  const restoreSnapshot = (snapshot: Snapshot) => { setDraft(snapshot.body); setChapter(snapshot.chapter); setNotice(`Restored ${snapshot.label}. Your other saved versions are still available.`); setActive("Writing Studio"); };
  const handleNarrationFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setNarrationName(file.name); setNarrationUrl(URL.createObjectURL(file)); setNotice(`${file.name} is loaded into the Audiobook Studio for this browser session.`); };
  const saveJournal = () => { if (!journal.trim()) return; addNote(journal, "Journal"); setJournal(""); setNotice("Your journal entry was added to the vault as source material."); };
  const organize = () => { setOrganized(true); setNotes(prev => prev.map(note => note.tags.includes("Unsorted") ? { ...note, tags: ["Emerging thread"] } : note)); setNotice("Themes are ready to review. You remain in control of every assignment."); };
  const postToLounge = async () => { const body = loungeText.trim(); if (!body) return; const supabase = getSupabaseBrowserClient(); if (!supabase || !passportUser || !passportHandle) { setNotice("Set up your Passport before publishing to the shared Lounge."); setActive("Passport"); return; } const { data, error } = await supabase.from("dreamboard_lounge_posts").insert({ author_id: passportUser.id, author_label: displayName || `@${passportHandle}`, body, topic: "From Dreamboard" }).select("id, author_label, body, topic, created_at").single(); if (error || !data) { setNotice("Dreamboard could not publish that post. Please try again after confirming your Passport."); return; } setPosts(prev => [toLoungePost(data as CommunityPostRow), ...prev]); setLoungeText(""); setNotice("Your update is now shared in WOW World Lounge."); };
  const addToCart = (itemId: string) => { setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 })); setNotice("Added to the Shop cart. Payments will be connected only when you choose your checkout provider."); };
  const toggleRadio = async () => {
    if (!radioStream.trim()) { setNotice("Paste a licensed stream URL first. Dreamboard will never invent a radio signal."); return; }
    if (!audio.current) return;
    if (isPlaying) { audio.current.pause(); setIsPlaying(false); return; }
    try { await audio.current.play(); setIsPlaying(true); setNotice("WOW Radio is playing your connected stream."); } catch { setNotice("That stream could not play in this browser. Check the URL and stream permissions."); }
  };
  const publishRadio = async () => { const stream = radioStream.trim(); const supabase = getSupabaseBrowserClient(); if (!stream) { setNotice("Paste a licensed stream URL first."); return; } if (!supabase || !passportUser) { setNotice("Set up your Passport before publishing a shared station."); setActive("Passport"); return; } const { error } = await supabase.from("dreamboard_radio_stations").upsert({ slug: "wow-radio", name: "WOW Radio", owner_id: passportUser.id, stream_url: stream, is_live: true }, { onConflict: "slug" }); if (error) { setNotice("This station could not be published. The Passport that first published it owns its updates."); return; } setNotice("WOW Radio is now published for Dreamboard visitors."); };
  const sendPassportMagicLink = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setPassportStatus("needs-connection"); setPassportMessage("Passport needs its Supabase connection values added in Vercel first."); return; }
    if (!passportEmail.trim()) { setPassportStatus("error"); setPassportMessage("Enter your email address first."); return; }
    setPassportStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({ email: passportEmail.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) { setPassportStatus("error"); setPassportMessage(error.message); return; }
    setPassportStatus("sent"); setPassportMessage(`Passport sign-in email sent to ${passportEmail.trim()}. Open the link in that email, then return here. If it is not visible in a few minutes, check Spam or Promotions.`);
  };
  const savePassportProfile = async () => {
    const supabase = getSupabaseBrowserClient();
    const handle = passportHandle.trim().toLowerCase();
    if (!supabase || !passportUser) return;
    if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(handle)) { setPassportStatus("error"); setPassportMessage("Choose 3–30 lowercase letters, numbers, _ or - for your Passport handle."); return; }
    setPassportStatus("saving");
    const { error: wmError } = await supabase.from("wm_id").upsert({ user_id: passportUser.id, wm_id: handle }, { onConflict: "user_id" });
    const { error: profileError } = await supabase.from("dreamboard_profiles").upsert({ id: passportUser.id, display_name: displayName || handle, wisdom_mode: wisdomMode, creator_season: creatorSeason, theme: dreamTheme });
    if (wmError || profileError) { setPassportStatus("error"); setPassportMessage("Your account is signed in, but Dreamboard could not save the Passport yet. Please try once more."); return; }
    setPassportStatus("saved"); setPassportMessage(`Passport @${handle} is ready across WOW World.`);
  };
  const saveCreatorSettings = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !passportUser) { setNotice("Sign in with your Passport before saving creator settings."); setActive("Passport"); return; }
    const { error } = await supabase.from("dreamboard_profiles").upsert({ id: passportUser.id, display_name: displayName || passportHandle || "Creator", wisdom_mode: wisdomMode, creator_season: creatorSeason, theme: dreamTheme });
    setNotice(error ? "Your settings could not save yet. Your local choices are still visible in this session." : "Your Dreamboard settings are saved to your creator account.");
  };
  const signOutPassport = async () => { const supabase = getSupabaseBrowserClient(); if (!supabase) return; await supabase.auth.signOut(); setPassportUser(null); setPassportHandle(""); setPassportStatus("ready"); setPassportMessage("Signed out of Passport on this device."); };

  return <main className={`os-shell theme-${dreamTheme}`}>
    <aside className="rail">
      <button className="wordmark dreamboard-mark" onClick={() => setActive("Creator’s Home")} aria-label="Dreamboard home"><span>DB</span><div><b>DREAMBOARD</b><small>BY WOW WORLD</small></div></button>
      <div className="rail-title">CREATIVE OS <em>FOUNDATION</em></div>
      <nav>{nav.map(([icon, label]) => <button key={label} className={active === label ? "rail-link selected" : "rail-link"} onClick={() => setActive(label)}><i>{icon}</i><span>{label}</span></button>)}</nav>
      <div className="ecosystem"><p>WOW WORLD · LIVE IN OVERFLOW</p><button onClick={() => setActive("Lounge")}><span>◉</span> Lounge <b>OPEN</b></button><button onClick={() => setActive("Shop")}><span>◉</span> Shop <b>OPEN</b></button><button onClick={() => setActive("Radio")}><span>◉</span> Radio <b>OPEN</b></button></div>
      <button className="founder" onClick={() => setActive("Settings")}><span>AH</span><div><b>Above the Hill</b><small>Settings · founder workspace</small></div></button>
    </aside>
    <section className="stage">
      <header><div><span className="eyebrow">DREAMBOARD · WOW WORLD CREATIVE SYSTEM</span><h1>{active}</h1></div><div className="header-actions"><button className="wm-account" onClick={() => setActive("Passport")}>{passportUser ? `@${passportHandle || passportUser.email?.split("@")[0] || "member"}` : "Set up Passport"}</button><span className="presence"><i /> {hydrated ? "Saved on this device" : "Opening workspace"}</span><button className="ghost" onClick={() => setActive("Bulk Import")}>Import material</button><button className="gold" onClick={() => setActive("Writing Studio")}>Continue creating <b>→</b></button></div></header>
      <div className="notice" role="status"><span>✦</span>{notice}</div>
      {active === "Creator’s Home" && <CreatorHome notes={notes} draft={draft} wordCount={wordCount} organized={organized} wisdomMode={wisdomMode} creatorSeason={creatorSeason} onGo={setActive} onOrganize={organize} vault={visionVault} snapshots={snapshots} importBatches={importBatches} projectTitle={writingDocument?.title || null} />}
      {active === "Search" && <SearchView user={passportUser} onGo={setActive} />}
      {active === "Vision Vault" && <VisionVaultView vault={visionVault} signedIn={Boolean(passportUser)} onPassport={() => setActive("Passport")} />}
      {active === "Bulk Import" && <><BulkImport importText={importText} setImportText={setImportText} onAddText={importNotes} singleInput={fileInput} onSingleFile={handleFile} bulkInput={bulkFileInput} onFiles={chooseImportFiles} files={importFiles} label={importLabel} setLabel={setImportLabel} importing={importing} progress={importProgress} batches={importBatches} signedIn={Boolean(passportUser)} onStart={() => void uploadImportBatch()} onPassport={() => setActive("Passport")} /><DriveImportPanel user={passportUser} notify={setNotice} onImported={() => { const supabase = getSupabaseBrowserClient(); if (supabase) void supabase.from("dreamboard_import_batches").select("id, label, status, file_count, uploaded_count, failed_count, total_bytes, created_at").order("created_at", { ascending: false }).limit(8).then(({ data }) => { if (data) setImportBatches(data as ImportBatch[]); }); }} /><ImportProcessingPanel pipeline={importPipeline} batches={importBatches} signedIn={Boolean(passportUser)} /></>}
      {active === "Knowledge Vault" && <section className="view"><div className="view-heading split"><div><span className="eyebrow">YOUR SOURCE LIBRARY</span><h2>Knowledge Vault</h2><p>{notes.length} pieces of material, all still yours.</p></div><button className="gold" onClick={organize}>✦ Organize my notes</button></div><label className="searchbox">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your stories, research, reflections, and journal entries" /></label><div className="vault-list">{filtered.map(note => <article key={note.id}><div className="vault-icon">{note.kind === "Research" ? "⌘" : "✦"}</div><div><span>{note.kind} · {note.date}</span><h3>{note.title}</h3><p>{note.body}</p></div><div className="tag-stack">{note.tags.map(tag => <b key={tag}>{tag}</b>)}</div></article>)}{!filtered.length && <p className="empty-state">Nothing matched that search. Your original material remains safe in the vault.</p>}</div></section>}
      {active === "Creative Graph" && <CreativeGraphView graph={creativeGraph} signedIn={Boolean(passportUser)} onOpenSource={() => setActive("Knowledge Vault")} onVault={() => setActive("Knowledge Vault")} onPassport={() => setActive("Passport")} />}
      {active === "Book Architect" && <BookArchitectView state={bookChapters} activeIndex={Math.min(chapter, Math.max(0, bookChapters.chapters.length - 1))} onSelect={setChapter} sourceTitles={notes.map(note => note.title)} onWrite={() => setActive("Writing Studio")} onVault={() => setActive("Knowledge Vault")} />}
      {active === "Writing Studio" && <section className="view writing-view"><div className="writing-toolbar"><div><span className="eyebrow">{writingDocument?.title || "UNTITLED PROJECT"} / CHAPTER {chapter + 1}</span><h2>{chapterTitle}</h2></div><div><span className="draft-status">● Saved on this device</span><button className="ghost" onClick={saveSnapshot}>Save version</button><button className="ghost" onClick={exportDraft}>Export Markdown</button></div></div><textarea className="writer" value={draft} onChange={e => setDraft(e.target.value)} aria-label="Manuscript editor" placeholder="Start with the words you have. Dreamboard will help you protect, organize, and develop them." /><footer className="writer-footer"><span>{wordCount.toLocaleString()} words in this chapter</span><button className="text-button" onClick={() => setActive("AI Studio")}>Ask Dreamboard AI →</button></footer></section>}
      {active === "Creation Journal" && <section className="view journal-view"><div className="view-heading"><span className="eyebrow">CREATION JOURNAL</span><h2>Leave a note for your future self.</h2><p>The journal becomes private source material for your work, not a public performance.</p></div><div className="journal-card"><span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</span><textarea value={journal} onChange={e => setJournal(e.target.value)} placeholder="Today, I want to remember..." /><button className="gold" onClick={saveJournal} disabled={!journal.trim()}>Keep this note <b>→</b></button></div></section>}
      {active === "Projects" && <ProjectsView state={projects} signedIn={Boolean(passportUser)} hasDocument={Boolean(writingDocument)} onPassport={() => setActive("Passport")} onWrite={() => setActive("Writing Studio")} />}
      {active === "Creator Compass" && <CreatorCompass season={creatorSeason} setSeason={setCreatorSeason} wisdomMode={wisdomMode} setWisdomMode={setWisdomMode} onSave={() => void saveCreatorSettings()} />}
      {active === "Creative Timeline" && <Timeline notes={notes} />}
      {active === "Version History" && <VersionHistory snapshots={snapshots} onSave={saveSnapshot} onRestore={restoreSnapshot} onWrite={() => setActive("Writing Studio")} />}
      {active === "Reader" && <Reader draft={draft} chapter={chapter} title={chapterTitle} mode={readerMode} setMode={setReaderMode} scale={readerScale} setScale={setReaderScale} />}
      {active === "Audiobook Studio" && <AudiobookStudio fileName={narrationName} source={narrationUrl} inputRef={narrationInput} onFile={handleNarrationFile} />}
      {active === "Passport" && <PassportView user={passportUser} email={passportEmail} setEmail={setPassportEmail} handle={passportHandle} setHandle={setPassportHandle} status={passportStatus} message={passportMessage} onSend={() => void sendPassportMagicLink()} onSave={() => void savePassportProfile()} onSignOut={() => void signOutPassport()} notify={setNotice} />}
      {active === "AI Studio" && <AIStudioView user={passportUser} notify={setNotice} wisdomEnabled={wisdomMode} context={{ projectTitle: writingDocument?.title || null, chapterTitle, draftExcerpt: draft, sources: notes.slice(0, 3).map(note => ({ title: note.title, excerpt: note.body })) }} runs={companionRuns} onRunSaved={run => setCompanionRuns(previous => [run, ...previous].slice(0, 20))} onAppendToDraft={text => setDraft(previous => previous ? `${previous}\n\n${text}` : text)} />}
      {active === "Lounge" && <Lounge posts={posts} text={loungeText} setText={setLoungeText} onPost={postToLounge} status={communityStatus} />}
      {active === "Shop" && <Shop total={cartTotal} count={cartCount} onAdd={addToCart} items={shopProducts} status={communityStatus} />}
      {active === "Radio" && <Radio stream={radioStream} setStream={setRadioStream} playing={isPlaying} onToggle={toggleRadio} onPublish={publishRadio} audioRef={audio} status={communityStatus} />}
      {active === "Settings" && <Settings displayName={displayName} setDisplayName={setDisplayName} theme={dreamTheme} setTheme={setDreamTheme} wisdomMode={wisdomMode} setWisdomMode={setWisdomMode} creatorSeason={creatorSeason} setCreatorSeason={setCreatorSeason} signedIn={Boolean(passportUser)} onSave={() => void saveCreatorSettings()} onPassport={() => setActive("Passport")} />}
    </section>
  </main>;
}

function BulkImport({ importText, setImportText, onAddText, singleInput, onSingleFile, bulkInput, onFiles, files, label, setLabel, importing, progress, batches, signedIn, onStart, onPassport }: { importText: string; setImportText: (value: string) => void; onAddText: () => void; singleInput: RefObject<HTMLInputElement | null>; onSingleFile: (event: ChangeEvent<HTMLInputElement>) => void; bulkInput: RefObject<HTMLInputElement | null>; onFiles: (event: ChangeEvent<HTMLInputElement>) => void; files: File[]; label: string; setLabel: (value: string) => void; importing: boolean; progress: { uploaded: number; failed: number; total: number }; batches: ImportBatch[]; signedIn: boolean; onStart: () => void; onPassport: () => void }) { const totalMb = files.reduce((total, file) => total + file.size, 0) / 1024 / 1024; return <section className="view import-view"><div className="view-heading"><span className="eyebrow">PRIVATE VAULT INTAKE</span><h2>Bring the archive in without losing it.</h2><p>Dreamboard secures source files into your private vault with a batch record. Start with a smaller batch, then bring in your full archive in focused batches.</p></div><div className="bulk-import-card"><div className="bulk-head"><div><span className="eyebrow">PRIVATE BATCH IMPORT</span><h3>{files.length ? `${files.length.toLocaleString()} files staged` : "Your source library is welcome here."}</h3></div><span className={signedIn ? "import-status ready" : "import-status"}>{signedIn ? "PASSPORT CONNECTED" : "PASSPORT REQUIRED"}</span></div><label>IMPORT LABEL<input value={label} onChange={event => setLabel(event.target.value)} maxLength={180} placeholder="e.g. My book — Google Drive archive" /></label><input ref={bulkInput} type="file" multiple onChange={onFiles} hidden /><button className="bulk-drop" onClick={() => bulkInput.current?.click()}><span>⇧</span><b>{files.length ? "Choose different files" : "Choose files to secure"}</b><small>PDF, DOCX, TXT, Markdown, images, audio, and research files are preserved as originals. Individual files can be up to 50 MB.</small></button>{files.length > 0 && <div className="import-summary"><span>{totalMb.toFixed(totalMb >= 100 ? 0 : 1)} MB staged</span><span>{progress.uploaded.toLocaleString()} secured · {progress.failed.toLocaleString()} need retry</span></div>}<div className="bulk-actions"><button className="gold" onClick={onStart} disabled={!files.length || importing || !signedIn}>{importing ? `Securing ${progress.uploaded + progress.failed} of ${progress.total}…` : "Start private import"} <b>→</b></button>{!signedIn && <button className="ghost" onClick={onPassport}>Set up Passport</button>}</div><p className="import-truth">Files are private to the signed-in creator. This release preserves and records originals; text extraction, search, Google Drive consent, and AI indexing are the next processing layer.</p></div><div className="import-grid"><div className="input-card"><label>PASTE A SINGLE SOURCE<textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="A prayer, voice-note transcript, scene, research excerpt, or unfinished thought..." /></label><button className="gold wide" onClick={onAddText} disabled={!importText.trim()}>Add to local Knowledge Vault <b>→</b></button></div><div className="drop-card"><span>⇧</span><h3>Quick text import</h3><p>Plain text and Markdown can enter your current browser workspace immediately.</p><input ref={singleInput} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={onSingleFile} hidden /><button className="ghost" onClick={() => singleInput.current?.click()}>Choose a text file</button></div></div><section className="batch-history"><div className="card-head"><div><span className="eyebrow">PRIVATE IMPORT HISTORY</span><h3>Every batch has a trail.</h3></div></div>{batches.length ? <div>{batches.map(batch => <article key={batch.id}><span className={`batch-dot ${batch.status}`} /><div><b>{batch.label}</b><small>{new Date(batch.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {batch.uploaded_count.toLocaleString()}/{batch.file_count.toLocaleString()} secured</small></div><em>{batch.status}</em></article>)}</div> : <p>No private batches yet. Your first batch will appear here with its upload status.</p>}</section></section>; }


const seasonOptions: Array<[CreatorSeason, string, string]> = [["planting", "Planting", "Clarify the seed before you demand a harvest."], ["growing", "Growing", "Build a rhythm that can hold the work."], ["building", "Building", "Make the next honest structure."], ["blooming", "Blooming", "Let the finished work become visible."], ["harvest", "Harvest", "Gather what the season taught you."], ["stewardship", "Stewardship", "Protect the work and the life around it."], ["new-seeds", "New Seeds", "Notice what wants to begin again."]];

function CreatorCompass({ season, setSeason, wisdomMode, setWisdomMode, onSave }: { season: CreatorSeason; setSeason: (season: CreatorSeason) => void; wisdomMode: boolean; setWisdomMode: (value: boolean) => void; onSave: () => void }) { const current = seasonOptions.find(([value]) => value === season) || seasonOptions[0]; return <section className="view compass-view"><div className="view-heading"><span className="eyebrow">CREATOR COMPASS</span><h2>Build in the season you are actually in.</h2><p>Dreamboard does not score your life. It offers a place to name the season, protect your pace, and choose the next faithful step.</p></div><div className="compass-grid"><section className="seasons-card"><span className="eyebrow">CREATOR SEASONS</span><h3>{current[1]}</h3><p>{current[2]}</p><div className="season-map">{seasonOptions.map(([value, label]) => <button key={value} className={season === value ? "season active" : "season"} onClick={() => setSeason(value)}>{label}</button>)}</div></section><section className="wisdom-card"><span className="eyebrow">OPTIONAL WISDOM LAYER</span><h3>Keep reflection in your hands.</h3><p>When enabled, Dreamboard can frame review prompts around purpose, long-term impact, people affected, and consequences. It does not claim divine authority or make choices for you.</p><label className="toggle-row"><span><b>Wisdom reflections</b><small>{wisdomMode ? "Enabled for your next review" : "Off until you invite it in"}</small></span><input type="checkbox" checked={wisdomMode} onChange={event => setWisdomMode(event.target.checked)} /><i /></label><button className="gold" onClick={onSave}>Save compass <b>→</b></button></section></div></section>; }

function Settings({ displayName, setDisplayName, theme, setTheme, wisdomMode, setWisdomMode, creatorSeason, setCreatorSeason, signedIn, onSave, onPassport }: { displayName: string; setDisplayName: (value: string) => void; theme: DreamTheme; setTheme: (value: DreamTheme) => void; wisdomMode: boolean; setWisdomMode: (value: boolean) => void; creatorSeason: CreatorSeason; setCreatorSeason: (value: CreatorSeason) => void; signedIn: boolean; onSave: () => void; onPassport: () => void }) { return <section className="view settings-view"><div className="view-heading"><span className="eyebrow">YOUR CREATOR SPACE</span><h2>Settings that make Dreamboard feel like home.</h2><p>Your colors, reflection preferences, and creator season belong to you. Nothing here changes your work without your confirmation.</p></div><div className="settings-grid"><section className="settings-card"><span className="eyebrow">CREATOR IDENTITY</span><label>DISPLAY NAME<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="How should Dreamboard greet you?" /></label><p>{signedIn ? "This name is saved privately to your creator profile and can be used on anything you intentionally share." : "Sign in first to save a creator profile."}</p><button className="ghost" onClick={onPassport}>Manage Passport →</button></section><section className="settings-card"><span className="eyebrow">BACKGROUND COLOR</span><h3>Choose the studio atmosphere.</h3><div className="theme-picker">{([['emerald-gold', 'Emerald & Gold'], ['midnight-gold', 'Black & Gold'], ['violet-gold', 'Purple & Gold'], ['blue-gold', 'Blue & Gold']] as Array<[DreamTheme, string]>).map(([value, label]) => <button key={value} className={theme === value ? `theme-choice ${value} selected` : `theme-choice ${value}`} onClick={() => setTheme(value)}><i /><span>{label}</span></button>)}</div></section><section className="settings-card settings-reflection"><span className="eyebrow">WISDOM & SEASON</span><label className="toggle-row"><span><b>Wisdom reflections</b><small>Optional, never prescriptive</small></span><input type="checkbox" checked={wisdomMode} onChange={event => setWisdomMode(event.target.checked)} /><i /></label><label>CREATOR SEASON<select value={creatorSeason} onChange={event => setCreatorSeason(event.target.value as CreatorSeason)}>{seasonOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="gold" onClick={onSave}>{signedIn ? "Save settings" : "Sign in to save"} <b>→</b></button></section></div></section>; }

function Timeline({ notes }: { notes: Note[] }) { return <section className="view"><div className="view-heading"><span className="eyebrow">CREATIVE TIMELINE</span><h2>Moments that shaped the manuscript.</h2><p>Your source material, in the order it entered your story.</p></div><div className="timeline">{notes.map((note, index) => <article key={note.id}><i>{String(index + 1).padStart(2, "0")}</i><div><span>{note.date}</span><h3>{note.title}</h3><p>{note.body}</p></div></article>)}</div></section>; }

function VersionHistory({ snapshots, onSave, onRestore, onWrite }: { snapshots: Snapshot[]; onSave: () => void; onRestore: (snapshot: Snapshot) => void; onWrite: () => void }) { return <section className="view version-view"><div className="view-heading split"><div><span className="eyebrow">VERSION HISTORY</span><h2>Every brave edit has a way back.</h2><p>Versions are private to this device until your Passport is connected; cloud-backed project history is then saved under your account.</p></div><button className="gold" onClick={onSave}>Save a version <b>→</b></button></div>{snapshots.length ? <div className="snapshot-list">{snapshots.map(snapshot => <article key={snapshot.id}><div className="snapshot-seal">{String(snapshot.chapter + 1).padStart(2, "0")}</div><div><span>{snapshot.date} · {snapshot.words.toLocaleString()} words</span><h3>{snapshot.label}</h3><p>{snapshot.body.slice(0, 180)}{snapshot.body.length > 180 ? "…" : ""}</p></div><button className="ghost" onClick={() => onRestore(snapshot)}>Restore</button></article>)}</div> : <section className="empty-workspace"><span>◫</span><h3>Your first saved version is waiting.</h3><p>Keep writing, then choose Save version. Dreamboard will preserve up to 20 local versions while cloud history is being connected.</p><button className="gold" onClick={onWrite}>Open Writing Studio <b>→</b></button></section>}</section>; }

function Reader({ draft, chapter, title, mode, setMode, scale, setScale }: { draft: string; chapter: number; title: string; mode: "comfortable" | "night" | "paper"; setMode: (mode: "comfortable" | "night" | "paper") => void; scale: number; setScale: (value: number) => void }) { return <section className="view reader-view"><div className="reader-toolbar"><div><span className="eyebrow">DREAMBOARD READER · PREVIEW</span><h2>Your project</h2></div><div className="reader-controls"><label>TYPE SIZE<input type="range" min="15" max="25" value={scale} onChange={event => setScale(Number(event.target.value))} /></label><div>{(["comfortable", "night", "paper"] as const).map(item => <button key={item} className={mode === item ? "reader-mode selected" : "reader-mode"} onClick={() => setMode(item)}>{item}</button>)}</div></div></div><article className={`reader-page reader-${mode}`} style={{ fontSize: `${scale}px` }}><span className="reader-kicker">CHAPTER {chapter + 1}</span><h3>{title}</h3>{draft.trim() ? draft.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="reader-empty">Your writing will appear here when you begin.</p>}<footer><span>DREAMBOARD</span><b>{chapter + 1}</b></footer></article></section>; }

function AudiobookStudio({ fileName, source, inputRef, onFile }: { fileName: string; source: string; inputRef: RefObject<HTMLInputElement | null>; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) { return <section className="view audio-studio"><div className="view-heading"><span className="eyebrow">AUDIOBOOK STUDIO · FOUNDATION</span><h2>Give the manuscript a voice.</h2><p>Bring in approved human narration one chapter at a time. Dreamboard keeps this first release focused on your owned or licensed audio.</p></div><div className="audio-grid"><section className="audio-card audio-upload"><span className="audio-icon">◉</span><h3>{fileName || "Add a narration file"}</h3><p>{fileName ? "Loaded for playback in this browser session. Cloud audio storage comes with the Supabase connection." : "MP3, WAV, M4A, and OGG are ready for a first listening pass."}</p><input ref={inputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/ogg" onChange={onFile} hidden /><button className="gold" onClick={() => inputRef.current?.click()}>{fileName ? "Replace audio" : "Choose audio"} <b>→</b></button></section><section className="audio-card audio-deck"><span className="eyebrow">CHAPTER 03 · LEARNING TO LISTEN</span><h3>{fileName || "Narration deck"}</h3>{source ? <audio controls src={source} className="narration-player">Your browser does not support audio playback.</audio> : <div className="audio-empty"><i>▶</i><span>Audio appears here after you select a file.</span></div>}<div className="audio-timeline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><footer><span>Human narration only</span><span>Cloud publishing · next</span></footer></section></div></section>; }




function WowWorldSurface({ route, title, detail }: { route: "lounge" | "shop" | "radio"; title: string; detail: string }) { const url = `${wowWorldUrl}/${route}`; return <section className="wow-world-surface"><div className="wow-surface-head"><div><span className="eyebrow">LIVE WOW WORLD SURFACE</span><h3>{title}</h3><p>{detail}</p></div><a className="ghost" href={url} target="_blank" rel="noreferrer">Open full screen ↗</a></div><iframe title={title} src={url} loading="lazy" allow="autoplay; encrypted-media; clipboard-write" referrerPolicy="strict-origin-when-cross-origin" /></section>; }

function Lounge({ posts, text, setText, onPost, status }: { posts: LoungePost[]; text: string; setText: (value: string) => void; onPost: () => Promise<void>; status: CommunityStatus }) {
  const shared = status === "ready";
  return <section className="view ecosystem-view">
    <div className="view-heading"><span className="eyebrow">WOW WORLD LOUNGE</span><h2>Let the work find its people.</h2><p>Share creator updates in the World of Wealth, with every public moment intentional.</p></div>
    <WowWorldSurface route="lounge" title="WOW World Lounge" detail="This is the live Lounge experience from the WOW World app, open inside Dreamboard." />
    <div className="lounge-layout"><section className="lounge-composer"><div className="card-head"><div><span className="eyebrow">FROM YOUR CREATIVE DESK</span><h3>Post to the Lounge</h3></div><span className="live-dot">{shared ? "SHARED" : "SETUP REQUIRED"}</span></div><textarea value={text} onChange={event => setText(event.target.value)} placeholder="Share a thought, a milestone, or an invitation…" /><div><button className="gold" onClick={() => void onPost()} disabled={!text.trim()}>Share update <b>→</b></button></div><p>{shared ? "Posts are stored in the shared Lounge. A Passport is required before publishing." : "Connect Supabase and run the Dreamboard community script to publish shared Lounge posts."}</p></section><section className="lounge-feed">{posts.length ? posts.map(post => <article key={post.id}><div className="post-avatar">WOW</div><div><header><span><b>{post.author}</b><small>{post.topic} · {post.time}</small></span></header><p>{post.body}</p><footer><span>Community replies and sharing happen in the live WOW World Lounge above.</span></footer></div></article>) : <div className="empty-workspace"><span>◉</span><h3>The Lounge is waiting for its first shared post.</h3><p>Set up your Passport, then publish the thought that starts the room.</p></div>}</section></div>
  </section>;
}

function Shop({ total, count, onAdd, items, status }: { total: number; count: number; onAdd: (itemId: string) => void; items: typeof shopItems; status: CommunityStatus }) { return <section className="view ecosystem-view"><div className="view-heading split"><div><span className="eyebrow">WOW WORLD SHOP</span><h2>Build the shelf around your work.</h2><p>Publish real books, art, journals, and future releases when they are ready.</p></div><div className="cart-summary"><span>YOUR CART</span><b>{count} item{count === 1 ? "" : "s"}</b><small>${total.toFixed(2)}</small></div></div><WowWorldSurface route="shop" title="WOW World Shop" detail="This is the live Shop experience from the WOW World app, open inside Dreamboard." />{items.length ? <div className="shop-grid">{items.map((item, index) => <article className={`shop-item tone-${index + 1}`} key={item.id}><div className="shop-art"><span>WOW<br />WORLD</span></div><div><span>{item.kind}</span><h3>{item.name}</h3><p>{item.note}</p><footer><b>${item.price.toFixed(2)}</b><button className="cart-button" onClick={() => onAdd(item.id)}>Add to cart +</button></footer></div></article>)}</div> : <section className="empty-workspace"><span>◫</span><h3>Your catalog is ready for real work.</h3><p>No sample products are shown here. Add your own product records when they are ready to publish.</p></section>}<div className="shop-connection"><span>{status === "ready" ? "SHARED CATALOG · CHECKOUT NEXT" : "PAYMENTS ARE NOT CONNECTED"}</span><p>{status === "ready" ? "The catalog comes from Dreamboard’s shared database. The cart works on this device; secure checkout needs the payment account you choose." : "Secure checkout comes next, after you decide which payment provider and account Dreamboard should use."}</p></div></section>; }

function Radio({ stream, setStream, playing, onToggle, onPublish, audioRef, status }: { stream: string; setStream: (value: string) => void; playing: boolean; onToggle: () => void; onPublish: () => Promise<void>; audioRef: RefObject<HTMLAudioElement | null>; status: CommunityStatus }) { return <section className="view ecosystem-view radio-view"><div className="view-heading"><span className="eyebrow">WOW WORLD RADIO</span><h2>A home for the sound behind the work.</h2><p>The live WOW Radio player from the WOW World app is here inside Dreamboard. The control room below lets you publish the shared station you own.</p></div><WowWorldSurface route="radio" title="WOW Radio" detail="This is the live music player from the WOW World app, open inside Dreamboard." /><div className="radio-console"><div className="radio-record"><i /></div><div className="radio-main"><div className="live-label">{playing ? "● LIVE NOW" : status === "ready" ? "○ SHARED STATION READY" : "○ STATION SETUP"}</div><h3>WOW Radio control room</h3><p>{stream ? "Your connected station is ready to play." : "No stream connected yet — add your station URL below."}</p><div className="wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><button className="radio-play" onClick={onToggle} aria-label={playing ? "Pause WOW Radio" : "Play WOW Radio"}>{playing ? "Ⅱ" : "▶"}</button><audio ref={audioRef} src={stream || undefined} /></div><div className="radio-connect"><span className="eyebrow">STATION CONNECTION</span><label>LICENSED STREAM URL<input value={stream} onChange={event => setStream(event.target.value)} placeholder="https://your-radio-stream…" /></label><p>This is a real audio player. Use only a stream you own or are licensed to broadcast.</p><button className="gold" onClick={() => void onPublish()}>Publish WOW Radio <b>→</b></button><button className="ghost" onClick={() => setStream("")}>Clear station</button></div></div></section>; }
