import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createAutosave, saveLabel } from "../lib/cloud-autosave.ts";

// A mocked dreamboard_writing_documents table that enforces the owner-only RLS policy
// (auth.uid() = owner_id) and the conditional (updated_at) update, like PostgREST would.
function table() {
  const rows = new Map(); let clock = 0; let n = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 6, 6, 0, 0, ++clock)).toISOString();
  const as = (uid) => ({
    async insert(row) {
      if (row.owner_id !== uid) return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
      // Upsert on the client-chosen id (PostgREST upsert onConflict: "id"); RLS still applies to the existing row.
      const id = row.id ?? `doc-${++n}`, prior = rows.get(id);
      if (prior && prior.owner_id !== uid) return { data: null, error: { code: "42501", message: "row-level security" } };
      const doc = { id, title: row.title, chapter_number: row.chapter_number, body: row.body, updated_at: stamp(), owner_id: uid };
      rows.set(doc.id, doc); return { data: pub(doc), error: null };
    },
    async updateIfUnchanged(id, expected, patch) {
      const r = rows.get(id);
      if (!r || r.owner_id !== uid || r.updated_at !== expected) return { data: null, error: null }; // RLS hides it, or version moved: zero rows
      Object.assign(r, patch, { updated_at: stamp() }); return { data: pub(r), error: null };
    },
    async select(id) { const r = rows.get(id); return r && r.owner_id === uid ? pub(r) : null; },
  });
  const pub = ({ owner_id, ...d }) => ({ ...d });
  return { as, rows };
}
// Manual timers so debouncing is deterministic.
function timers() { const q = []; return { setTimer: (fn) => (q.push(fn), q.length), clearTimer: (h) => { q[h - 1] = null; }, run: async () => { const fns = q.splice(0).filter(Boolean); for (const f of fns) f(); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); } }; }
const settle = () => new Promise((r) => setTimeout(r, 5));

test("debounced: many keystrokes become one cloud write, and 'saved' only follows the server ack", async () => {
  const db = table(), t = timers(), seen = []; let writes = 0;
  const store = db.as("alice"), counted = { ...store, insert: (r) => (writes++, store.insert(r)) };
  const a = createAutosave({ store: counted, ownerId: "alice", doc: null, title: () => "Book", ...t, onStatus: (s) => seen.push(s) });
  a.edit("O", 0); a.edit("On", 0); a.edit("Once", 0);
  assert.equal(a.status(), "pending"); assert.ok(!seen.includes("saved"), "no 'saved' before the server answers");
  await t.run(); await a.flush(); await settle();
  assert.equal(writes, 1); assert.equal(a.status(), "saved"); assert.equal(a.doc().body, "Once");
  assert.equal([...db.rows.values()][0].owner_id, "alice", "row is owned by the signed-in Passport");
});

test("sign in elsewhere: a second device reads back exactly what was saved", async () => {
  const db = table(), t = timers();
  const a = createAutosave({ store: db.as("alice"), ownerId: "alice", doc: null, title: () => "Book", ...t });
  a.edit("Chapter one, line one.", 0); await t.run(); await a.flush(); await settle();
  const restored = await db.as("alice").select(a.doc().id);
  assert.equal(restored.body, "Chapter one, line one.");
});

test("version safety: if another device saved first, this one reports a conflict and overwrites nothing", async () => {
  const db = table(), t = timers();
  const phone = createAutosave({ store: db.as("alice"), ownerId: "alice", doc: null, title: () => "Book", ...t });
  phone.edit("v1", 0); await t.run(); await phone.flush(); await settle();
  const laptopDoc = { ...phone.doc() };
  const laptop = createAutosave({ store: db.as("alice"), ownerId: "alice", doc: laptopDoc, title: () => "Book", ...t });
  phone.edit("v2 from phone", 0); await t.run(); await phone.flush(); await settle();
  laptop.edit("v2 from laptop", 0); await t.run(); await laptop.flush(); await settle();
  assert.equal(laptop.status(), "conflict");
  assert.equal([...db.rows.values()][0].body, "v2 from phone", "the newer save is not overwritten");
  assert.match(saveLabel("conflict"), /not overwritten/);
  // Creator chooses to keep the laptop copy on top of the server version.
  const remote = await db.as("alice").select(laptopDoc.id);
  laptop.resolve(remote, true); await settle(); await laptop.flush(); await settle();
  assert.equal(laptop.status(), "saved"); assert.equal([...db.rows.values()][0].body, "v2 from laptop");
});

