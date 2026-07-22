"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export type SearchDomain = "vision" | "knowledge" | "projects" | "writing" | "chapters" | "graph";
export type SearchTarget = "Vision Vault" | "Knowledge Vault" | "Projects" | "Writing Studio" | "Book Architect" | "Creative Graph";
export type SearchResult = { id: string; domain: SearchDomain; title: string; excerpt: string; updated: string | null; target: SearchTarget; local: boolean };

const DOMAINS: Array<[SearchDomain, string, SearchTarget]> = [
  ["vision", "Vision Vault", "Vision Vault"],
  ["knowledge", "Knowledge Vault", "Knowledge Vault"],
  ["projects", "Projects", "Projects"],
  ["writing", "Writing", "Writing Studio"],
  ["chapters", "Chapters", "Book Architect"],
  ["graph", "Graph nodes", "Creative Graph"],
];
const targetFor = (domain: SearchDomain): SearchTarget => DOMAINS.find(([value]) => value === domain)![2];

function excerpt(text: string, query: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  const index = clean.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return clean.slice(0, 150) + (clean.length > 150 ? "…" : "");
  const start = Math.max(0, index - 60);
  return (start > 0 ? "…" : "") + clean.slice(start, index + query.length + 90) + (index + query.length + 90 < clean.length ? "…" : "");
}

// Keyword search only — honestly labeled. The per-domain queries are scoped
// by RLS to the signed-in creator; local mode searches this device's stores.
async function searchCloud(user: User, query: string, domains: Set<SearchDomain>): Promise<SearchResult[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const pattern = `%${query.replace(/[%_,()]/g, " ").trim()}%`;
  const tasks: Array<Promise<SearchResult[]>> = [];
  const run = (domain: SearchDomain, table: string, titleColumn: string, bodyColumn: string, updatedColumn: string | null) => {
    if (!domains.has(domain)) return;
    tasks.push((async () => {
      const columns = `id,${titleColumn}${bodyColumn ? `,${bodyColumn}` : ""}${updatedColumn ? `,${updatedColumn}` : ""}`;
      const orFilter = bodyColumn ? `${titleColumn}.ilike.${pattern},${bodyColumn}.ilike.${pattern}` : `${titleColumn}.ilike.${pattern}`;
      const { data, error } = await supabase.from(table).select(columns).or(orFilter).limit(25);
      if (error || !data) return [];
      return (data as unknown as Array<Record<string, string | null>>).map(row => ({
        id: `${domain}-${row.id}`,
        domain,
        title: (row[titleColumn] as string) || "Untitled",
        excerpt: excerpt((row[bodyColumn] as string) || "", query),
        updated: updatedColumn ? (row[updatedColumn] as string | null) : null,
        target: targetFor(domain),
        local: false,
      }));
    })());
  };
  run("vision", "dreamboard_vision_entries", "title", "content", "updated_at");
  run("knowledge", "dreamboard_vault_entries", "title", "content", "updated_at");
  run("projects", "dreamboard_projects", "title", "description", "updated_at");
  run("writing", "dreamboard_writing_documents", "title", "body", "updated_at");
  run("chapters", "dreamboard_chapters", "title", "notes", "updated_at");
  run("graph", "dreamboard_graph_nodes", "label", "description", "updated_at");
  const settled = await Promise.all(tasks);
  return settled.flat();
}

