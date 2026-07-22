# ADR-0005: Import text extraction runs in the browser

Date: 2026-07-22 · Status: Accepted

## Context

Imported originals live in the private Supabase storage bucket, readable only
by their owner via RLS-scoped credentials. The deployed stack (vinext worker
on Vercel) has no background-job runner, and shipping files through a server
route would add a second trust surface for private material.

## Decision

Extraction runs client-side in the signed-in creator's browser: download the
original with the user's own session, extract text (txt/md via Blob.text(),
DOCX via dynamically-imported jszip + document.xml strip), write results to
`dreamboard_source_documents` (status, text, chars, error, timestamp), and
create exactly one Knowledge Vault entry per source document (unique index
dedupes retries). PDFs, images, audio, and legacy .doc are marked
`unsupported` with a specific honest reason — never fake-processed. jszip
loads lazily so it costs nothing until a DOCX is processed.

## Consequences

- Zero server infrastructure; private files never transit our own server.
- Extraction only happens while the creator has the tab open — acceptable at
  current batch sizes; a queued server/worker pipeline is the upgrade path if
  batches grow beyond what a browser session tolerates.
- PDF support requires bundling a PDF text engine later (pdfjs or a server
  route) and gets its own decision when it ships.