test("owner-only RLS (mocked): an unrelated user can neither read nor overwrite the document", async () => {
  const db = table(), t = timers();
  const a = createAutosave({ store: db.as("alice"), ownerId: "alice", doc: null, title: () => "Book", ...t });
  a.edit("Alice's private chapter", 0); await t.run(); await a.flush(); await settle();
  assert.equal(await db.as("mallory").select(a.doc().id), null, "not readable by another Passport");
  const m = createAutosave({ store: db.as("mallory"), ownerId: "mallory", doc: { ...a.doc() }, title: () => "x", ...t });
  m.edit("overwritten", 0); await t.run(); await m.flush(); await settle();
  assert.equal(m.status(), "conflict", "zero rows matched → never reported as saved");
  assert.equal([...db.rows.values()][0].body, "Alice's private chapter");
  const forged = await db.as("mallory").insert({ owner_id: "alice", title: "x", chapter_number: 1, body: "x" });
  assert.ok(forged.error, "cannot insert a row owned by someone else");
});

test("edits made during a save are sent after its ack, one save at a time", async () => {
  const db = table(), t = timers(); let open = 0, max = 0;
  const base = db.as("alice");
  const slow = { insert: async (r) => { open++; max = Math.max(max, open); await settle(); const x = await base.insert(r); open--; return x; },
    updateIfUnchanged: async (...a) => { open++; max = Math.max(max, open); await settle(); const x = await base.updateIfUnchanged(...a); open--; return x; } };
  const a = createAutosave({ store: slow, ownerId: "alice", doc: null, title: () => "Book", ...t });
  a.edit("one", 0); await t.run();
  a.edit("one two", 0); await t.run();
  await a.flush(); await settle(); await settle(); await a.flush(); await settle();
  assert.equal(max, 1); assert.equal(a.status(), "saved"); assert.equal([...db.rows.values()][0].body, "one two");
});

test("errors never show as saved; signed-out shows device-only", async () => {
  const t = timers();
  const a = createAutosave({ store: { insert: async () => ({ data: null, error: { message: "offline" } }), updateIfUnchanged: async () => ({ data: null, error: null }) }, ownerId: "alice", doc: null, title: () => "Book", ...t });
  a.edit("x", 0); await t.run(); await a.flush(); await settle();
  assert.equal(a.status(), "error"); assert.doesNotMatch(saveLabel("error"), /Saved to your cloud/);
  assert.match(saveLabel("local"), /this device/);
});

test("the Writing Studio label is driven by the real status, not a timer", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /setSaveStatus\("saved"\), 700/);
  assert.match(page, /createAutosave\(/);
  assert.match(readFileSync(new URL("../app/writing-studio.tsx", import.meta.url), "utf8"), /saveLabel\(saveStatus\)/);
});

test("idempotent first save: a create whose reply is lost is retried onto the same row, never a duplicate", async () => {
  const db = table(), t = timers(), base = db.as("alice"); let calls = 0; const ids = [];
  const lossy = { ...base, insert: async (row) => { calls++; ids.push(row.id); const r = await base.insert(row); return calls === 1 ? { data: null, error: { message: "network: reply lost" } } : r; } };
  const a = createAutosave({ store: lossy, ownerId: "alice", doc: null, title: () => "Book", newId: () => "11111111-1111-4111-8111-111111111111", ...t });
  a.edit("first words", 0); await t.run(); await settle();
  assert.equal(a.status(), "error", "a lost reply is never shown as saved"); assert.equal(db.rows.size, 1, "the server did store it");
  a.edit("first words, more", 0); await t.run(); await a.flush(); await settle();
  assert.equal(a.status(), "saved"); assert.equal(db.rows.size, 1, "no duplicate document");
  assert.deepEqual(ids, ["11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111"], "the retry reuses the same client id");
  assert.equal([...db.rows.values()][0].body, "first words, more");
  // The client id is a real UUID by default.
  const b = createAutosave({ store: base, ownerId: "alice", doc: null, title: () => "B", ...t });
  b.edit("x", 0); await t.run(); await b.flush(); await settle();
  assert.match(b.doc().id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(readFileSync(new URL("../lib/cloud-autosave.ts", import.meta.url), "utf8"), /upsert\(row, \{ onConflict: "id" \}\)/);
});
