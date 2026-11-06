// Cloud autosave for the Writing Studio (shift 2026-11-06).
//
// Before this, "Saving… / Saved" was a 700 ms timer: the draft only reached localStorage and
// the cloud copy changed only on "Save version". Now:
//   • Edits are debounced, then written to dreamboard_writing_documents.
//   • "saved" is set ONLY when the server returns the row and its body is exactly what was sent.
//   • One save at a time; edits made during a save are sent right after its ack.
//   • Version safety: an update is conditional on the updated_at this device last saw. If another
//     device (or tab) saved in between, zero rows match → "conflict"; nothing is overwritten and
//     the local draft stays on this device until the creator chooses.
//   • Idempotent first save: the document id is chosen on this device and the create is an upsert on
//     that id, so a create whose reply was lost is retried onto the same row — never a duplicate.
//   • Owner-only: rows are inserted with owner_id = the signed-in Passport. RLS
//     (supabase/dreamboard-creator-workspace.sql: auth.uid() = owner_id) means another user's
//     update matches zero rows, which this engine reports as conflict/denied — never as saved.

export type CloudDoc = { id: string; title: string; chapter_number: number; body: string; updated_at: string };
export type SaveStatus = "local" | "idle" | "pending" | "saving" | "saved" | "conflict" | "error";

export type Store = {
  /** Create the document under a client-chosen id, idempotently (upsert on id): a retry after a lost reply
   *  writes the same row again instead of creating a duplicate. Returns the stored row (server ack) or an error. */
  insert(row: { id: string; owner_id: string; title: string; chapter_number: number; body: string }): Promise<{ data: CloudDoc | null; error: unknown }>;
  /** Update only if updated_at still equals expectedUpdatedAt; returns the stored row, or data null when no row matched. */
  updateIfUnchanged(id: string, expectedUpdatedAt: string, patch: { body: string; chapter_number: number; updated_at: string }): Promise<{ data: CloudDoc | null; error: unknown }>;
};

export type AutosaveOptions = {
  store: Store;
  ownerId: string;
  doc: CloudDoc | null;
  title: () => string;
  delayMs?: number;
  now?: () => string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onStatus?: (status: SaveStatus, doc: CloudDoc | null) => void;
  /** Client-side document id for the first save (default crypto.randomUUID()). */
  newId?: () => string;
};

export function createAutosave(o: AutosaveOptions) {
  const delay = o.delayMs ?? 1200;
  const now = o.now ?? (() => new Date().toISOString());
  const setT = o.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearT = o.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let doc = o.doc;
  // Chosen once, before the first write, and reused by every retry until the server acks the row.
  let newDocId: string | null = null;
  const makeId = o.newId ?? (() => crypto.randomUUID());
  let status: SaveStatus = "idle";
  let wanted: { body: string; chapter: number } | null = null; // newest edit not yet acked
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  const set = (s: SaveStatus) => { status = s; o.onStatus?.(s, doc); };

  async function flush(): Promise<void> {
    if (inFlight) { await inFlight; if (wanted && status !== "conflict") return flush(); return; }
    if (!wanted || status === "conflict") return;
    const send = wanted;
    set("saving");
    inFlight = (async () => {
      try {
        const r = doc
          ? await o.store.updateIfUnchanged(doc.id, doc.updated_at, { body: send.body, chapter_number: send.chapter + 1, updated_at: now() })
          : await o.store.insert({ id: (newDocId ??= makeId()), owner_id: o.ownerId, title: o.title(), chapter_number: send.chapter + 1, body: send.body });
        if (r.error) { set("error"); return; }
        if (!r.data) { set("conflict"); return; } // someone else saved first, or RLS denied: never overwrite
        if (r.data.body !== send.body) { set("error"); return; } // ack must be exactly what was sent
        doc = r.data;
        if (wanted === send) { wanted = null; set("saved"); } else set("pending");
      } catch { set("error"); }
    })();
    await inFlight; inFlight = null;
    if (wanted && status === "pending") return flush();
  }

  return {
    /** Call on every edit. */
    edit(body: string, chapter: number) {
      if (status === "conflict") { wanted = { body, chapter }; return; }
      if (doc && wanted === null && doc.body === body && doc.chapter_number === chapter + 1) return;
      wanted = { body, chapter };
      if (status !== "saving") set("pending");
      if (timer) clearT(timer);
      timer = setT(() => { timer = null; void flush(); }, delay);
    },
    /** Save now (page hide, ⌘S). */
    flush,
    /** After a conflict the creator chooses: adopt the server copy, or keep theirs on top of it. */
    resolve(remote: CloudDoc, keepMine: boolean) {
      doc = remote;
      if (!keepMine) { wanted = null; set("saved"); return remote.body; }
      set("pending"); void flush(); return wanted?.body ?? remote.body;
    },
    status: () => status,
    doc: () => doc,
  };
}

/** The label the Writing Studio shows. "Saved" appears only after a server ack. */
export function saveLabel(status: SaveStatus): string {
  switch (status) {
    case "saved": return "● Saved to your cloud";
    case "saving": return "● Saving to your cloud…";
    case "pending": return "● Unsaved changes…";
    case "conflict": return "● Changed on another device — not overwritten. Choose which copy to keep.";
    case "error": return "● Not saved to the cloud — kept on this device. Retrying on your next edit.";
    case "local": return "● Saved on this device · sign in to save to your cloud";
    default: return "● Up to date";
  }
}

/** Supabase-backed store. The conditional update is the version check. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function supabaseStore(supabase: any): Store {
  const cols = "id,title,chapter_number,body,updated_at";
  return {
    async insert(row) {
      const { data, error } = await supabase.from("dreamboard_writing_documents").upsert(row, { onConflict: "id" }).select(cols).single();
      return { data: (data as CloudDoc) ?? null, error };
    },
    async updateIfUnchanged(id, expected, patch) {
      const { data, error } = await supabase.from("dreamboard_writing_documents").update(patch).eq("id", id).eq("updated_at", expected).select(cols).maybeSingle();
      return { data: (data as CloudDoc) ?? null, error };
    },
  };
}
