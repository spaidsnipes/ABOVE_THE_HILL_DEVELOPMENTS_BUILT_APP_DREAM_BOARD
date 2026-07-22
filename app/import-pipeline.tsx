"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export type SourceDocument = { id: string; batch_id: string; file_name: string; mime_type: string; storage_path: string; byte_size: number; extraction_status: string; extracted_chars: number | null; extraction_error: string | null };

const DOCUMENT_COLUMNS = "id,batch_id,file_name,mime_type,storage_path,byte_size,extraction_status,extracted_chars,extraction_error";
const VAULT_CONTENT_CAP = 100_000;

function extension(name: string): string { return (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [, ""])[1] as string; }

// Supported today: plain text, Markdown, and DOCX (unzipped in the browser).
// PDFs and images are recorded as `unsupported` with an honest reason — no
// pretend extraction, no OCR yet. (ADR-0005)
function supportKind(name: string, mime: string): "text" | "docx" | "unsupported" {
  const ext = extension(name);
  if (["txt", "md", "markdown", "text", "csv", "json", "html", "htm"].includes(ext) || mime.startsWith("text/")) return "text";
  if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return "unsupported";
}

function unsupportedReason(name: string): string {
  const ext = extension(name);
  if (ext === "pdf") return "PDF text extraction is not built yet — the original is preserved and will be processed when PDF support ships.";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "Images need OCR, which Dreamboard does not do yet. The original is preserved.";
  if (["mp3", "wav", "m4a", "ogg", "mp4", "mov"].includes(ext)) return "Audio/video transcription is not built yet. The original is preserved.";
  if (ext === "doc") return "Legacy .doc is not supported — save it as .docx and re-import for extraction.";
  return "This file type has no text extractor yet. The original is preserved.";
}

async function extractDocx(blob: Blob): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(blob);
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) throw new Error("word/document.xml missing — not a valid DOCX file");
  const xml = await documentXml.async("string");
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type PipelineProgress = { running: boolean; batchId: string | null; done: number; total: number; current: string };
export type ImportPipelineState = {
  ready: boolean | null;
  progress: PipelineProgress;
  documents: Record<string, SourceDocument[]>;
  loadDocuments: (batchId: string) => Promise<void>;
  processBatch: (batchId: string) => Promise<void>;
};

export function useImportPipeline(user: User | null, notify: (message: string) => void): ImportPipelineState {
  const [ready, setReady] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<PipelineProgress>({ running: false, batchId: null, done: 0, total: 0, current: "" });
  const [documents, setDocuments] = useState<Record<string, SourceDocument[]>>({});

  const loadDocuments = async (batchId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { data, error } = await supabase.from("dreamboard_source_documents").select(DOCUMENT_COLUMNS).eq("batch_id", batchId).order("file_name").limit(500);
    if (error) { setReady(false); return; }
    setReady(true);
    setDocuments(previous => ({ ...previous, [batchId]: (data || []) as SourceDocument[] }));
  };

  const updateDocument = (batchId: string, id: string, patch: Partial<SourceDocument>) =>
    setDocuments(previous => ({ ...previous, [batchId]: (previous[batchId] || []).map(doc => doc.id === id ? { ...doc, ...patch } : doc) }));

  const processBatch = async (batchId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || progress.running) return;
    const { data, error } = await supabase.from("dreamboard_source_documents").select(DOCUMENT_COLUMNS).eq("batch_id", batchId).in("extraction_status", ["uploaded", "queued", "failed"]).order("file_name").limit(500);
    if (error) { setReady(false); notify("Run supabase/dreamboard-import-extraction.sql first — the extraction columns are not in your database yet."); return; }
    const pending = (data || []) as SourceDocument[];
    if (!pending.length) { notify("Nothing to extract in this batch — every file is already processed or unsupported."); await loadDocuments(batchId); return; }
    setProgress({ running: true, batchId, done: 0, total: pending.length, current: "" });
    let processed = 0, failed = 0, unsupported = 0;
    for (const [index, doc] of pending.entries()) {
      setProgress({ running: true, batchId, done: index, total: pending.length, current: doc.file_name });
      const kind = supportKind(doc.file_name, doc.mime_type);
      if (kind === "unsupported") {
        const reason = unsupportedReason(doc.file_name);
        await supabase.from("dreamboard_source_documents").update({ extraction_status: "unsupported", extraction_error: reason }).eq("id", doc.id);
        updateDocument(batchId, doc.id, { extraction_status: "unsupported", extraction_error: reason });
        unsupported += 1;
        continue;
      }
      try {
        await supabase.from("dreamboard_source_documents").update({ extraction_status: "processing" }).eq("id", doc.id);
        const { data: blob, error: downloadError } = await supabase.storage.from("dreamboard-private").download(doc.storage_path);
        if (downloadError || !blob) throw new Error("The original could not be downloaded from private storage.");
        const text = kind === "docx" ? await extractDocx(blob) : (await blob.text()).trim();
        if (!text) throw new Error("The file downloaded but contained no extractable text.");
        const now = new Date().toISOString();
        const { error: saveError } = await supabase.from("dreamboard_source_documents").update({ extraction_status: "processed", extracted_text: text.slice(0, 2_000_000), extracted_chars: text.length, extraction_error: null, extracted_at: now }).eq("id", doc.id);
        if (saveError) throw new Error("Extracted text could not be saved.");
        // One Knowledge Vault entry per source document (unique index dedupes retries).
        const { error: vaultError } = await supabase.from("dreamboard_vault_entries").insert({ owner_id: user.id, title: doc.file_name.slice(0, 240), content: text.slice(0, VAULT_CONTENT_CAP), source_type: "import", tags: ["Imported"], source_document_id: doc.id });
        if (!vaultError) await supabase.from("dreamboard_graph_nodes").insert({ owner_id: user.id, node_type: "source", label: doc.file_name.slice(0, 160), description: text.slice(0, 360) });
        updateDocument(batchId, doc.id, { extraction_status: "processed", extracted_chars: text.length, extraction_error: null });
        processed += 1;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Extraction failed for an unknown reason.";
        await supabase.from("dreamboard_source_documents").update({ extraction_status: "failed", extraction_error: message }).eq("id", doc.id);
        updateDocument(batchId, doc.id, { extraction_status: "failed", extraction_error: message });
        failed += 1;
      }
    }
    setProgress({ running: false, batchId: null, done: pending.length, total: pending.length, current: "" });
    await loadDocuments(batchId);
    notify(`Extraction finished: ${processed} processed${failed ? `, ${failed} failed (retry available)` : ""}${unsupported ? `, ${unsupported} unsupported` : ""}. Processed text is now in your Knowledge Vault and searchable.`);
  };

  return { ready, progress, documents, loadDocuments, processBatch };
}

