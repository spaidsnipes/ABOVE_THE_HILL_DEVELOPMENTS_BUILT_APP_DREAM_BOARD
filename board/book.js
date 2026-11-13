/* Dream Board · Book Studio (Above the Hill Developments, 2026-11-12)
 * Organize decades of writing into a book — never ghostwrite it.
 * Local-first: everything lives in IndexedDB on this device, then syncs to the author's WOW Passport
 * (Supabase, owner-only RLS). Heavy work (parsing, themes, duplicates) runs in book-worker.js.
 * Mounted by app.js on #/book routes: window.DBBook.mount(container, ctx). */
(function () {
  "use strict";
  var V = "1112c";
  var ctx = null, root = null;
  var S = {
    books: [], cloudBooks: [], book: null, passages: [], chapters: [], sources: [], notes: [], revisions: [],
    byId: new Map(), f: { q: "", theme: null, source: "", view: "all", chapter: null, month: null }, shown: 60,
    busy: null, sync: { state: "idle", msg: "" }, outbox: new Map(), lastRoute: "", importOpen: false
  };
  var PALETTE = ["#e8b95a", "#7cc7a1", "#c98fd6", "#7fb2e6", "#e88f6f", "#b9d36a", "#e6a3c2", "#6fd0d6", "#d8c27a", "#a7a1f0", "#f0c08a", "#8fd08a", "#e07a8a", "#9cc3d8", "#cfa5e0", "#f3d996", "#86b7a0", "#d9937a", "#b7b7e8", "#e8d27a", "#95d6b9", "#e3a0a0", "#a0c8f0", "#c4e08a"];
  function color(t) { return t == null || t < 0 ? "#a99f8a" : PALETTE[t % PALETTE.length]; }
  function esc(s) { return ctx.esc(s); }
  function uuid() { return (crypto.randomUUID && crypto.randomUUID()) || "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) { return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16); }); }
  function now() { return new Date().toISOString(); }
  function fmtN(n) { return Number(n || 0).toLocaleString(); }
  function fmtK(n) { n = Number(n || 0); return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n); }
  function fmtDay(s) { if (!s) return ""; var d = new Date(s); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  function toast(m, bad) { ctx.toast(m, bad); }
  function words(s) { var m = String(s || "").match(/[A-Za-z0-9\u00C0-\u024F'’]+/g); return m ? m.length : 0; }

  // ---------------- IndexedDB ----------------
  var STORES = ["books", "sources", "passages", "chapters", "notes", "revisions"];
  var dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open("dreamboard-book-studio", 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        STORES.forEach(function (s) { var os = d.createObjectStore(s, { keyPath: "id" }); if (s !== "books") os.createIndex("book", "book_id"); });
        d.createObjectStore("outbox", { keyPath: "key" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  async function getAll(store, bookId) {
    var d = await idb(), os = d.transaction(store).objectStore(store);
    return reqP(bookId ? os.index("book").getAll(bookId) : os.getAll());
  }
  async function putMany(store, rows) {
    if (!rows.length) return;
    var d = await idb();
    await new Promise(function (res, rej) {
      var tx = d.transaction(store, "readwrite"), os = tx.objectStore(store);
      rows.forEach(function (r) { os.put(stripLocal(r)); });
      tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
    });
  }
  async function delMany(store, ids) {
    if (!ids.length) return;
    var d = await idb();
    await new Promise(function (res, rej) {
      var tx = d.transaction(store, "readwrite"), os = tx.objectStore(store);
      ids.forEach(function (id) { os.delete(id); });
      tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
    });
  }
  function stripLocal(r) { if (!r || !("_lc" in r)) return r; var c = Object.assign({}, r); delete c._lc; return c; }

  // ---------------- outbox + cloud sync ----------------
  var TABLE = { books: "dreamboard_books", sources: "dreamboard_book_sources", passages: "dreamboard_book_passages", chapters: "dreamboard_book_chapters", notes: "dreamboard_book_notes", revisions: "dreamboard_book_revisions" };
  var COLS = {
    books: ["id", "owner_id", "title", "subtitle", "settings", "words", "created_at", "updated_at"],
    sources: ["id", "book_id", "owner_id", "name", "kind", "words", "passages", "imported_at", "meta"],
    passages: ["id", "book_id", "owner_id", "source_id", "seq", "body", "words", "written_at", "speaker", "theme", "chapter_id", "position", "suggested_chapter_id", "dup_of", "dup_kept", "seed", "starred", "original", "updated_at"],
    chapters: ["id", "book_id", "owner_id", "title", "part", "position", "summary", "keywords", "created_at", "updated_at"],
    notes: ["id", "book_id", "owner_id", "chapter_id", "passage_id", "kind", "body", "url", "created_at", "updated_at"],
    revisions: ["id", "book_id", "owner_id", "label", "words", "snapshot", "created_at"]
  };
  function pick(store, r) { var o = {}; COLS[store].forEach(function (k) { if (r[k] !== undefined) o[k] = r[k]; }); return o; }
  async function queue(store, ids, op) {
    if (S.book && LOCAL.has(S.book.id)) { paintSync(); return; }
    var d = await idb(), rows = ids.map(function (id) { return { key: store + ":" + id, store: store, id: id, op: op || "put", book: S.book && S.book.id, v: ++qv }; });
    rows.forEach(function (r) { S.outbox.set(r.key, r); });
    await new Promise(function (res) { var tx = d.transaction("outbox", "readwrite"); rows.forEach(function (r) { tx.objectStore("outbox").put(r); }); tx.oncomplete = res; tx.onerror = res; });
    scheduleSync();
  }
  var qv = Date.now();
  // Books the Passport tier refused (basic = 1 book in the Passport) stay on this device and stop syncing.
  var LOCAL = (function () { try { return new Set(JSON.parse(localStorage.getItem("dreamboard-book-localonly") || "[]")); } catch (e) { return new Set(); } })();
  function markLocal(id) { LOCAL.add(id); try { localStorage.setItem("dreamboard-book-localonly", JSON.stringify(Array.from(LOCAL))); } catch (e) { /* private mode */ } }
  var LIMIT_MSG = "";
  async function loadOutbox() { var rows = await getAll("outbox"); S.outbox = new Map(rows.map(function (r) { return [r.key, r]; })); }
  var syncTimer = null, syncing = false;
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(pushAll, ms == null ? 2500 : ms); paintSync(); }
  function paintSync() {
    var el = document.getElementById("bk-sync"); if (!el) return;
    var n = S.outbox.size;
    if (S.book && LOCAL.has(S.book.id)) { el.className = "bk-sync dirty"; el.textContent = "On this device only" + (LIMIT_MSG ? " · " + LIMIT_MSG : ""); return; }
    el.className = "bk-sync" + (n ? " dirty" : "");
    el.textContent = S.sync.state === "saving" ? "Saving to your Passport…" : S.sync.state === "error" ? "On this device · not saved to Passport: " + S.sync.msg : n ? "On this device · " + fmtN(n) + " change" + (n === 1 ? "" : "s") + " waiting" : S.sync.state === "saved" ? "Saved to your Passport" : "On this device";
  }
  async function pushAll() {
    if (syncing || !ctx.user() || !S.outbox.size) { paintSync(); return; }
    syncing = true; S.sync.state = "saving"; paintSync();
    try {
      var stale = Array.from(S.outbox.values()).filter(function (x) { return LOCAL.has(x.book); });
      await clearOutbox(stale.map(function (x) { return [x.key, null]; }));
      var bookPuts = Array.from(S.outbox.values()).filter(function (x) { return x.store === "books" && x.op === "put"; });
      for (var bi = 0; bi < bookPuts.length; bi++) {
        var brow = await reqP((await idb()).transaction("books").objectStore("books").get(bookPuts[bi].id));
        if (!brow) { await clearOutbox([[bookPuts[bi].key, null]]); continue; }
        var br = await ctx.sb.from(TABLE.books).upsert(pick("books", brow), { onConflict: "id" });
        if (br.error && /DREAMBOARD_BOOK_LIMIT/.test(br.error.message || "")) {
          LIMIT_MSG = br.error.message.replace(/^.*DREAMBOARD_BOOK_LIMIT:\s*/, "");
          markLocal(brow.id);
          await clearOutbox(Array.from(S.outbox.values()).filter(function (x) { return x.book === brow.id || (x.store === "books" && x.id === brow.id); }).map(function (x) { return [x.key, null]; }));
          continue;
        }
        if (br.error) throw br.error;
        await clearOutbox([[bookPuts[bi].key, bookPuts[bi].v]]);
      }
      var items = Array.from(S.outbox.values());
      var order = ["books", "sources", "chapters", "passages", "notes", "revisions"];
      for (var oi = 1; oi < order.length; oi++) {
        var store = order[oi];
        var puts = items.filter(function (x) { return x.store === store && x.op === "put"; });
        if (!puts.length) continue;
        var d = await idb();
        var rows = await Promise.all(puts.map(function (x) { return reqP(d.transaction(store).objectStore(store).get(x.id)); }));
        var live = rows.filter(Boolean).map(function (r) { return pick(store, r); });
        for (var i = 0; i < live.length; i += 400) {
          var res = await ctx.sb.from(TABLE[store]).upsert(live.slice(i, i + 400), { onConflict: "id" });
          if (res.error) throw res.error;
          var vOf = new Map(puts.map(function (x) { return [x.key, x.v]; }));
          var done = live.slice(i, i + 400).map(function (r) { return [store + ":" + r.id, vOf.get(store + ":" + r.id)]; });
          await clearOutbox(done);
          paintSync();
        }
        await clearOutbox(puts.filter(function (x, ix) { return !rows[ix]; }).map(function (x) { return [x.key, x.v]; }));
      }
      for (oi = order.length - 1; oi >= 0; oi--) {
        var st = order[oi];
        var dels = items.filter(function (x) { return x.store === st && x.op === "del"; });
        for (var j = 0; j < dels.length; j += 200) {
          var chunk = dels.slice(j, j + 200);
          var r2 = await ctx.sb.from(TABLE[st]).delete().in("id", chunk.map(function (x) { return x.id; }));
          if (r2.error) throw r2.error;
          await clearOutbox(chunk.map(function (x) { return [x.key, x.v]; }));
        }
      }
      S.sync = { state: "saved", msg: "" };
    } catch (e) {
      var msg = (e && e.message) || String(e);
      var offline = /Failed to fetch|NetworkError|Load failed|network/i.test(msg);
      if (/DREAMBOARD_BOOK_LIMIT/.test(msg)) msg = msg.replace(/^.*DREAMBOARD_BOOK_LIMIT:\s*/, "");
      if (offline) msg = "no connection right now — it will retry";
      S.sync = { state: "error", msg: msg };
      if (offline) setTimeout(function () { scheduleSync(0); }, 20000);
    }
    syncing = false; paintSync();
    if (S.outbox.size && S.sync.state !== "error") scheduleSync(1500);
  }
  // keys: [key, version] pairs — an entry re-queued while a push was in flight (newer version) is kept.
  async function clearOutbox(pairs) {
    var keys = pairs.filter(function (kv) { var cur = S.outbox.get(kv[0]); return !cur || kv[1] == null || cur.v === kv[1]; }).map(function (kv) { return kv[0]; });
    if (!keys.length) return;
    keys.forEach(function (k) { S.outbox.delete(k); });
    var d = await idb();
    await new Promise(function (res) { var tx = d.transaction("outbox", "readwrite"); keys.forEach(function (k) { tx.objectStore("outbox").delete(k); }); tx.oncomplete = res; tx.onerror = res; });
  }
  async function fetchAllCloud(store, bookId) {
    var out = [], from = 0, size = 1000;
    for (;;) {
      var q = ctx.sb.from(TABLE[store]).select("*").eq("book_id", bookId).range(from, from + size - 1);
      if (store === "passages") q = q.order("seq");
      var r = await q;
      if (r.error) throw r.error;
      out = out.concat(r.data);
      if (r.data.length < size) break;
      from += size;
    }
    return out;
  }
  async function pullBook(cloud) {
    S.busy = { phase: "Opening " + cloud.title + " from your Passport", pct: 10 }; paint();
    await putMany("books", [cloud]);
    var stores = ["sources", "chapters", "passages", "notes", "revisions"];
    for (var i = 0; i < stores.length; i++) {
      S.busy = { phase: "Loading " + stores[i] + " from your Passport", pct: 20 + i * 16 }; paint();
      var rows = await fetchAllCloud(stores[i], cloud.id);
      var local = await getAll(stores[i], cloud.id);
      var keep = new Set(rows.map(function (r) { return r.id; }));
      await delMany(stores[i], local.filter(function (r) { return !keep.has(r.id) && !S.outbox.has(stores[i] + ":" + r.id); }).map(function (r) { return r.id; }));
      await putMany(stores[i], rows);
    }
    S.busy = null;
  }

  // ---------------- worker ----------------
  var worker = null, wseq = 0, wwait = {};
  function work(msg, onProgress, transfer) {
    if (!worker) {
      worker = new Worker("book-worker.js?v=" + V);
      worker.onmessage = function (ev) {
        var m = ev.data, w = wwait[m.id]; if (!w) return;
        if (m.type === "progress") { if (w.p) w.p(m); return; }
        delete wwait[m.id];
        if (m.type === "error") w.rej(new Error(m.error)); else w.res(m);
      };
      worker.onerror = function (e) { Object.keys(wwait).forEach(function (k) { wwait[k].rej(new Error(e.message || "Worker failed")); delete wwait[k]; }); };
    }
    msg.id = ++wseq;
    return new Promise(function (res, rej) { wwait[msg.id] = { res: res, rej: rej, p: onProgress }; worker.postMessage(msg, transfer || []); });
  }

  // ---------------- loading ----------------
  async function loadLibrary() {
    await loadOutbox();
    S.books = await getAll("books");
    S.cloudBooks = [];
    if (ctx.user()) {
      var r = await ctx.sb.from("dreamboard_books").select("id,owner_id,title,subtitle,settings,words,created_at,updated_at").order("updated_at", { ascending: false });
      if (!r.error) S.cloudBooks = r.data;
    }
    var mine = ctx.user() && ctx.user().id;
    S.books = S.books.filter(function (b) { return !b.owner_id || b.owner_id === mine; });
  }
  async function openBook(id) {
    await loadOutbox();
    var local = S.books.find(function (b) { return b.id === id; });
    var cloud = S.cloudBooks.find(function (b) { return b.id === id; });
    var pending = Array.from(S.outbox.values()).some(function (x) { return x.book === id; });
    if (cloud && (!local || (!pending && cloud.updated_at > (local.updated_at || "")))) await pullBook(cloud);
    var b = (await getAll("books")).find(function (x) { return x.id === id; });
    if (!b) { S.book = null; return; }
    S.book = b;
    var res = await Promise.all(["passages", "chapters", "sources", "notes", "revisions"].map(function (s) { return getAll(s, id); }));
    S.passages = res[0].sort(function (a, c) { return a.seq - c.seq; });
    S.chapters = res[1].sort(function (a, c) { return a.position - c.position; });
    S.sources = res[2].sort(function (a, c) { return (a.imported_at || "") < (c.imported_at || "") ? -1 : 1; });
    S.notes = res[3].sort(function (a, c) { return (c.created_at || "") < (a.created_at || "") ? -1 : 1; });
    S.revisions = res[4].sort(function (a, c) { return (c.created_at || "") < (a.created_at || "") ? -1 : 1; });
    reindex();
  }
  function reindex() {
    S.byId = new Map(); S.passages.forEach(function (p) { S.byId.set(p.id, p); });
    S.srcById = new Map(S.sources.map(function (s) { return [s.id, s]; }));
    S.chById = new Map(S.chapters.map(function (c) { return [c.id, c]; }));
  }
  function themes() { return (S.book && S.book.settings && S.book.settings.themes) || []; }
  function themeById(id) { return themes().find(function (t) { return t.id === id; }); }
  function authorWords() { return S.passages.reduce(function (a, p) { return a + (p.speaker === "author" && !p.dup_of ? p.words : 0); }, 0); }

  async function touchBook(extra) {
    Object.assign(S.book, extra || {}, { updated_at: now(), words: authorWords() });
    await putMany("books", [S.book]); await queue("books", [S.book.id]);
  }
  async function savePassages(list) { list.forEach(function (p) { p.updated_at = now(); }); await putMany("passages", list); await queue("passages", list.map(function (p) { return p.id; })); }
  async function saveChapters(list) { list.forEach(function (c) { c.updated_at = now(); }); await putMany("chapters", list); await queue("chapters", list.map(function (c) { return c.id; })); }

  // ---------------- import ----------------
  async function runImport(files, pasted, opts) {
    var uid = ctx.user().id;
    var payload = [], transfer = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.size > 220 * 1024 * 1024) { toast(f.name + " is over 220 MB; split it first.", true); continue; }
      var buf = await f.arrayBuffer(); payload.push({ name: f.name, buf: buf }); transfer.push(buf);
    }
    if (pasted && pasted.trim()) payload.push({ name: "Pasted " + new Date().toLocaleString(), text: pasted });
    if (!payload.length) return toast("Choose files or paste some writing first.", true);
    S.busy = { phase: "Reading your writing…", pct: 4 }; paint();
    var r = await work({ type: "import", files: payload, opts: { keepAI: !!opts.keepAI } }, function (m) { S.busy = { phase: m.phase, pct: 4 + 50 * (m.done / Math.max(1, m.total)) }; paintBusy(); }, transfer);
    var book = S.book;
    if (!book) {
      book = { id: uuid(), owner_id: uid, title: opts.title || "Untitled book", subtitle: "", settings: {}, words: 0, created_at: now(), updated_at: now() };
      await putMany("books", [book]); await queue("books", [book.id]);
      S.book = book; S.passages = []; S.chapters = []; S.sources = []; S.notes = []; S.revisions = [];
    }
    var seq = S.passages.reduce(function (a, p) { return Math.max(a, p.seq); }, 0);
    var srcRows = r.sources.map(function (s) {
      return { id: uuid(), book_id: book.id, owner_id: uid, name: s.name, kind: s.kind, words: s.words, passages: s.passages, imported_at: now(),
        meta: { totalWords: s.totalWords, units: s.units, authorUnits: s.authorUnits, firstAt: s.firstAt, lastAt: s.lastAt, keepAI: !!opts.keepAI } };
    });
    var rows = r.passages.map(function (p) {
      return { id: uuid(), book_id: book.id, owner_id: uid, source_id: srcRows[p.source].id, seq: ++seq, body: p.text, words: p.words, written_at: p.at || null,
        speaker: p.speaker, theme: null, chapter_id: null, position: null, suggested_chapter_id: null, dup_of: null, seed: null, starred: false, original: null, updated_at: now() };
    });
    S.busy = { phase: "Saving " + fmtN(rows.length) + " passages on this device", pct: 60 }; paintBusy();
    await putMany("sources", srcRows); await queue("sources", srcRows.map(function (s) { return s.id; }));
    for (var j = 0; j < rows.length; j += 2000) await putMany("passages", rows.slice(j, j + 2000));
    await queue("passages", rows.map(function (p) { return p.id; }));
    S.sources = S.sources.concat(srcRows); S.passages = S.passages.concat(rows); reindex();
    var mine = srcRows.reduce(function (a, s) { return a + s.words; }, 0);
    await analyzeBook();
    await snapshot("After importing " + srcRows.length + " source" + (srcRows.length === 1 ? "" : "s"));
    S.busy = null;
    toast("Imported " + fmtN(mine) + " of your words in " + fmtN(rows.length) + " passages.");
    return book;
  }

  async function analyzeBook() {
    if (!S.passages.length) return;
    S.busy = { phase: "Finding themes, repeats and idea seeds…", pct: 70 }; paintBusy();
    var input = S.passages.map(function (p) { return { text: p.body, at: p.written_at, speaker: p.speaker, words: p.words }; });
    var r = (await work({ type: "analyze", passages: input, opts: {} })).result;
    var changed = [];
    S.passages.forEach(function (p, i) {
      var th = r.theme[i] >= 0 ? r.theme[i] : null;
      var dup = r.dupOf[i] >= 0 ? S.passages[r.dupOf[i]].id : null;
      if (p.dup_kept) dup = null;
      if (p.theme !== th || p.dup_of !== dup) { p.theme = th; p.dup_of = dup; changed.push(p); }
    });
    var seedBy = new Map(r.seeds.map(function (s) { return [s.i, s.sentence]; }));
    S.passages.forEach(function (p, i) { var sd = seedBy.get(i) || null; if (p.seed !== sd) { p.seed = sd; if (changed.indexOf(p) < 0) changed.push(p); } });
    S.busy = { phase: "Saving themes on " + fmtN(changed.length) + " passages", pct: 90 }; paintBusy();
    await savePassages(changed);
    var settings = Object.assign({}, S.book.settings || {}, {
      themes: r.themes.map(function (t) { return { id: t.id, label: t.label, terms: t.terms, size: t.size, words: t.words, medianAt: t.medianAt, key: t.key }; }),
      outlineProposal: r.outline, analyzedAt: now(), analyzedCount: S.passages.length, vocab: r.vocabSize, analysisMs: null
    });
    await touchBook({ settings: settings });
  }

  // ---------------- outline ----------------
  async function proposeOutline() {
    var prop = (S.book.settings && S.book.settings.outlineProposal) || [];
    if (!prop.length) return toast("Import some writing first.", true);
    if (S.chapters.length && !confirm("Add " + prop.length + " proposed chapters after your current ones? Nothing is moved until you accept a suggestion.")) return;
    await snapshot("Before proposing an outline");
    var base = S.chapters.reduce(function (a, c) { return Math.max(a, c.position); }, 0);
    var uid = ctx.user().id;
    var made = prop.map(function (o, i) { return { id: uuid(), book_id: S.book.id, owner_id: uid, title: o.title, part: o.part || "", position: base + i + 1, summary: "", keywords: o.terms, created_at: now(), updated_at: now(), _theme: o.themeId }; });
    var sug = [];
    S.passages.forEach(function (p) {
      if (p.chapter_id || p.speaker !== "author") return;
      var ch = made.find(function (c) { return c._theme === p.theme; });
      if (ch && p.suggested_chapter_id !== ch.id) { p.suggested_chapter_id = ch.id; sug.push(p); }
    });
    made.forEach(function (c) { delete c._theme; });
    S.chapters = S.chapters.concat(made); reindex();
    await saveChapters(made); await savePassages(sug); await touchBook();
    toast(made.length + " chapters proposed from your themes. Rename them, then accept the suggested passages.");
  }
  // Outline text: one chapter per line; "Part: Name" starts a part; "Title — keyword, keyword" adds hints.
  async function pasteOutline(text) {
    var part = "", uid = ctx.user().id, base = S.chapters.reduce(function (a, c) { return Math.max(a, c.position); }, 0), made = [];
    text.split(/\n/).forEach(function (ln) {
      ln = ln.trim().replace(/^[-*•]\s*|^\d+[.)]\s*/, ""); if (!ln) return;
      var pm = ln.match(/^part\s*[:\-–—]?\s*(.+)$/i) || ln.match(/^part\s+[ivx\d]+\s*[·:\-–—]\s*(.+)$/i);
      if (pm) { part = ln.replace(/^part\s*[:]\s*/i, ""); return; }
      var bits = ln.split(/\s+[—–]{1,2}\s+|\s+--\s+/);
      var title = bits[0].trim(), kws = bits[1] ? bits[1].split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
      made.push({ id: uuid(), book_id: S.book.id, owner_id: uid, title: title, part: part, position: base + made.length + 1, summary: "", keywords: [title].concat(kws), created_at: now(), updated_at: now() });
    });
    if (!made.length) return toast("Write one chapter title per line.", true);
    await snapshot("Before adding a pasted outline");
    S.chapters = S.chapters.concat(made); reindex();
    await saveChapters(made); await touchBook();
    await suggestFor(made);
    toast(made.length + " chapters added. Suggested passages are waiting in each one.");
  }
  async function suggestFor(chs) {
    var open = S.passages.filter(function (p) { return !p.chapter_id && p.speaker === "author" && !p.dup_of; });
    S.busy = { phase: "Matching " + fmtN(open.length) + " passages to your chapters", pct: 50 }; paint();
    var r = (await work({ type: "suggest", passages: open.map(function (p) { return { text: p.body, speaker: p.speaker }; }), chapters: chs.map(function (c) { return { key: c.id, keywords: c.keywords || [c.title] }; }) })).result;
    var changed = [];
    open.forEach(function (p, i) { if (r[i] && p.suggested_chapter_id !== r[i]) { p.suggested_chapter_id = r[i]; changed.push(p); } });
    await savePassages(changed);
    S.busy = null;
    return changed.length;
  }
  async function acceptSuggestions(chId) {
    var list = S.passages.filter(function (p) { return p.suggested_chapter_id === chId && !p.chapter_id; });
    if (!list.length) return;
    await snapshot("Before accepting suggestions for " + (S.chById.get(chId) || {}).title);
    var pos = chapterPassages(chId).length;
    list.forEach(function (p) { p.chapter_id = chId; p.position = ++pos; p.suggested_chapter_id = null; });
    await savePassages(list); await touchBook();
    toast(list.length + " passages placed. Reorder them inside the chapter any time.");
  }
  function chapterPassages(chId) { return S.passages.filter(function (p) { return p.chapter_id === chId; }).sort(function (a, b) { return (a.position || 0) - (b.position || 0) || a.seq - b.seq; }); }
  async function movePassage(pid, chId, beforeId) {
    var p = S.byId.get(pid); if (!p) return;
    if (!chId) { p.chapter_id = null; p.position = null; await savePassages([p]); await touchBook(); return; }
    var list = chapterPassages(chId).filter(function (x) { return x.id !== pid; });
    var at = beforeId ? list.findIndex(function (x) { return x.id === beforeId; }) : -1;
    if (at < 0) at = list.length;
    list.splice(at, 0, p);
    p.chapter_id = chId; p.suggested_chapter_id = null;
    list.forEach(function (x, i) { x.position = i + 1; });
    await savePassages(list); await touchBook();
  }

  // ---------------- revisions ----------------
  async function snapshot(label) {
    if (!S.book) return;
    var snap = { chapters: S.chapters.map(function (c) { return { id: c.id, title: c.title, part: c.part, position: c.position, keywords: c.keywords, passages: chapterPassages(c.id).map(function (p) { return p.id; }) }; }) };
    var placed = snap.chapters.reduce(function (a, c) { return a + c.passages.reduce(function (b, id) { var p = S.byId.get(id); return b + (p ? p.words : 0); }, 0); }, 0);
    var rev = { id: uuid(), book_id: S.book.id, owner_id: ctx.user().id, label: label, words: placed, snapshot: snap, created_at: now() };
    S.revisions.unshift(rev);
    await putMany("revisions", [rev]); await queue("revisions", [rev.id]);
  }
  async function restore(revId) {
    var rev = S.revisions.find(function (r) { return r.id === revId; }); if (!rev) return;
    if (!confirm("Restore the outline from \"" + rev.label + "\"? Your current outline is saved as a version first.")) return;
    await snapshot("Before restoring \"" + rev.label + "\"");
    var keep = new Set(rev.snapshot.chapters.map(function (c) { return c.id; }));
    var gone = S.chapters.filter(function (c) { return !keep.has(c.id); });
    var uid = ctx.user().id;
    S.chapters = rev.snapshot.chapters.map(function (c) { var cur = S.chById.get(c.id) || {}; return Object.assign({}, cur, { id: c.id, book_id: S.book.id, owner_id: uid, title: c.title, part: c.part, position: c.position, keywords: c.keywords || [], created_at: cur.created_at || now() }); });
    var placeOf = new Map(); rev.snapshot.chapters.forEach(function (c) { c.passages.forEach(function (pid, i) { placeOf.set(pid, [c.id, i + 1]); }); });
    var changed = [];
    S.passages.forEach(function (p) {
      var pl = placeOf.get(p.id) || [null, null];
      if (p.chapter_id !== pl[0] || p.position !== pl[1]) { p.chapter_id = pl[0]; p.position = pl[1]; changed.push(p); }
      if (p.suggested_chapter_id && !keep.has(p.suggested_chapter_id)) { p.suggested_chapter_id = null; if (changed.indexOf(p) < 0) changed.push(p); }
    });
    reindex();
    await delMany("chapters", gone.map(function (c) { return c.id; })); await queue("chapters", gone.map(function (c) { return c.id; }), "del");
    await saveChapters(S.chapters); await savePassages(changed); await touchBook();
    toast("Restored \"" + rev.label + "\".");
  }

  // ---------------- export ----------------
  function manuscript(opts) {
    var out = [], notes = [];
    var chs = S.chapters.slice().sort(function (a, b) { return a.position - b.position; }), part = null;
    chs.forEach(function (c, ci) {
      if (opts.parts && c.part && c.part !== part) { part = c.part; out.push({ h: 1, t: part }); }
      out.push({ h: 2, t: "Chapter " + (ci + 1) + (c.title ? ": " + c.title : "") });
      chapterPassages(c.id).forEach(function (p) {
        if (p.speaker !== "author") return;
        var n = null;
        if (opts.sources) { var s = S.srcById.get(p.source_id); notes.push((s ? s.name : "Unknown source") + (p.written_at ? ", " + fmtDay(p.written_at) : "")); n = notes.length; }
        p.body.split(/\n\s*\n/).forEach(function (para, i, arr) { out.push({ p: para.trim(), n: i === arr.length - 1 ? n : null }); });
      });
    });
    return { blocks: out, notes: notes };
  }
  function toMarkdown(opts) {
    var m = manuscript(opts), lines = ["# " + S.book.title, ""];
    if (S.book.subtitle) lines.push("_" + S.book.subtitle + "_", "");
    m.blocks.forEach(function (b) { if (b.h) lines.push((b.h === 1 ? "## " : "### ") + b.t, ""); else lines.push(b.p + (b.n ? "[^" + b.n + "]" : ""), ""); });
    if (m.notes.length) { lines.push("---", ""); m.notes.forEach(function (n, i) { lines.push("[^" + (i + 1) + "]: " + n); }); }
    return lines.join("\n");
  }
  function xmlEsc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
  function toDocx(opts) {
    var m = manuscript(opts), body = [];
    function para(text, style, extra) { return "<w:p>" + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : "") + '<w:r><w:t xml:space="preserve">' + xmlEsc(text) + "</w:t></w:r>" + (extra || "") + "</w:p>"; }
    body.push(para(S.book.title, "Title"));
    if (S.book.subtitle) body.push(para(S.book.subtitle, "Subtitle"));
    m.blocks.forEach(function (b) {
      if (b.h) body.push((b.h === 2 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : "") + para(b.t, b.h === 1 ? "Heading1" : "Heading2"));
      else body.push(para(b.p, null, b.n ? '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>' + b.n + "</w:t></w:r>" : ""));
    });
    if (m.notes.length) { body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + para("Sources", "Heading1")); m.notes.forEach(function (n, i) { body.push(para((i + 1) + ". " + n)); }); }
    var W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W + '><w:body>' + body.join("") + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
    function st(id, name, sz, extra) { return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="360" w:after="200"/>' + (extra || "") + '</w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="' + sz + '"/></w:rPr></w:style>'; }
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="200" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' + st("Title", "Title", 56, '<w:jc w:val="center"/>') + st("Subtitle", "Subtitle", 32, '<w:jc w:val="center"/>') + st("Heading1", "heading 1", 40, '<w:outlineLvl w:val="0"/>') + st("Heading2", "heading 2", 32, '<w:outlineLvl w:val="1"/>') + "</w:styles>";
    var files = [
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
      ["docProps/core.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xmlEsc(S.book.title) + '</dc:title><dc:creator>' + xmlEsc((ctx.user() && ctx.user().email) || "") + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + now() + "</dcterms:created></cp:coreProperties>"],
      ["word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["word/document.xml", doc],
      ["word/styles.xml", styles]
    ];
    return zipStore(files);
  }
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipStore(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    function h(n, len) { var a = new Uint8Array(len); for (var i = 0; i < len; i++) a[i] = (n >>> (8 * i)) & 255; return a; }
    files.forEach(function (f) {
      var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
      var local = [h(0x04034b50, 4), h(20, 2), h(0x0800, 2), h(0, 2), h(0, 2), h(0x21, 2), h(crc, 4), h(data.length, 4), h(data.length, 4), h(name.length, 2), h(0, 2), name, data];
      parts.push.apply(parts, local);
      central.push(h(0x02014b50, 4), h(20, 2), h(20, 2), h(0x0800, 2), h(0, 2), h(0, 2), h(0x21, 2), h(crc, 4), h(data.length, 4), h(data.length, 4), h(name.length, 2), h(0, 2), h(0, 2), h(0, 2), h(0, 2), h(0, 4), h(off, 4), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (a, x) { return a + x.length; }, 0);
    var end = [h(0x06054b50, 4), h(0, 2), h(0, 2), h(files.length, 2), h(files.length, 2), h(csize, 4), h(off, 4), h(0, 2)];
    return new Blob(parts.concat(central, end), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  function download(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  function safeName(s) { return String(s || "book").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "book"; }

  // ---------------- views ----------------
  function route() { var p = location.hash.replace(/^#\/?/, "").split("/"); return { id: p[1] || null, tab: p[2] || "passages" }; }
  var TABS = [["passages", "Passages"], ["outline", "Outline"], ["timeline", "Timeline"], ["seeds", "Idea seeds"], ["dups", "Duplicates"], ["notes", "Research notes"], ["sources", "Sources"], ["history", "History"], ["export", "Export"]];

  function scene(kicker, title, lede, stats, actions) {
    return '<section class="bk-scene"><div class="bk-plate"></div><div class="bk-grain"></div><div class="bk-scene-in"><div class="bk-kicker">' + kicker + "</div><h1>" + title + '</h1><p class="lede">' + lede + "</p>" +
      (stats ? '<div class="bk-stats">' + stats.map(function (s) { return '<div class="bk-stat"><b>' + s[0] + "</b><span>" + s[1] + "</span></div>"; }).join("") + "</div>" : "") +
      (actions ? '<div class="bk-actions">' + actions + "</div>" : "") + "</div></section>";
  }
  function busyBar() {
    if (!S.busy) return "";
    return '<div class="bk-panel" id="bk-busy" role="status" aria-live="polite" style="margin:14px clamp(12px,3vw,40px) 0"><p class="bk-help" id="bk-busy-t" style="margin:0">' + esc(S.busy.phase) + '</p><div class="bk-progress"><i id="bk-busy-i" style="width:' + Math.round(S.busy.pct || 0) + '%"></i></div></div>';
  }
  function paintBusy() { var t = document.getElementById("bk-busy-t"), i = document.getElementById("bk-busy-i"); if (t && S.busy) { t.textContent = S.busy.phase; i.style.width = Math.round(S.busy.pct || 0) + "%"; } else paint(); }

  function importPanel(intoBook) {
    return '<div class="bk-panel" id="bk-import"><h3>' + (intoBook ? "Add more writing" : "Bring your writing") + '</h3><p class="sub">Paste, or drop files: .txt, .md, .docx, .html, .json — including ChatGPT exports (the .zip or conversations.json) and Grok exports. Nothing leaves this device until it saves to your Passport.</p>' +
      (intoBook ? "" : '<label class="bk-help" for="bk-title">Book title</label><input class="bk-in" id="bk-title" placeholder="e.g. Spiritual Awakening" maxlength="160" style="margin:4px 0 12px">') +
      '<div class="bk-drop" id="bk-drop"><h4>Drop your threads here</h4><p class="bk-help" style="margin:0 0 12px">Hundreds of files and over a million words are fine — the work happens in the background.</p><label class="btn solid" for="bk-files" style="cursor:pointer">Choose files</label><input id="bk-files" type="file" multiple accept=".txt,.md,.markdown,.docx,.json,.zip,.html,.htm,text/plain,text/markdown,application/json,application/zip" hidden><p class="bk-note" id="bk-picked" style="margin:10px 0 0"></p></div>' +
      '<label class="bk-help" for="bk-paste" style="display:block;margin:12px 0 4px">…or paste writing</label><textarea class="bk-ta" id="bk-paste" style="min-height:120px" placeholder="Paste a chapter, a journal, a whole chat thread…"></textarea>' +
      '<label class="bk-row bk-help" style="margin:10px 0"><input type="checkbox" id="bk-keepai"> Also keep the AI\'s replies from chat exports, marked "not your words" (they never enter the manuscript)</label>' +
      '<div class="bk-row"><button class="btn solid" data-bk="import-go">' + (intoBook ? "Add to this book" : "Start the book") + '</button><span class="bk-note">Only your own messages are kept from chat exports unless you tick the box.</span></div></div>';
  }

  function viewLibrary() {
    var mine = ctx.user() && ctx.user().id, tier = ctx.access() && ctx.access().tier;
    var ids = new Set(), list = [];
    S.cloudBooks.forEach(function (b) { ids.add(b.id); list.push({ b: b, where: "Passport" }); });
    S.books.forEach(function (b) { if (!ids.has(b.id)) list.push({ b: b, where: LOCAL.has(b.id) ? "This device only" : "This device" }); });
    var totalWords = list.reduce(function (a, x) { return a + (x.b.words || 0); }, 0);
    var limitNote = tier === "basic" ? '<p class="bk-note">Your Passport tier saves 1 book to your Passport. Founder, partner and premium Passports save unlimited books.</p>' : "";
    return scene("Dream Board · Book Studio", "Your words, organized.<br>Never ghostwritten.",
      "Bring decades of threads, journals and drafts. Book Studio splits them into passages, finds your themes, proposes chapters and keeps every source and date — the words stay yours.",
      list.length ? [[fmtN(totalWords), "your words"], [fmtN(list.length), list.length === 1 ? "book" : "books"]] : null,
      '<a class="btn solid" href="#bk-import">Start a book</a>') + busyBar() +
      '<div class="bk-work one">' +
      (list.length ? '<div class="bk-panel"><h3>Your books</h3><p class="sub">Private to your WOW Passport' + (mine ? "" : "") + '.</p><div class="bk-books">' + list.map(function (x) {
        return '<a class="bk-book" href="#/book/' + x.b.id + '"><span class="where">' + x.where + "</span><b>" + esc(x.b.title) + "</b><span>" + fmtN(x.b.words) + " words · " + ((x.b.settings && x.b.settings.themes || []).length) + " themes</span><span>Updated " + fmtDay(x.b.updated_at) + "</span></a>";
      }).join("") + "</div>" + limitNote + "</div>" : '<div class="bk-panel bk-empty">No books yet. Your first one starts with the writing you already have.</div>') +
      importPanel(false) +
      '<div class="bk-panel"><h3>What the Studio does — and doesn\'t</h3><ul class="bk-help"><li>Organizes: passages, themes, a proposed outline, duplicates, idea seeds, a timeline, research notes and versions.</li><li>Studio Assist runs on this device. It picks your own key sentences and asks you questions from fixed templates filled with your words. It does not write prose.</li><li>Exports a manuscript (.docx or Markdown) made only of the passages you placed — with sources if you want them.</li></ul></div></div>';
  }

  function chapterRail(curCh) {
    var unplaced = S.passages.filter(function (p) { return !p.chapter_id && p.speaker === "author" && !p.dup_of; }).length;
    var maxW = 1;
    var wOf = {}; S.passages.forEach(function (p) { if (p.chapter_id) wOf[p.chapter_id] = (wOf[p.chapter_id] || 0) + p.words; });
    Object.keys(wOf).forEach(function (k) { if (wOf[k] > maxW) maxW = wOf[k]; });
    var part = null, out = [];
    out.push('<a class="bk-ch" data-drop="none" href="#/book/' + S.book.id + '/passages" data-bk="ch-pick" data-ch="" aria-current="' + (!curCh) + '"><span class="n">∗</span><span class="t">Unplaced &amp; all passages</span><span class="w">' + fmtK(unplaced) + "</span></a>");
    S.chapters.slice().sort(function (a, b) { return a.position - b.position; }).forEach(function (c, i) {
      if (c.part && c.part !== part) { part = c.part; out.push('<div class="bk-part">' + esc(part) + "</div>"); }
      var sug = S.passages.filter(function (p) { return p.suggested_chapter_id === c.id && !p.chapter_id; }).length;
      out.push('<a class="bk-ch" data-drop="' + c.id + '" href="#/book/' + S.book.id + '/passages" data-bk="ch-pick" data-ch="' + c.id + '" aria-current="' + (curCh === c.id) + '"><span class="n">' + (i + 1) + '</span><span class="t">' + esc(c.title || "Untitled chapter") + '</span><span class="w" title="' + fmtN(wOf[c.id] || 0) + ' words placed">' + fmtK(wOf[c.id] || 0) + (sug ? ' <span style="color:var(--ok)">+' + sug + "</span>" : "") + '</span><span class="bar"><i style="width:' + Math.round(100 * (wOf[c.id] || 0) / maxW) + '%"></i></span></a>');
    });
    return '<aside class="bk-rail"><div class="bk-panel bk-sticky"><h3>Manuscript</h3><p class="sub">' + (S.chapters.length ? "Drag a passage onto a chapter, or use Move to." : "No chapters yet — propose an outline from your themes.") + '</p><div class="bk-chlist">' + out.join("") + "</div>" +
      (S.chapters.length ? "" : '<div class="bk-row" style="margin-top:10px"><button class="btn small solid" data-bk="propose">Propose outline</button></div>') + "</div></aside>";
  }

  function filtered() {
    var f = S.f, q = f.q.trim().toLowerCase(), out = [];
    for (var i = 0; i < S.passages.length; i++) {
      var p = S.passages[i];
      if (f.view !== "ai" && p.speaker !== "author") continue;
      if (f.view === "ai" && p.speaker === "author") continue;
      if (f.chapter) { if (p.chapter_id !== f.chapter && !(f.view === "suggested" && p.suggested_chapter_id === f.chapter && !p.chapter_id)) continue; if (f.view !== "suggested" && p.chapter_id !== f.chapter) continue; }
      else if (f.view === "unplaced" && p.chapter_id) continue;
      if (f.view === "seeds" && !p.seed) continue;
      if (f.view === "dups" && !p.dup_of) continue;
      if (f.view === "starred" && !p.starred) continue;
      if (f.view !== "dups" && f.view !== "ai" && p.dup_of && !f.chapter) continue;
      if (f.theme != null && p.theme !== f.theme) continue;
      if (f.source && p.source_id !== f.source) continue;
      if (f.month && (!p.written_at || p.written_at.slice(0, 7) !== f.month)) continue;
      if (q) { if (!p._lc) p._lc = p.body.toLowerCase(); if (p._lc.indexOf(q) < 0) continue; }
      out.push(p);
    }
    if (f.chapter && f.view !== "suggested") out.sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    return out;
  }
  function highlight(text) {
    var q = S.f.q.trim(); var e = esc(text);
    if (!q) return e;
    var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/&/g, "&amp;").replace(/</g, "&lt;"), "gi");
    return e.replace(re, function (m) { return "<mark>" + m + "</mark>"; });
  }
  function card(p, i, inChapter) {
    var src = S.srcById.get(p.source_id), th = themeById(p.theme), sug = p.suggested_chapter_id && !p.chapter_id ? S.chById.get(p.suggested_chapter_id) : null, ch = p.chapter_id && S.chById.get(p.chapter_id);
    var opts = '<option value="">Unplaced</option>' + S.chapters.slice().sort(function (a, b) { return a.position - b.position; }).map(function (c, ci) { return '<option value="' + c.id + '"' + (c.id === p.chapter_id ? " selected" : "") + ">" + (ci + 1) + ". " + esc((c.title || "Untitled").slice(0, 60)) + "</option>"; }).join("");
    return '<article class="bk-card' + (S.sel === p.id ? " sel" : "") + '" style="--c:' + color(p.theme) + ";--i:" + Math.min(i, 20) + '" data-pid="' + p.id + '"' + (p.speaker === "author" ? ' draggable="true"' : "") + '>' +
      (S.editing === p.id ? '<textarea class="bk-ta" data-bk-edit="' + p.id + '">' + esc(p.body) + '</textarea><div class="bk-row" style="margin-top:8px"><button class="btn small solid" data-bk="edit-save" data-id="' + p.id + '">Save my edit</button><button class="btn small" data-bk="edit-cancel">Cancel</button><span class="bk-note">' + (p.original ? "Your first version is kept." : "Your first version will be kept.") + "</span></div>"
        : '<div class="txt' + (S.open === p.id ? "" : " clamp") + '" data-bk="open" data-id="' + p.id + '">' + highlight(p.body) + "</div>") +
      '<div class="meta"><span class="src" title="' + esc(src ? src.name : "") + '">' + esc(src ? src.name : "Unknown source") + "</span>" + (p.written_at ? "<span>" + fmtDay(p.written_at) + "</span>" : "") + "<span>" + fmtN(p.words) + " words</span>" +
      (th ? '<span class="tag" style="color:' + color(p.theme) + ';border-color:' + color(p.theme) + '66">' + esc(th.label) + "</span>" : "") +
      (p.speaker !== "author" ? '<span class="tag ai">AI reply · not your words</span>' : "") +
      (p.dup_of ? '<span class="tag dup">repeat of an earlier passage</span>' : "") + (p.seed ? '<span class="tag">✦ idea seed</span>' : "") +
      (sug ? '<span class="tag sug">suggested: ' + esc(sug.title.slice(0, 40)) + "</span>" : "") + (ch && !inChapter ? '<span class="tag">in: ' + esc(ch.title.slice(0, 40)) + "</span>" : "") + (p.original ? '<span class="tag">edited</span>' : "") + "</div>" +
      (p.speaker === "author" ? '<div class="tools"><label class="sr-only" for="mv-' + p.id + '">Move to chapter</label><select id="mv-' + p.id + '" data-bk-move="' + p.id + '">' + opts + "</select>" +
        (sug ? '<button class="btn small solid" data-bk="accept-one" data-id="' + p.id + '">Place in suggested</button>' : "") +
        (inChapter ? '<button class="btn small" data-bk="up" data-id="' + p.id + '" aria-label="Move up">↑</button><button class="btn small" data-bk="down" data-id="' + p.id + '" aria-label="Move down">↓</button>' : "") +
        '<button class="btn small" data-bk="star" data-id="' + p.id + '" aria-pressed="' + !!p.starred + '">' + (p.starred ? "★ Starred" : "☆ Star") + '</button><button class="btn small" data-bk="edit" data-id="' + p.id + '">Edit</button><button class="btn small" data-bk="note-on" data-id="' + p.id + '">Note</button>' +
        (p.dup_of ? '<button class="btn small" data-bk="dup-keep" data-id="' + p.id + '">Not a repeat</button>' : "") + "</div>" : "") +
      "</article>";
  }
  function assistPanel() {
    var f = S.f, out = '<span class="label">Studio Assist · on this device</span>';
    var ch = f.chapter && S.chById.get(f.chapter);
    if (ch) {
      var list = chapterPassages(ch.id);
      var kw = (ch.keywords || []).slice(0, 6);
      var terms = topTerms(list.map(function (p) { return p.body; }), 8);
      var keys = keySentencesLocal(list, terms.length ? terms : kw, 3);
      out += "<h3>" + esc(ch.title || "Untitled chapter") + '</h3><p class="sub">' + fmtN(list.length) + " passages · " + fmtN(list.reduce(function (a, p) { return a + p.words; }, 0)) + " words placed</p>" +
        (terms.length ? '<div class="bk-terms">' + terms.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" : "") +
        (keys.length ? '<h3 style="font-size:16px">Your key sentences</h3>' + keys.map(function (s) { return "<blockquote>" + esc(s) + "</blockquote>"; }).join("") : '<p class="bk-note">Place passages here and your key sentences appear.</p>') +
        '<h3 style="font-size:16px">Questions to answer (templates)</h3><ol>' + BookEngine.questionsFor(terms.length ? terms : kw, ch.title).map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ol>" +
        '<h3 style="font-size:16px">Creative prompts (templates)</h3><ul>' + BookEngine.promptsFor(terms.length ? terms : kw).map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul>" +
        '<button class="btn small" data-bk="write-new" data-ch="' + ch.id + '">Write a new passage here</button>';
      return out;
    }
    var th = f.theme != null && themeById(f.theme);
    if (th) {
      out += "<h3>" + esc(th.label) + '</h3><p class="sub">' + fmtN(th.size) + " passages · " + fmtN(th.words) + ' words</p><div class="bk-terms">' + th.terms.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" +
        ((th.key || []).length ? '<h3 style="font-size:16px">Your key sentences</h3>' + th.key.map(function (s) { return "<blockquote>" + esc(s) + "</blockquote>"; }).join("") : "") +
        '<h3 style="font-size:16px">Questions to answer (templates)</h3><ol>' + BookEngine.questionsFor(th.terms, th.label).map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ol>";
      return out;
    }
    var ts = themes();
    out += '<h3>Your themes</h3><p class="sub">Found in your own words. It reads, sorts and asks — it never writes your book.</p>' +
      (ts.length ? ts.map(function (t) { return '<button class="bk-chip" style="--c:' + color(t.id) + ';margin:0 6px 6px 0" data-bk="theme" data-t="' + t.id + '"><i></i>' + esc(t.label) + " · " + fmtN(t.size) + "</button>"; }).join("") : '<p class="bk-note">Import writing to see your themes.</p>') +
      (S.book.settings && S.book.settings.analyzedAt ? '<p class="bk-note" style="margin-top:8px">Last sorted ' + fmtDay(S.book.settings.analyzedAt) + ' · <button class="btn small" data-bk="reanalyze">Sort again</button></p>' : "");
    return out;
  }
  function topTerms(texts, n) {
    var tf = new Map();
    texts.forEach(function (t) { BookEngine.tokens(t).forEach(function (w) { tf.set(w, (tf.get(w) || 0) + 1); }); });
    var bookDf = S._df || (S._df = (function () { var m = new Map(); S.passages.forEach(function (p) { if (p.speaker === "author") new Set(BookEngine.tokens(p.body)).forEach(function (w) { m.set(w, (m.get(w) || 0) + 1); }); }); return m; })());
    var N = S.passages.length + 1;
    return Array.from(tf.entries()).filter(function (e) { return e[1] > 1; }).map(function (e) { return [e[0], e[1] * Math.log(N / ((bookDf.get(e[0]) || 1) + 1))]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n).map(function (e) { return e[0]; });
  }
  function keySentencesLocal(list, terms, n) { return BookEngine.keySentences(list.slice(0, 300).map(function (p) { return p.body; }), terms, n); }

  function viewPassages() {
    var f = S.f, list = filtered(), shown = list.slice(0, S.shown), inCh = !!f.chapter && f.view !== "suggested";
    var srcOpts = '<option value="">All sources (' + S.sources.length + ")</option>" + S.sources.map(function (s) { return '<option value="' + s.id + '"' + (f.source === s.id ? " selected" : "") + ">" + esc(s.name.slice(0, 70)) + " · " + fmtK(s.words) + "</option>"; }).join("");
    var views = [["all", "All passages"], ["unplaced", "Unplaced"], ["suggested", "Suggested for this chapter"], ["seeds", "Idea seeds"], ["starred", "Starred"], ["dups", "Repeats"], ["ai", "AI replies (not yours)"]];
    var ch = f.chapter && S.chById.get(f.chapter);
    var sugN = ch ? S.passages.filter(function (p) { return p.suggested_chapter_id === ch.id && !p.chapter_id; }).length : 0;
    return '<div class="bk-work">' + chapterRail(f.chapter) + '<main id="bk-main">' +
      (ch ? '<div class="bk-panel" style="margin-bottom:12px"><div class="bk-row"><h3 style="margin:0;flex:1">' + esc(ch.title) + "</h3>" + (sugN ? '<button class="btn small solid" data-bk="accept" data-ch="' + ch.id + '">Accept ' + fmtN(sugN) + " suggested</button>" : "") + '<button class="btn small" data-bk="view" data-v="' + (f.view === "suggested" ? "all" : "suggested") + '">' + (f.view === "suggested" ? "Show placed" : "Review suggestions") + "</button></div></div>" : "") +
      '<div class="bk-filter"><label class="sr-only" for="bk-q">Search your words</label><input type="search" id="bk-q" placeholder="Search every word…" value="' + esc(f.q) + '"><label class="sr-only" for="bk-src">Source</label><select id="bk-src">' + srcOpts + '</select><label class="sr-only" for="bk-view">Show</label><select id="bk-view">' + views.filter(function (v) { return v[0] !== "suggested" || ch; }).map(function (v) { return '<option value="' + v[0] + '"' + (f.view === v[0] ? " selected" : "") + ">" + v[1] + "</option>"; }).join("") + "</select>" +
      '<span class="bk-count" aria-live="polite">' + fmtN(list.length) + " passage" + (list.length === 1 ? "" : "s") + (f.month ? " · " + f.month + ' <button class="btn small" data-bk="month" data-m="">clear month</button>' : "") + "</span></div>" +
      '<div class="bk-chips">' + themes().map(function (t) { return '<button class="bk-chip" style="--c:' + color(t.id) + '" data-bk="theme" data-t="' + t.id + '" aria-pressed="' + (f.theme === t.id) + '"><i></i>' + esc(t.label) + "</button>"; }).join("") + "</div>" +
      (shown.length ? '<div class="bk-list" id="bk-list">' + shown.map(function (p, i) { return card(p, i, inCh); }).join("") + "</div>" : '<div class="bk-panel bk-empty">' + (S.passages.length ? "Nothing matches these filters." : "This book is empty. Add writing from the Sources tab.") + "</div>") +
      (list.length > shown.length ? '<div class="bk-more"><button class="btn" data-bk="more">Show more (' + fmtN(list.length - shown.length) + " left)</button></div>" : "") +
      '</main><aside class="bk-side"><div class="bk-panel bk-assist bk-sticky">' + assistPanel() + "</div></aside></div>";
  }

  function viewOutline() {
    var chs = S.chapters.slice().sort(function (a, b) { return a.position - b.position; });
    var wOf = {}, nOf = {}, sOf = {};
    S.passages.forEach(function (p) { if (p.chapter_id) { wOf[p.chapter_id] = (wOf[p.chapter_id] || 0) + p.words; nOf[p.chapter_id] = (nOf[p.chapter_id] || 0) + 1; } else if (p.suggested_chapter_id) sOf[p.suggested_chapter_id] = (sOf[p.suggested_chapter_id] || 0) + 1; });
    return '<div class="bk-work one"><div class="bk-panel"><div class="bk-row"><h3 style="flex:1;margin:0">Outline</h3><button class="btn small solid" data-bk="propose">Propose from my themes</button><button class="btn small" data-bk="paste-outline">Paste my own outline</button><button class="btn small" data-bk="add-ch">Add a chapter</button></div>' +
      '<p class="sub" style="margin-top:6px">Proposed chapters are only suggestions: passages move when you accept them. Rename anything. Every change is kept in History.</p></div>' +
      (S.pasting ? '<div class="bk-panel"><h3>Paste your outline</h3><p class="sub">One chapter per line. Start a part with <b>Part: The Fire</b>. Add hints after a dash: <b>Bethesda — mercy, pool, healing</b>.</p><textarea class="bk-ta" id="bk-outline-text" style="font-family:var(--sans);font-size:15px"></textarea><div class="bk-row" style="margin-top:8px"><button class="btn small solid" data-bk="paste-go">Add chapters and suggest passages</button><button class="btn small" data-bk="paste-cancel">Cancel</button></div></div>' : "") +
      (chs.length ? '<div class="bk-outline">' + chs.map(function (c, i) {
        return '<div class="bk-ocard" data-drop="' + c.id + '" style="--i:' + i + '"><div class="no">Chapter ' + (i + 1) + '</div><label class="sr-only" for="ct-' + c.id + '">Chapter title</label><input id="ct-' + c.id + '" data-bk-title="' + c.id + '" value="' + esc(c.title) + '" maxlength="200"><label class="sr-only" for="cp-' + c.id + '">Part</label><input id="cp-' + c.id + '" data-bk-part="' + c.id + '" value="' + esc(c.part || "") + '" placeholder="Part (optional)" style="font-family:var(--sans);font-size:13px;color:var(--gold)" maxlength="120">' +
          '<div class="row2"><span>' + fmtN(nOf[c.id] || 0) + " passages · " + fmtN(wOf[c.id] || 0) + " words</span>" + (sOf[c.id] ? '<span style="color:var(--ok)">+' + fmtN(sOf[c.id]) + " suggested</span>" : "") + "</div>" +
          '<div class="bk-row">' + (sOf[c.id] ? '<button class="btn small solid" data-bk="accept" data-ch="' + c.id + '">Accept suggested</button>' : "") + '<a class="btn small" href="#/book/' + S.book.id + '/passages" data-bk="ch-pick" data-ch="' + c.id + '">Open</a><button class="btn small" data-bk="ch-up" data-ch="' + c.id + '" aria-label="Move chapter up">↑</button><button class="btn small" data-bk="ch-down" data-ch="' + c.id + '" aria-label="Move chapter down">↓</button><button class="btn small" data-bk="ch-del" data-ch="' + c.id + '">Remove</button></div></div>';
      }).join("") + "</div>" : '<div class="bk-panel bk-empty">No chapters yet. Propose an outline from your themes, or paste the one you already have.</div>') + "</div>";
  }

  function viewTimeline() {
    var months = {};
    S.passages.forEach(function (p) { if (!p.written_at || p.speaker !== "author" || p.dup_of) return; var m = p.written_at.slice(0, 7); var o = months[m] || (months[m] = { w: 0, by: {} }); o.w += p.words; o.by[p.theme] = (o.by[p.theme] || 0) + p.words; });
    var keys = Object.keys(months).sort();
    if (keys.length) { var a = keys[0], z = keys[keys.length - 1], all = [], y = +a.slice(0, 4), mo = +a.slice(5, 7); while (true) { var k = y + "-" + String(mo).padStart(2, "0"); all.push(k); if (k >= z || all.length > 600) break; mo++; if (mo > 12) { mo = 1; y++; } } keys = all; }
    var max = keys.reduce(function (a2, k) { return Math.max(a2, (months[k] || { w: 0 }).w); }, 1);
    var undated = S.passages.filter(function (p) { return !p.written_at && p.speaker === "author"; }).length;
    var monthList = S.f.month ? filtered() : [];
    return '<div class="bk-work one"><div class="bk-panel"><h3>Timeline</h3><p class="sub">Your words by the month you wrote them (from chat dates). ' + (undated ? fmtN(undated) + " passages have no date (pasted text and documents keep no date)." : "") + "</p>" +
      (keys.length ? '<div class="bk-tl" role="group" aria-label="Words per month">' + keys.map(function (k) {
        var o = months[k] || { w: 0, by: {} };
        var segs = Object.keys(o.by).map(function (t) { return '<i style="--c:' + color(+t) + ";height:" + (100 * o.by[t] / max).toFixed(2) + '%"></i>'; }).join("");
        return '<button data-bk="month" data-m="' + k + '" aria-pressed="' + (S.f.month === k) + '" title="' + k + ": " + fmtN(o.w) + ' words" aria-label="' + k + ", " + fmtN(o.w) + ' words">' + segs + "</button>";
      }).join("") + '</div><div class="bk-tl-x" aria-hidden="true">' + keys.map(function (k) { return "<span>" + k + "</span>"; }).join("") + "</div>" : '<p class="bk-empty">No dated passages yet. Chat exports carry dates; pasted text does not.</p>') +
      '<div class="bk-chips" style="margin-top:12px">' + themes().map(function (t) { return '<span class="bk-chip" style="--c:' + color(t.id) + '"><i></i>' + esc(t.label) + "</span>"; }).join("") + "</div></div>" +
      (S.f.month ? '<div class="bk-panel"><div class="bk-row"><h3 style="flex:1;margin:0">' + S.f.month + "</h3><span class=\"bk-note\">" + fmtN(monthList.length) + ' passages</span><button class="btn small" data-bk="month" data-m="">Clear</button></div><div class="bk-list" style="margin-top:12px">' + monthList.slice(0, S.shown).map(function (p, i) { return card(p, i, false); }).join("") + "</div>" + (monthList.length > S.shown ? '<div class="bk-more"><button class="btn" data-bk="more">Show more</button></div>' : "") + "</div>" : "") + "</div>";
  }

  function viewSeeds() {
    var list = S.passages.filter(function (p) { return p.seed && p.speaker === "author"; });
    return '<div class="bk-work one"><div class="bk-panel"><h3>Idea seeds</h3><p class="sub">Sentences where you named an intention, a "what if", a vision or an invention — found in your own words. ' + fmtN(list.length) + " so far.</p>" +
      (list.length ? '<div class="bk-notes">' + list.slice(0, S.shown).map(function (p) { var src = S.srcById.get(p.source_id); return '<div class="bk-noteitem" style="border-left:3px solid ' + color(p.theme) + '"><div class="k">' + esc(src ? src.name : "") + (p.written_at ? " · " + fmtDay(p.written_at) : "") + '</div><blockquote style="margin:6px 0;font-family:var(--serif);font-size:18px">' + esc(p.seed) + '</blockquote><div class="bk-row"><button class="btn small" data-bk="goto" data-id="' + p.id + '">Open passage</button><button class="btn small" data-bk="seed-note" data-id="' + p.id + '">Save as research note</button></div></div>'; }).join("") + "</div>" + (list.length > S.shown ? '<div class="bk-more"><button class="btn" data-bk="more">Show more</button></div>' : "") : '<p class="bk-empty">No idea seeds found yet.</p>') + "</div></div>";
  }

  function viewDups() {
    var groups = new Map();
    S.passages.forEach(function (p) { if (p.dup_of) { var g = groups.get(p.dup_of) || []; g.push(p); groups.set(p.dup_of, g); } });
    var keys = Array.from(groups.keys());
    var total = keys.reduce(function (a, k) { return a + groups.get(k).length; }, 0);
    return '<div class="bk-work one"><div class="bk-panel"><div class="bk-row"><h3 style="flex:1;margin:0">Repeats</h3>' + (total ? '<button class="btn small" data-bk="dup-clear-all">Remove all ' + fmtN(total) + " repeats</button>" : "") + '</div><p class="sub">The same words pasted or said more than once (exact or near-exact). Repeats stay out of themes and the manuscript until you say they are not repeats.</p>' +
      (keys.length ? keys.slice(0, Math.ceil(S.shown / 3)).map(function (k) {
        var orig = S.byId.get(k); if (!orig) return "";
        return '<div class="bk-noteitem" style="margin-bottom:12px"><div class="k">Kept</div>' + '<p style="font-family:var(--serif);font-size:17px;margin:6px 0">' + esc(orig.body.slice(0, 400)) + (orig.body.length > 400 ? "…" : "") + "</p>" +
          groups.get(k).map(function (d) { var s = S.srcById.get(d.source_id); return '<div style="border-top:1px solid rgba(217,181,108,0.15);padding-top:8px;margin-top:8px"><div class="k" style="color:var(--danger)">Repeat · ' + esc(s ? s.name : "") + (d.written_at ? " · " + fmtDay(d.written_at) : "") + '</div><div class="bk-row" style="margin-top:6px"><button class="btn small" data-bk="dup-keep" data-id="' + d.id + '">Not a repeat — keep both</button><button class="btn small" data-bk="dup-remove" data-id="' + d.id + '">Remove the repeat</button></div></div>'; }).join("") + "</div>";
      }).join("") + (keys.length > Math.ceil(S.shown / 3) ? '<div class="bk-more"><button class="btn" data-bk="more">Show more</button></div>' : "") : '<p class="bk-empty">No repeats found.</p>') + "</div></div>";
  }

  function viewNotes() {
    var chOpts = '<option value="">Whole book</option>' + S.chapters.slice().sort(function (a, b) { return a.position - b.position; }).map(function (c, i) { return '<option value="' + c.id + '">' + (i + 1) + ". " + esc(c.title.slice(0, 60)) + "</option>"; }).join("");
    var pre = S.notePassage && S.byId.get(S.notePassage);
    return '<div class="bk-work one"><div class="bk-panel"><h3>Research notes</h3><p class="sub">Scripture to check, sources to find, questions, facts to verify. Notes never enter the manuscript.</p>' +
      (pre ? '<blockquote class="bk-note" style="border-left:2px solid var(--gold-dim);padding-left:10px">On passage: ' + esc(pre.body.slice(0, 180)) + "…</blockquote>" : "") +
      '<form data-bk-form="note"><div class="bk-row"><label class="sr-only" for="nk">Kind</label><select id="nk" name="kind" class="bk-in" style="width:auto"><option value="research">Research</option><option value="question">Question</option><option value="idea">Idea</option><option value="verify">Verify</option></select><label class="sr-only" for="nc">Chapter</label><select id="nc" name="chapter" class="bk-in" style="width:auto;max-width:100%">' + chOpts + '</select></div><label class="sr-only" for="nb">Note</label><textarea id="nb" name="body" class="bk-ta" style="min-height:90px;font-family:var(--sans);font-size:15px;margin-top:8px" placeholder="What do you want to look into?" required>' + (pre && pre.seed ? esc(pre.seed) : "") + '</textarea><label class="sr-only" for="nu">Link</label><input id="nu" name="url" class="bk-in" placeholder="Link (optional)" style="margin-top:8px"><div class="bk-row" style="margin-top:8px"><button class="btn small solid">Save note</button></div></form></div>' +
      '<div class="bk-panel"><div class="bk-notes">' + (S.notes.length ? S.notes.map(function (n) { var c = n.chapter_id && S.chById.get(n.chapter_id); return '<div class="bk-noteitem"><div class="k">' + esc(n.kind) + (c ? " · " + esc(c.title) : "") + " · " + fmtDay(n.created_at) + '</div><p style="margin:6px 0;white-space:pre-wrap">' + esc(n.body) + "</p>" + (n.url && /^https?:\/\//i.test(n.url) ? '<a href="' + esc(n.url) + '" target="_blank" rel="noopener noreferrer">' + esc(n.url) + "</a>" : "") + '<div class="bk-row" style="margin-top:6px">' + (n.passage_id ? '<button class="btn small" data-bk="goto" data-id="' + n.passage_id + '">Open passage</button>' : "") + '<button class="btn small" data-bk="note-del" data-id="' + n.id + '">Delete</button></div></div>'; }).join("") : '<p class="bk-empty">No notes yet.</p>') + "</div></div></div>";
  }

  function viewSources() {
    return '<div class="bk-work one">' + importPanel(true) + '<div class="bk-panel"><h3>Sources</h3><p class="sub">Where every passage came from. Your words count only your own messages.</p>' +
      (S.sources.length ? S.sources.map(function (s) { var m = s.meta || {}; return '<div class="bk-rev"><div><b>' + esc(s.name) + '</b><div class="bk-note">' + esc(s.kind) + " · " + fmtN(s.words) + " of your words · " + fmtN(s.passages) + " passages" + (m.totalWords ? " · " + fmtN(m.totalWords) + " words in the file" : "") + (m.firstAt ? " · " + fmtDay(m.firstAt) + (m.lastAt && m.lastAt !== m.firstAt ? " – " + fmtDay(m.lastAt) : "") : "") + " · imported " + fmtDay(s.imported_at) + '</div></div><div class="bk-row"><button class="btn small" data-bk="src-filter" data-id="' + s.id + '">Show passages</button><button class="btn small" data-bk="src-del" data-id="' + s.id + '">Remove</button></div></div>'; }).join("") : '<p class="bk-empty">No sources yet.</p>') + "</div></div>";
  }

  function viewHistory() {
    return '<div class="bk-work one"><div class="bk-panel"><div class="bk-row"><h3 style="flex:1;margin:0">History</h3><form data-bk-form="rev" class="bk-row"><label class="sr-only" for="rl">Version name</label><input id="rl" name="label" class="bk-in" style="width:220px" placeholder="Name this version" maxlength="120"><button class="btn small solid">Save a version</button></form></div><p class="sub" style="margin-top:6px">A version keeps your chapter list and which passages sit where, in order. Big changes save one automatically.</p>' +
      (S.revisions.length ? S.revisions.map(function (r) { return '<div class="bk-rev"><div><b>' + esc(r.label) + '</b><div class="bk-note">' + new Date(r.created_at).toLocaleString() + " · " + (r.snapshot && r.snapshot.chapters ? r.snapshot.chapters.length : 0) + " chapters · " + fmtN(r.words) + ' words placed</div></div><button class="btn small" data-bk="restore" data-id="' + r.id + '">Restore</button></div>'; }).join("") : '<p class="bk-empty">No versions yet.</p>') + "</div></div>";
  }

  function viewExport() {
    var placed = S.passages.filter(function (p) { return p.chapter_id && p.speaker === "author"; });
    var w = placed.reduce(function (a, p) { return a + p.words; }, 0);
    return '<div class="bk-work one"><div class="bk-panel"><h3>Export manuscript</h3><p class="sub">Only the passages you placed in chapters, in your order, in your words. ' + fmtN(placed.length) + " passages · " + fmtN(w) + " words · ≈" + fmtN(Math.round(w / 275)) + " book pages.</p>" +
      '<label class="bk-row bk-help"><input type="checkbox" id="ex-parts" checked> Part headings</label><label class="bk-row bk-help"><input type="checkbox" id="ex-src" checked> Source notes (thread name and date for each passage)</label>' +
      '<label class="bk-help" for="ex-sub" style="display:block;margin-top:10px">Subtitle</label><input class="bk-in" id="ex-sub" data-bk-sub value="' + esc(S.book.subtitle || "") + '" maxlength="200">' +
      '<div class="bk-row" style="margin-top:14px"><button class="btn solid" data-bk="ex-docx"' + (placed.length ? "" : " disabled") + '>Download Word (.docx)</button><button class="btn" data-bk="ex-md"' + (placed.length ? "" : " disabled") + '>Download Markdown</button><button class="btn" data-bk="ex-outline">Copy outline</button></div>' +
      (placed.length ? "" : '<p class="bk-note" style="margin-top:10px">Place passages in chapters first (Outline → Accept suggested).</p>') + "</div>" +
      '<div class="bk-panel"><h3>Book settings</h3><label class="bk-help" for="bk-rename">Title</label><input class="bk-in" id="bk-rename" data-bk-rename value="' + esc(S.book.title) + '" maxlength="160"><div class="bk-row" style="margin-top:14px"><button class="btn small" data-bk="book-del">Delete this book</button><span class="bk-note">Deletes it from this device and your Passport. This cannot be undone.</span></div></div></div>';
  }

  function viewStudio(tab) {
    var b = S.book, ts = themes();
    var placed = S.passages.filter(function (p) { return p.chapter_id; }).length;
    var tabs = '<nav class="bk-tabs" aria-label="Book Studio">' + TABS.map(function (t) { return '<a href="#/book/' + b.id + "/" + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : "") + ">" + t[1] + "</a>"; }).join("") + '<span class="bk-sync" id="bk-sync"></span></nav>';
    var v = { passages: viewPassages, outline: viewOutline, timeline: viewTimeline, seeds: viewSeeds, dups: viewDups, notes: viewNotes, sources: viewSources, history: viewHistory, export: viewExport }[tab] || viewPassages;
    return scene("Dream Board · Book Studio", esc(b.title), b.subtitle ? esc(b.subtitle) : "Your words, organized — never ghostwritten. Every passage keeps its source and date.",
      [[fmtN(authorWords()), "your words"], [fmtN(S.passages.filter(function (p) { return p.speaker === "author"; }).length), "passages"], [fmtN(ts.length), "themes"], [fmtN(S.chapters.length), "chapters"], [fmtN(placed), "placed"]],
      '<a class="btn solid" href="#/book/' + b.id + '/sources">Add writing</a><button class="btn" data-bk="propose">Propose outline</button><a class="btn" href="#/book/' + b.id + '/export">Export manuscript</a><a class="btn" href="#/book">All books</a>') +
      busyBar() + tabs + v();
  }

  // ---------------- paint + events ----------------
  var painting = false;
  function paint() {
    if (!root || !root.isConnected) return;
    var r = route();
    var html = r.id && S.book ? viewStudio(r.tab) : viewLibrary();
    var main = ctx.shell('<div class="bk">' + html + "</div>", "book");
    var y = window.scrollY;
    root.innerHTML = main;
    if (paint.keep) window.scrollTo(0, y); paint.keep = false;
    paintSync(); bindDrop();
  }
  function repaint() { paint.keep = true; paint(); }

  async function mount(el, c) {
    ctx = c; root = el;
    var r = route();
    var key = (r.id || "") + "/" + r.tab;
    if (painting) return;
    painting = true;
    try {
      if (!r.id) { if (S.lastRoute.split("/")[0] || !S.loadedLib) { S.book = null; await loadLibrary(); S.loadedLib = true; } }
      else if (!S.book || S.book.id !== r.id) { if (!S.loadedLib) { await loadLibrary(); S.loadedLib = true; } await openBook(r.id); S.f = { q: "", theme: null, source: "", view: "all", chapter: null, month: null }; S.shown = 60; if (!S.book) { root.innerHTML = ctx.shell('<div class="wrap"><p class="err" style="margin-top:40px">That book is not on this device or your Passport.</p><a class="btn" href="#/book">All books</a></div>', "book"); return; } }
      if (S.lastRoute !== key) S.shown = 60;
      S.lastRoute = key;
      paint();
      scheduleSync(800);
    } catch (e) { root.innerHTML = ctx.shell('<div class="wrap"><p class="err" style="margin-top:40px">Book Studio could not open: ' + esc(e.message || e) + "</p></div>", "book"); }
    finally { painting = false; }
  }

  function inStudio(e) { return root && root.contains(e.target) && document.querySelector(".bk"); }
  document.addEventListener("click", async function (e) {
    if (!inStudio(e)) return;
    var el = e.target.closest("[data-bk]"); if (!el) return;
    var a = el.dataset.bk, id = el.dataset.id;
    try {
      if (a === "ch-pick") { e.preventDefault(); S.f.chapter = el.dataset.ch || null; S.f.view = "all"; S.shown = 60; if (route().tab !== "passages") { location.hash = "#/book/" + S.book.id + "/passages"; return; } return repaint(); }
      if (a === "theme") { var t = +el.dataset.t; S.f.theme = S.f.theme === t ? null : t; S.shown = 60; if (route().tab !== "passages") { location.hash = "#/book/" + S.book.id + "/passages"; return; } return repaint(); }
      if (a === "view") { S.f.view = el.dataset.v; return repaint(); }
      if (a === "more") { S.shown += 120; return repaint(); }
      if (a === "month") { S.f.month = el.dataset.m || null; S.shown = 60; return repaint(); }
      if (a === "open") { S.open = S.open === id ? null : id; S.sel = id; return repaint(); }
      if (a === "import-go") return doImport();
      if (a === "propose") { if (!S.book) return; await proposeOutline(); location.hash = "#/book/" + S.book.id + "/outline"; return repaint(); }
      if (a === "paste-outline") { S.pasting = true; return repaint(); }
      if (a === "paste-cancel") { S.pasting = false; return repaint(); }
      if (a === "paste-go") { var tx = document.getElementById("bk-outline-text").value; S.pasting = false; await pasteOutline(tx); return repaint(); }
      if (a === "add-ch") { var uid = ctx.user().id; var c = { id: uuid(), book_id: S.book.id, owner_id: uid, title: "New chapter", part: "", position: S.chapters.reduce(function (m, x) { return Math.max(m, x.position); }, 0) + 1, summary: "", keywords: [], created_at: now(), updated_at: now() }; S.chapters.push(c); reindex(); await saveChapters([c]); await touchBook(); return repaint(); }
      if (a === "ch-up" || a === "ch-down") { var chs = S.chapters.slice().sort(function (x, y) { return x.position - y.position; }); var i = chs.findIndex(function (x) { return x.id === el.dataset.ch; }); var j = a === "ch-up" ? i - 1 : i + 1; if (j < 0 || j >= chs.length) return; var tmp = chs[i]; chs[i] = chs[j]; chs[j] = tmp; chs.forEach(function (x, k) { x.position = k + 1; }); S.chapters = chs; await saveChapters(chs); await touchBook(); return repaint(); }
      if (a === "ch-del") { var cc = S.chById.get(el.dataset.ch); if (!confirm("Remove the chapter \"" + cc.title + "\"? Its passages go back to Unplaced; a version is saved first.")) return; await snapshot("Before removing \"" + cc.title + "\""); var back = S.passages.filter(function (p) { return p.chapter_id === cc.id || p.suggested_chapter_id === cc.id; }); back.forEach(function (p) { if (p.chapter_id === cc.id) { p.chapter_id = null; p.position = null; } if (p.suggested_chapter_id === cc.id) p.suggested_chapter_id = null; }); S.chapters = S.chapters.filter(function (x) { return x.id !== cc.id; }); reindex(); await savePassages(back); await delMany("chapters", [cc.id]); await queue("chapters", [cc.id], "del"); await touchBook(); if (S.f.chapter === cc.id) S.f.chapter = null; return repaint(); }
      if (a === "accept") { await acceptSuggestions(el.dataset.ch); return repaint(); }
      if (a === "accept-one") { var p1 = S.byId.get(id); await movePassage(id, p1.suggested_chapter_id); return repaint(); }
      if (a === "up" || a === "down") { var p2 = S.byId.get(id), list = chapterPassages(p2.chapter_id), ix = list.indexOf(p2), jx = a === "up" ? ix - 1 : ix + 1; if (jx < 0 || jx >= list.length) return; await movePassage(id, p2.chapter_id, a === "up" ? list[jx].id : (list[jx + 1] && list[jx + 1].id)); return repaint(); }
      if (a === "star") { var p3 = S.byId.get(id); p3.starred = !p3.starred; await savePassages([p3]); return repaint(); }
      if (a === "edit") { S.editing = id; return repaint(); }
      if (a === "edit-cancel") { S.editing = null; return repaint(); }
      if (a === "edit-save") { var p4 = S.byId.get(id), v = root.querySelector('[data-bk-edit="' + id + '"]').value; if (v.trim() && v !== p4.body) { if (!p4.original) p4.original = p4.body; p4.body = v; p4.words = words(v); p4._lc = null; await savePassages([p4]); await touchBook(); } S.editing = null; return repaint(); }
      if (a === "note-on" || a === "seed-note") { S.notePassage = id; location.hash = "#/book/" + S.book.id + "/notes"; return; }
      if (a === "goto") { var p5 = S.byId.get(id); if (!p5) return; S.f = { q: "", theme: null, source: "", view: p5.speaker === "author" ? (p5.dup_of ? "dups" : "all") : "ai", chapter: p5.chapter_id || null, month: null }; S.sel = id; S.open = id; var pos = filtered().indexOf(p5); S.shown = Math.max(60, pos + 10); location.hash = "#/book/" + S.book.id + "/passages"; setTimeout(function () { var n = root.querySelector('[data-pid="' + id + '"]'); if (n) n.scrollIntoView({ block: "center" }); }, 60); return; }
      if (a === "note-del") { if (!confirm("Delete this note?")) return; S.notes = S.notes.filter(function (n) { return n.id !== id; }); await delMany("notes", [id]); await queue("notes", [id], "del"); return repaint(); }
      if (a === "dup-keep") { var p6 = S.byId.get(id); p6.dup_of = null; p6.dup_kept = true; await savePassages([p6]); await touchBook(); return repaint(); }
      if (a === "dup-remove") { await removePassages([id]); return repaint(); }
      if (a === "dup-clear-all") { var ds = S.passages.filter(function (p) { return p.dup_of; }).map(function (p) { return p.id; }); if (!confirm("Remove all " + ds.length + " repeats? The first copy of each stays.")) return; await removePassages(ds); return repaint(); }
      if (a === "reanalyze") { await analyzeBook(); S.busy = null; return repaint(); }
      if (a === "restore") { await restore(id); return repaint(); }
      if (a === "src-filter") { S.f = { q: "", theme: null, source: id, view: "all", chapter: null, month: null }; location.hash = "#/book/" + S.book.id + "/passages"; return; }
      if (a === "src-del") { var s = S.srcById.get(id); var ps = S.passages.filter(function (p) { return p.source_id === id; }); if (!confirm("Remove \"" + s.name + "\" and its " + ps.length + " passages from this book? This cannot be undone.")) return; await removePassages(ps.map(function (p) { return p.id; })); S.sources = S.sources.filter(function (x) { return x.id !== id; }); reindex(); await delMany("sources", [id]); await queue("sources", [id], "del"); await touchBook(); return repaint(); }
      if (a === "write-new") { var body = prompt("Write a new passage in your own words:"); if (!body || !body.trim()) return; await addWritten(body, el.dataset.ch); return repaint(); }
      if (a === "ex-md" || a === "ex-docx") { var o = { parts: document.getElementById("ex-parts").checked, sources: document.getElementById("ex-src").checked }; if (a === "ex-md") download(new Blob([toMarkdown(o)], { type: "text/markdown" }), safeName(S.book.title) + ".md"); else download(toDocx(o), safeName(S.book.title) + ".docx"); toast("Manuscript downloaded."); return; }
      if (a === "ex-outline") { var txt = S.chapters.slice().sort(function (x, y) { return x.position - y.position; }).map(function (x, k) { return (k + 1) + ". " + x.title; }).join("\n"); try { await navigator.clipboard.writeText(txt); toast("Outline copied."); } catch (er) { prompt("Copy your outline:", txt); } return; }
      if (a === "book-del") { if (!confirm("Delete \"" + S.book.title + "\" from this device and your Passport? This cannot be undone.")) return; await deleteBook(); location.hash = "#/book"; return; }
    } catch (err) { S.busy = null; toast((err && err.message) || String(err), true); repaint(); }
  });
  document.addEventListener("change", async function (e) {
    if (!inStudio(e)) return;
    var t = e.target;
    try {
      if (t.id === "bk-src") { S.f.source = t.value; S.shown = 60; return repaint(); }
      if (t.id === "bk-view") { S.f.view = t.value; S.shown = 60; return repaint(); }
      if (t.dataset.bkMove) { await movePassage(t.dataset.bkMove, t.value || null); toast(t.value ? "Placed." : "Back to Unplaced."); return repaint(); }
      if (t.id === "bk-files") { document.getElementById("bk-picked").textContent = t.files.length + " file" + (t.files.length === 1 ? "" : "s") + " chosen · " + (Array.from(t.files).reduce(function (a, f) { return a + f.size; }, 0) / 1048576).toFixed(1) + " MB"; return; }
      if (t.dataset.bkTitle) { var c = S.chById.get(t.dataset.bkTitle); c.title = t.value.trim() || "Untitled chapter"; await saveChapters([c]); await touchBook(); return; }
      if (t.dataset.bkPart != null && t.dataset.bkPart !== undefined) { var c2 = S.chById.get(t.dataset.bkPart); c2.part = t.value.trim(); await saveChapters([c2]); await touchBook(); return; }
      if (t.hasAttribute("data-bk-rename")) { if (t.value.trim()) { await touchBook({ title: t.value.trim() }); toast("Renamed."); } return; }
      if (t.hasAttribute("data-bk-sub")) { await touchBook({ subtitle: t.value.trim() }); return; }
    } catch (err) { toast(err.message || String(err), true); }
  });
  var qTimer;
  document.addEventListener("input", function (e) {
    if (!inStudio(e) || e.target.id !== "bk-q") return;
    clearTimeout(qTimer); var v = e.target.value;
    qTimer = setTimeout(function () { S.f.q = v; S.shown = 60; repaint(); var q = document.getElementById("bk-q"); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } }, 220);
  });
  document.addEventListener("submit", async function (e) {
    if (!inStudio(e)) return;
    var f = e.target, kind = f.dataset.bkForm; if (!kind) return;
    e.preventDefault();
    var fd = new FormData(f);
    try {
      if (kind === "note") {
        var n = { id: uuid(), book_id: S.book.id, owner_id: ctx.user().id, chapter_id: fd.get("chapter") || null, passage_id: S.notePassage || null, kind: fd.get("kind"), body: String(fd.get("body")).trim(), url: String(fd.get("url") || "").trim() || null, created_at: now(), updated_at: now() };
        if (!n.body) return;
        S.notes.unshift(n); S.notePassage = null; await putMany("notes", [n]); await queue("notes", [n.id]); toast("Note saved."); return repaint();
      }
      if (kind === "rev") { await snapshot(String(fd.get("label") || "").trim() || "Saved version"); toast("Version saved."); return repaint(); }
    } catch (err) { toast(err.message || String(err), true); }
  });

  async function addWritten(body, chId) {
    var uid = ctx.user().id;
    var src = S.sources.find(function (s) { return s.kind === "studio"; });
    if (!src) { src = { id: uuid(), book_id: S.book.id, owner_id: uid, name: "Written in Book Studio", kind: "studio", words: 0, passages: 0, imported_at: now(), meta: {} }; S.sources.push(src); }
    var p = { id: uuid(), book_id: S.book.id, owner_id: uid, source_id: src.id, seq: S.passages.reduce(function (a, x) { return Math.max(a, x.seq); }, 0) + 1, body: body.trim(), words: words(body), written_at: now(), speaker: "author", theme: null, chapter_id: null, position: null, suggested_chapter_id: null, dup_of: null, seed: null, starred: false, original: null, updated_at: now() };
    src.words += p.words; src.passages++;
    S.passages.push(p); reindex();
    await putMany("sources", [src]); await queue("sources", [src.id]);
    await savePassages([p]);
    if (chId) await movePassage(p.id, chId); else await touchBook();
    toast("Passage saved in your words.");
  }
  async function removePassages(ids) {
    var set = new Set(ids);
    S.passages.forEach(function (p) { if (p.dup_of && set.has(p.dup_of)) p.dup_of = null; });
    S.passages = S.passages.filter(function (p) { return !set.has(p.id); }); reindex();
    for (var i = 0; i < ids.length; i += 2000) await delMany("passages", ids.slice(i, i + 2000));
    await queue("passages", ids, "del"); await touchBook();
  }
  async function deleteBook() {
    var id = S.book.id;
    for (var i = 0; i < STORES.length; i++) {
      var st = STORES[i];
      if (st === "books") continue;
      var rows = await getAll(st, id); await delMany(st, rows.map(function (r) { return r.id; }));
    }
    await delMany("books", [id]);
    await clearOutbox(Array.from(S.outbox.values()).filter(function (x) { return x.book === id; }).map(function (x) { return [x.key, null]; }));
    if (ctx.user()) { var r = await ctx.sb.from("dreamboard_books").delete().eq("id", id); if (r.error) toast("Removed here; your Passport copy could not be deleted: " + r.error.message, true); }
    S.book = null; S.books = S.books.filter(function (b) { return b.id !== id; }); S.cloudBooks = S.cloudBooks.filter(function (b) { return b.id !== id; }); S.loadedLib = false;
    toast("Book deleted.");
  }

  async function doImport() {
    var files = Array.from((document.getElementById("bk-files") || {}).files || []).concat(S.dropped || []);
    var pasted = (document.getElementById("bk-paste") || {}).value || "";
    var titleEl = document.getElementById("bk-title");
    var title = titleEl ? titleEl.value.trim() : "";
    if (!S.book && !title) { toast("Give your book a title first.", true); if (titleEl) titleEl.focus(); return; }
    var keepAI = !!(document.getElementById("bk-keepai") || {}).checked;
    var fresh = !S.book;
    if (fresh) { S.passages = []; S.chapters = []; S.sources = []; S.notes = []; S.revisions = []; }
    try {
      var b = await runImport(files, pasted, { title: title, keepAI: keepAI });
      S.dropped = [];
      if (b) { S.loadedLib = false; if (fresh) { location.hash = "#/book/" + b.id + "/passages"; return; } }
    } catch (err) { S.busy = null; if (fresh) S.book = null; toast("Import failed: " + (err.message || err), true); }
    repaint();
  }

  // drag & drop: passages → chapters (rail + outline cards), reorder inside a chapter, files → import zone
  var dragId = null;
  function bindDrop() {
    var dz = document.getElementById("bk-drop");
    if (dz && !dz._b) {
      dz._b = true;
      ["dragenter", "dragover"].forEach(function (t) { dz.addEventListener(t, function (e) { if (e.dataTransfer && Array.from(e.dataTransfer.types).indexOf("Files") >= 0) { e.preventDefault(); dz.classList.add("over"); } }); });
      dz.addEventListener("dragleave", function () { dz.classList.remove("over"); });
      dz.addEventListener("drop", function (e) { e.preventDefault(); dz.classList.remove("over"); S.dropped = (S.dropped || []).concat(Array.from(e.dataTransfer.files || [])); document.getElementById("bk-picked").textContent = S.dropped.length + " file" + (S.dropped.length === 1 ? "" : "s") + " ready · " + (S.dropped.reduce(function (a, f) { return a + f.size; }, 0) / 1048576).toFixed(1) + " MB"; });
    }
  }
  document.addEventListener("dragstart", function (e) { var c = e.target.closest && e.target.closest(".bk-card[draggable=true]"); if (!c) return; dragId = c.dataset.pid; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "passage:" + dragId); });
  document.addEventListener("dragend", function (e) { var c = e.target.closest && e.target.closest(".bk-card"); if (c) c.classList.remove("dragging"); dragId = null; document.querySelectorAll(".drop").forEach(function (x) { x.classList.remove("drop"); }); });
  document.addEventListener("dragover", function (e) {
    if (!dragId) return;
    var t = e.target.closest && (e.target.closest("[data-drop]") || (S.f.chapter && e.target.closest(".bk-card")));
    if (!t) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".drop").forEach(function (x) { if (x !== t) x.classList.remove("drop"); });
    t.classList.add("drop");
  });
  document.addEventListener("drop", async function (e) {
    if (!dragId) return;
    var zone = e.target.closest && e.target.closest("[data-drop]"), before = e.target.closest && e.target.closest(".bk-card");
    var id = dragId; dragId = null;
    try {
      if (zone) { e.preventDefault(); var ch = zone.dataset.drop === "none" ? null : zone.dataset.drop; await movePassage(id, ch); toast(ch ? "Placed in " + S.chById.get(ch).title + "." : "Back to Unplaced."); return repaint(); }
      if (before && S.f.chapter && before.dataset.pid !== id) { e.preventDefault(); await movePassage(id, S.f.chapter, before.dataset.pid); return repaint(); }
    } catch (err) { toast(err.message || String(err), true); }
  });
  window.addEventListener("online", function () { scheduleSync(500); });

  window.DBBook = { mount: mount, _S: S, _flush: pushAll, version: V };
})();
