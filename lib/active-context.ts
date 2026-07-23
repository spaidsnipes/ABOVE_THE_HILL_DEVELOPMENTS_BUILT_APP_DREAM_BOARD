"use client";

import { useEffect, useState } from "react";

// The active-context set: which projects are "in focus" right now. Views can
// filter to this set, and new captures are stamped with the primary project.
// Default is empty = no filter = today's global behavior (safe fallback).
// Capped so a creator's private books, inventions, and journals never blend
// automatically — cross-project context is always an explicit choice.
const KEY = "dreamboard-active-context";
export const MAX_ACTIVE = 7;

type Stored = { ids: string[]; primary: string | null };

export type ActiveContext = {
  activeIds: string[];
  primaryId: string | null;
  filtersOn: boolean;
  /** True when a project row belongs to the active set (or no filter is set). */
  includes: (projectId: string | null | undefined) => boolean;
  toggle: (projectId: string) => void;
  setPrimary: (projectId: string | null) => void;
  clear: () => void;
};

export function useActiveContext(): ActiveContext {
  const [ids, setIds] = useState<string[]>([]);
  const [primary, setPrimaryState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(KEY) || "null") as Stored | null;
        if (stored) { setIds(Array.isArray(stored.ids) ? stored.ids.slice(0, MAX_ACTIVE) : []); setPrimaryState(stored.primary ?? null); }
      } catch { /* no stored context yet */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(KEY, JSON.stringify({ ids, primary } satisfies Stored)); }, [ids, primary, hydrated]);

  const toggle = (projectId: string) => {
    setIds(previous => {
      if (previous.includes(projectId)) {
        const next = previous.filter(id => id !== projectId);
        if (primary === projectId) setPrimaryState(next[0] ?? null);
        return next;
      }
      if (previous.length >= MAX_ACTIVE) return previous;
      if (!primary) setPrimaryState(projectId);
      return [...previous, projectId];
    });
  };
  const setPrimary = (projectId: string | null) => {
    setPrimaryState(projectId);
    if (projectId) setIds(previous => previous.includes(projectId) ? previous : previous.length < MAX_ACTIVE ? [...previous, projectId] : previous);
  };
  const clear = () => { setIds([]); setPrimaryState(null); };

  const filtersOn = ids.length > 0;
  const includes = (projectId: string | null | undefined) => !filtersOn || (projectId != null && ids.includes(projectId));

  return { activeIds: ids, primaryId: primary, filtersOn, includes, toggle, setPrimary, clear };
}