export function ImportProcessingPanel({ pipeline, batches, signedIn }: { pipeline: ImportPipelineState; batches: Array<{ id: string; label: string; status: string; file_count: number }>; signedIn: boolean }) {
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  if (!signedIn || !batches.length) return null;
  return <section className="batch-history import-processing">
    <div className="card-head"><div><span className="eyebrow">TEXT EXTRACTION · TXT, MARKDOWN, DOCX</span><h3>Turn preserved files into searchable material.</h3></div></div>
    {pipeline.ready === false && <div className="connection-note"><b>Extraction setup needed:</b><span>Run supabase/dreamboard-import-extraction.sql in your Supabase project to enable text extraction on imported files.</span></div>}
    <p className="import-truth">Extraction runs in your browser on your own files: originals stay untouched in private storage, extracted text becomes a Knowledge Vault entry with a link back to its source file. PDFs and images are honestly marked unsupported until their extractors ship.</p>
    <div className="processing-batches">
      {batches.map(batch => { const docs = pipeline.documents[batch.id] || []; const isOpen = openBatch === batch.id; const active = pipeline.progress.running && pipeline.progress.batchId === batch.id; return <article key={batch.id} className="processing-batch">
        <div className="processing-batch-head"><div><b>{batch.label}</b><small>{batch.file_count.toLocaleString()} file{batch.file_count === 1 ? "" : "s"} preserved</small></div><div className="vision-actions"><button className="ghost" onClick={() => { setOpenBatch(isOpen ? null : batch.id); if (!isOpen) void pipeline.loadDocuments(batch.id); }}>{isOpen ? "Hide files" : "Show files"}</button><button className="gold" onClick={() => void pipeline.processBatch(batch.id)} disabled={pipeline.progress.running}>{active ? `Extracting ${pipeline.progress.done + 1}/${pipeline.progress.total}…` : "Extract text"} <b>→</b></button></div></div>
        {active && pipeline.progress.current && <p className="processing-current">Working on {pipeline.progress.current}</p>}
        {isOpen && <div className="processing-files">{docs.length ? docs.map(doc => <div key={doc.id} className="processing-file"><span className={`batch-dot ${doc.extraction_status === "processed" ? "uploaded" : doc.extraction_status === "failed" ? "failed" : "partial"}`} /><div><b>{doc.file_name}</b><small>{doc.extraction_status.replace(/_/g, " ")}{typeof doc.extracted_chars === "number" ? ` · ${doc.extracted_chars.toLocaleString()} characters` : ""}{doc.extraction_error ? ` — ${doc.extraction_error}` : ""}</small></div></div>) : <p className="empty-state">Loading file records…</p>}</div>}
      </article>; })}
    </div>
  </section>;
}
