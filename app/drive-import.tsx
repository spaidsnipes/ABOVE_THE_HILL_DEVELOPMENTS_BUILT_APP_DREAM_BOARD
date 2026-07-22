"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type DriveFile = { id: string; name: string; mimeType: string; size?: string };
type PanelState = "checking" | "needs-config" | "disconnected" | "connected" | "error";

function storageSafeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-file";
}

function exportedName(file: DriveFile): string {
  if (file.mimeType === "application/vnd.google-apps.document") return `${file.name}.txt`;
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") return `${file.name}.csv`;
  if (file.mimeType === "application/vnd.google-apps.presentation") return `${file.name}.txt`;
  return file.name;
}

export function DriveImportPanel({ user, notify, onImported }: { user: User | null; notify: (message: string) => void; onImported: () => void }) {
  const [state, setState] = useState<PanelState>("checking");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const loadFiles = async (query = "") => {
    try {
      const response = await fetch(`/api/drive/files${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      if (response.status === 503) { setState("needs-config"); return; }
      if (response.status === 401) { setState("disconnected"); return; }
      if (!response.ok) { setState("error"); return; }
      const data = await response.json() as { files: DriveFile[] };
      setFiles(data.files || []);
      setState("connected");
    } catch { setState("error"); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const flag = new URLSearchParams(window.location.search).get("drive");
      if (flag === "connected") notify("Google Drive is connected for this session. Choose the files to secure into your private vault.");
      if (flag === "error") notify("Google Drive connection was cancelled or failed. Nothing was imported.");
      if (flag) window.history.replaceState(null, "", window.location.pathname);
      void loadFiles();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const importSelected = async () => {
    const supabase = getSupabaseBrowserClient();
    const chosen = files.filter(file => selected.has(file.id));
    if (!supabase || !user || !chosen.length || importing) return;
    setImporting(true);
    setProgress({ done: 0, total: chosen.length });
    const { data: batch, error: batchError } = await supabase.from("dreamboard_import_batches").insert({ owner_id: user.id, source: "google-drive", label: `Google Drive — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, file_count: chosen.length, total_bytes: chosen.reduce((total, file) => total + Number(file.size || 0), 0) }).select("id").single();
    if (batchError || !batch) { setImporting(false); notify("Dreamboard could not open a private import batch. Please try again."); return; }
    let uploaded = 0, failed = 0;
    for (const [index, file] of chosen.entries()) {
      try {
        const response = await fetch(`/api/drive/file?id=${file.id}&mimeType=${encodeURIComponent(file.mimeType)}`);
        if (!response.ok) throw new Error("download failed");
        const blob = await response.blob();
        const name = exportedName(file);
        const path = `${user.id}/${batch.id}/${String(index + 1).padStart(5, "0")}-${storageSafeName(name)}`;
        const { error: storageError } = await supabase.storage.from("dreamboard-private").upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
        if (storageError) throw new Error("storage failed");
        const { error: rowError } = await supabase.from("dreamboard_source_documents").insert({ owner_id: user.id, batch_id: batch.id, file_name: name, mime_type: blob.type || "application/octet-stream", storage_path: path, byte_size: blob.size, source: "google-drive" });
        if (rowError) throw new Error("record failed");
        uploaded += 1;
      } catch { failed += 1; }
      setProgress({ done: index + 1, total: chosen.length });
    }
    await supabase.from("dreamboard_import_batches").update({ status: failed ? (uploaded ? "partial" : "failed") : "uploaded", uploaded_count: uploaded, failed_count: failed, updated_at: new Date().toISOString() }).eq("id", batch.id);
    setImporting(false);
    setSelected(new Set());
    onImported();
    notify(failed ? `${uploaded} Drive file${uploaded === 1 ? "" : "s"} secured; ${failed} failed and can be retried from Drive.` : `${uploaded} Drive file${uploaded === 1 ? "" : "s"} secured in your private vault. Run text extraction below to make them searchable.`);
  };

  if (!user) return null;
  return <section className="batch-history drive-import">
    <div className="card-head"><div><span className="eyebrow">GOOGLE DRIVE · READ-ONLY CONNECTOR</span><h3>Bring your Drive archive home.</h3></div>{state === "connected" && <button className="ghost" onClick={() => void loadFiles(search)}>Refresh</button>}</div>
    {state === "checking" && <p className="empty-state">Checking the Google Drive connection…</p>}
    {state === "needs-config" && <div className="connection-note"><b>Connector built — Google credentials needed:</b><span>Create an OAuth client (type “Web application”) in Google Cloud Console with the redirect URI <em>https://YOUR-DOMAIN/api/drive/callback</em> and the read-only scope <em>drive.readonly</em>. Then set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REDIRECT_URI in Vercel. Nothing is simulated until then.</span></div>}
    {state === "disconnected" && <><p className="import-truth">Dreamboard asks Google for read-only access and keeps the session token only in a secure browser cookie — never in its database. Access expires on its own within the hour.</p><button className="gold" onClick={() => { window.location.href = "/api/drive/auth"; }}>Connect Google Drive <b>→</b></button></>}
    {state === "error" && <p className="empty-state">Google Drive could not be reached just now. Your vault is unchanged — try again shortly.</p>}
    {state === "connected" && <>
      <div className="searchbar-row"><label className="searchbox">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your Drive files" onKeyDown={event => { if (event.key === "Enter") void loadFiles(search); }} /></label><button className="ghost" onClick={() => void loadFiles(search)}>Search Drive</button></div>
      <div className="drive-files">{files.map(file => <label key={file.id} className="drive-file"><input type="checkbox" checked={selected.has(file.id)} onChange={() => toggle(file.id)} /><div><b>{file.name}</b><small>{file.mimeType.replace("application/vnd.google-apps.", "Google ")}{file.size ? ` · ${(Number(file.size) / 1024 / 1024).toFixed(1)} MB` : ""}</small></div></label>)}{!files.length && <p className="empty-state">No files matched in your Drive. Nothing is imported without your selection.</p>}</div>
      <div className="vision-actions"><button className="gold" onClick={() => void importSelected()} disabled={!selected.size || importing}>{importing ? `Securing ${progress.done}/${progress.total}…` : `Import ${selected.size || ""} selected`.trim() + " "} <b>→</b></button><span className="import-truth">Selected files are copied into your private Dreamboard vault; your Drive stays untouched.</span></div>
    </>}
  </section>;
}
