"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import type { Chapter } from "./book-architect";

type Narration = { id: string; chapter_id: string | null; title: string; storage_path: string; mime_type: string; byte_size: number; pronunciation_notes: string; created_at: string };
const COLUMNS = "id,chapter_id,title,storage_path,mime_type,byte_size,pronunciation_notes,created_at";

export function AudiobookView({ user, notify, chapters }: { user: User | null; notify: (message: string) => void; chapters: Chapter[] }) {
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [loadState, setLoadState] = useState<"local" | "loading" | "ready" | "needs-setup">("local");
  const [uploading, setUploading] = useState(false);
  const [chapterId, setChapterId] = useState<string>("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [localName, setLocalName] = useState("");
  const [localUrl, setLocalUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setLoadState("local"); return; }
      setLoadState("loading");
      const { data, error } = await supabase.from("dreamboard_audio_narrations").select(COLUMNS).order("created_at", { ascending: false }).limit(100);
      if (error) { setLoadState("needs-setup"); return; }
      setNarrations((data || []) as Narration[]);
      setLoadState("ready");
    };
    void load();
  }, [user]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || loadState !== "ready") {
      setLocalName(file.name);
      setLocalUrl(URL.createObjectURL(file));
      notify(`${file.name} is loaded for this browser session only. ${user ? "Run the audiobook script to enable private cloud narration storage." : "Sign in with your Passport to store narration privately in the cloud."}`);
      return;
    }
    setUploading(true);
    const path = `${user.id}/narrations/${Date.now()}-${file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    const { error: storageError } = await supabase.storage.from("dreamboard-private").upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
    if (storageError) { setUploading(false); notify("The narration could not be stored. Please try again."); return; }
    const { data, error } = await supabase.from("dreamboard_audio_narrations").insert({ owner_id: user.id, chapter_id: chapterId || null, title: file.name.slice(0, 200), storage_path: path, mime_type: file.type || "audio/mpeg", byte_size: file.size }).select(COLUMNS).single();
    setUploading(false);
    if (error || !data) { notify("The audio uploaded but its record could not be saved. Please try again."); return; }
    setNarrations(previous => [data as Narration, ...previous]);
    notify(`${file.name} is stored privately${chapterId ? " and linked to its chapter" : ""}.`);
  };

  const play = async (narration: Narration) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !audioRef.current) return;
    const { data, error } = await supabase.storage.from("dreamboard-private").createSignedUrl(narration.storage_path, 3600);
    if (error || !data?.signedUrl) { notify("This narration could not be opened right now. Please try again."); return; }
    audioRef.current.src = data.signedUrl;
    void audioRef.current.play();
    setPlayingId(narration.id);
  };

  const saveNotes = async (narration: Narration, notes: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_audio_narrations").update({ pronunciation_notes: notes.slice(0, 4000), updated_at: new Date().toISOString() }).eq("id", narration.id);
    if (error) { notify("Pronunciation notes could not save. Please try again."); return; }
    setNarrations(previous => previous.map(item => item.id === narration.id ? { ...item, pronunciation_notes: notes } : item));
    notify("Pronunciation notes saved with this narration.");
  };

  const remove = async (narration: Narration) => {
    if (!window.confirm(`Delete the narration “${narration.title}”? The audio file is removed from your private storage.`)) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    await supabase.storage.from("dreamboard-private").remove([narration.storage_path]);
    const { error } = await supabase.from("dreamboard_audio_narrations").delete().eq("id", narration.id);
    if (error) { notify("The narration record could not be deleted. Please try again."); return; }
    setNarrations(previous => previous.filter(item => item.id !== narration.id));
    notify("The narration was deleted from your private storage.");
  };

  const chapterTitle = (id: string | null) => chapters.find(chapter => chapter.id === id)?.title || null;

  return <section className="view audio-studio">
    <div className="view-heading"><span className="eyebrow">AUDIOBOOK STUDIO · HUMAN NARRATION FIRST</span><h2>Give the manuscript a voice.</h2><p>Bring in your owned or licensed narration chapter by chapter. Recordings are stored privately under your Passport; nothing is generated for you.</p></div>
    {loadState === "needs-setup" && <div className="connection-note"><b>Narration storage setup needed:</b><span>Run supabase/dreamboard-audiobook.sql in your Supabase project to keep narrations in your private cloud. Until then, audio plays for this session only.</span></div>}
    <div className="audio-grid">
      <section className="audio-card audio-upload">
        <span className="audio-icon">◉</span>
        <h3>Add a narration file</h3>
        <p>MP3, WAV, M4A, and OGG. {loadState === "ready" ? "Stored privately and linked to a chapter if you choose one." : "Stored for this browser session until cloud narration storage is connected."}</p>
        {chapters.length > 0 && loadState === "ready" && <label className="vision-status">LINK TO CHAPTER<select value={chapterId} onChange={event => setChapterId(event.target.value)}><option value="">No chapter link</option>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>}
        <input ref={fileInput} type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/ogg" onChange={event => void onFile(event)} hidden />
        <button className="gold" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? "Storing…" : "Choose audio"} <b>→</b></button>
        <div className="connection-note"><b>Voice generation is not connected:</b><span>Dreamboard will only offer generated narration after you connect a text-to-speech provider — it will never simulate one.</span></div>
      </section>
      <section className="audio-card audio-deck">
        <span className="eyebrow">{loadState === "ready" ? `YOUR NARRATIONS · ${narrations.length}` : "SESSION PLAYBACK"}</span>
        <audio ref={audioRef} controls className="narration-player" src={localUrl || undefined}>Your browser does not support audio playback.</audio>
        {loadState === "ready" ? <div className="narration-list">{narrations.map(narration => <article key={narration.id}><div><b>{narration.title}</b><small>{chapterTitle(narration.chapter_id) ? `Chapter: ${chapterTitle(narration.chapter_id)}` : "No chapter link"} · {(narration.byte_size / 1024 / 1024).toFixed(1)} MB{playingId === narration.id ? " · playing" : ""}</small><textarea defaultValue={narration.pronunciation_notes} placeholder="Pronunciation notes for this narration…" onBlur={event => { if (event.target.value !== narration.pronunciation_notes) void saveNotes(narration, event.target.value); }} aria-label={`Pronunciation notes for ${narration.title}`} /></div><div className="vision-actions"><button className="ghost" onClick={() => void play(narration)}>Play</button><button className="ghost" onClick={() => void remove(narration)}>Delete</button></div></article>)}{!narrations.length && <p className="empty-state">No narrations stored yet. Your first upload appears here with its chapter link and notes.</p>}</div> : <p className="empty-state">{localName ? `${localName} is loaded above for this session.` : "Choose an audio file to listen in this session."}</p>}
      </section>
    </div>
  </section>;
}