function searchLocal(query: string, domains: Set<SearchDomain>): SearchResult[] {
  if (typeof window === "undefined") return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  const read = <T,>(key: string): T[] => { try { return JSON.parse(window.localStorage.getItem(key) || "[]") as T[]; } catch { return []; } };
  if (domains.has("vision")) for (const entry of read<{ id: string; title: string; content: string; updated_at: string }>("dreamboard-vision-entries")) {
    if (`${entry.title} ${entry.content}`.toLowerCase().includes(q)) results.push({ id: `vision-${entry.id}`, domain: "vision", title: entry.title, excerpt: excerpt(entry.content, query), updated: entry.updated_at, target: "Vision Vault", local: true });
  }
  if (domains.has("knowledge")) for (const note of read<{ id: number; title: string; body: string; date: string }>("dreamboard-notes-v2")) {
    if (`${note.title} ${note.body}`.toLowerCase().includes(q)) results.push({ id: `knowledge-${note.id}`, domain: "knowledge", title: note.title, excerpt: excerpt(note.body, query), updated: null, target: "Knowledge Vault", local: true });
  }
  if (domains.has("chapters")) for (const chapter of read<{ id: string; title: string; purpose: string; notes: string }>("dreamboard-chapters")) {
    if (`${chapter.title} ${chapter.purpose} ${chapter.notes}`.toLowerCase().includes(q)) results.push({ id: `chapters-${chapter.id}`, domain: "chapters", title: chapter.title, excerpt: excerpt(`${chapter.purpose} ${chapter.notes}`, query), updated: null, target: "Book Architect", local: true });
  }
  if (domains.has("writing")) { try { const draft = JSON.parse(window.localStorage.getItem("dreamboard-draft-v2") || '""') as string; if (draft.toLowerCase().includes(q)) results.push({ id: "writing-draft", domain: "writing", title: "Current draft", excerpt: excerpt(draft, query), updated: null, target: "Writing Studio", local: true }); } catch { /* draft stays searchable next time */ } }
  return results;
}

export function SearchView({ user, onGo }: { user: User | null; onGo: (target: SearchTarget) => void }) {
  const [query, setQuery] = useState("");
  const [domains, setDomains] = useState<Set<SearchDomain>>(new Set(DOMAINS.map(([value]) => value)));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "searching" | "done">("idle");
  const [lastQuery, setLastQuery] = useState("");

  const toggleDomain = (domain: SearchDomain) => setDomains(previous => { const next = new Set(previous); if (next.has(domain)) { if (next.size > 1) next.delete(domain); } else next.add(domain); return next; });

  const runSearch = async () => {
    const clean = query.trim();
    if (clean.length < 2) return;
    setState("searching");
    setLastQuery(clean);
    const found = user ? await searchCloud(user, clean, domains) : searchLocal(clean, domains);
    found.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
    setResults(found);
    setState("done");
  };

  return <section className="view search-view">
    <div className="view-heading"><span className="eyebrow">UNIVERSAL SEARCH · KEYWORD, PRIVATE TO YOU</span><h2>Find it anywhere in your work.</h2><p>Keyword search across your vaults, projects, chapters, writing, and graph — scoped to your Passport. Semantic search comes later and will be labeled as such.</p></div>
    <div className="searchbar-row"><label className="searchbox">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search everything you've saved (2+ characters)" onKeyDown={event => { if (event.key === "Enter") void runSearch(); }} aria-label="Search query" /></label><button className="gold" onClick={() => void runSearch()} disabled={query.trim().length < 2 || state === "searching"}>{state === "searching" ? "Searching…" : "Search"} <b>→</b></button></div>
    <div className="vision-filters" role="group" aria-label="Search domains">{DOMAINS.map(([value, label]) => <button key={value} className={domains.has(value) ? "season active" : "season"} onClick={() => toggleDomain(value)} aria-pressed={domains.has(value)}>{label}</button>)}</div>
    {!user && <div className="connection-note"><b>Searching this device:</b><span>You are signed out, so search covers material stored in this browser. Sign in with your Passport to search your cloud workspace.</span></div>}
    <div className="search-results">
      {state === "done" && <p className="search-count">{results.length ? `${results.length} match${results.length === 1 ? "" : "es"} for “${lastQuery}”` : `Nothing matched “${lastQuery}” in the selected areas. Your material is unchanged — try another word.`}</p>}
      {results.map(result => <article key={result.id} className="search-result"><div className="vault-icon">{result.domain === "vision" ? "✧" : result.domain === "graph" ? "⌬" : result.domain === "projects" ? "▦" : result.domain === "chapters" ? "✦" : result.domain === "writing" ? "✎" : "⌕"}</div><div><span>{DOMAINS.find(([value]) => value === result.domain)?.[1]}{result.local ? " · on this device" : ""}{result.updated ? ` · ${new Date(result.updated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</span><h3>{result.title}</h3>{result.excerpt && <p>{result.excerpt}</p>}</div><button className="ghost" onClick={() => onGo(result.target)}>Open</button></article>)}
      {state === "idle" && <p className="empty-state">Search opens your own material only — nothing is fetched from the web, and nothing is indexed until you save it.</p>}
    </div>
  </section>;
}
