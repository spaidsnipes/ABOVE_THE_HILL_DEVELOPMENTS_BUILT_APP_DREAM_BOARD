# ADR-0008: Book Studio is local-first, organizes (never ghostwrites)

Date: 2026-11-12 · Status: accepted

## Context
Authors like the Founder hold decades of writing (single threads past 1.3M words, 10–12 of them).
Editors cost $30–40K. Dream Board must organize that writing into a book without writing it for them,
on IONOS static hosting (no server code) with Supabase as the only backend.

## Decision
- `board/book-*.js`: static, lazy-loaded from `app.js` on `#/book`. Parsing, passage splitting, themes
  (TF-IDF + spherical k-means), repeats (exact + MinHash LSH) and idea seeds run in a Web Worker
  (`book-worker.js`) using the shared pure engine `book-engine.js` (also unit-tested in Node).
- Local-first: every row lives in IndexedDB with a client UUID, then an outbox upserts to Supabase
  (`supabase/dreamboard-book-studio.sql`, owner-only RLS, parent-ownership trigger). Re-queued rows are
  versioned so an edit made during a push is never dropped.
- Tier in the database: basic Passport saves 1 book to the Passport; extra books stay on the device.
- Chat exports keep only the author's messages by default; AI replies can be kept as research, labelled
  "not your words", and never enter themes or the manuscript.
- "Studio Assist" is on-device: extractive key sentences (the author's own) and fixed question/prompt
  templates filled with the author's terms. No generative model writes prose.
- Export (.docx via a store-only zip writer, Markdown) contains only passages the author placed.

## Consequences
Measured 2026-11-12: 1.85M words / 23,946 passages imported and sorted in 4.4 s in Chrome, longest frame
gap 100 ms, reopen from IndexedDB 1.4 s. A generative assist can be added later behind an explicit button.
