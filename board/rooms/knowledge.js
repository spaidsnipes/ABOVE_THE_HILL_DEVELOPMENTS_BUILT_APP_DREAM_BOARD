/* Dream Board OS · Knowledge Vault (ported from the vault + Creation Journal parts of ~/dreamboard/app/page.tsx,
 * app/import-pipeline.tsx text extraction and app/organize.tsx + lib/organize.ts, 2026-11-12).
 * Notes, journals, research and imports live in dreamboard_vault_entries (owner RLS). Every saved entry also becomes a
 * private "source" node in the Creative Graph. Organize My Notes is deterministic (word recurrence, no AI) and only
 * proposes — nothing changes until the author approves a group. */
(function () {
  "use strict";
  var K = window.DBKit;
  var COLS = "id,title,content,source_type,status,tags,project_id,created_at,updated_at";
  var KINDS = [["manual", "Note"], ["journal", "Journal"], ["research", "Research"], ["import", "Imported"], ["google-drive", "Google Drive"], ["voice", "Voice"]];
  var STATUS = [["inbox", "Inbox"], ["organized", "Organized"], ["archived", "Archived"]];
  var CAP = 100000;
  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v; }
  function deriveTitle(c) { return (String(c).trim().split(/\n|\.|!/)[0].slice(0, 58).trim()) || "Untitled source"; }

  // ---- minimal ZIP reader for .docx (same approach as book-worker.js; runs on this device) ----
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  async function docxText(buf) {
    var b = new Uint8Array(buf), eocd = -1, dec = new TextDecoder();
    for (var i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("not a readable .docx");
    var n = u16(b, eocd + 10), off = u32(b, eocd + 16);
    for (var k = 0; k < n; k++) {
      if (u32(b, off) !== 0x02014b50) break;
      var method = u16(b, off + 10), csize = u32(b, off + 20), nlen = u16(b, off + 28), xlen = u16(b, off + 30), clen = u16(b, off + 32), lho = u32(b, off + 42);
      var name = dec.decode(b.subarray(off + 46, off + 46 + nlen));
      if (name === "word/document.xml") {
        var start = lho + 30 + u16(b, lho + 26) + u16(b, lho + 28), data = b.subarray(start, start + csize), xml;
        if (method === 0) xml = dec.decode(data);
        else if (method === 8) xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
        else throw new Error("unsupported compression");
        return window.BookEngine.docxXmlToText(xml);
      }
      off += 46 + nlen + xlen + clen;
    }
    throw new Error("word/document.xml missing — not a valid .docx");
  }
  function supportKind(name) {
    var ext = (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [, ""])[1];
    if (["txt", "md", "markdown", "text", "csv", "html", "htm", "json"].indexOf(ext) >= 0) return "text";
    if (ext === "docx") return "docx";
    if (ext === "pdf") return "PDF text extraction is not built yet.";
    if (["png", "jpg", "jpeg", "gif", "webp", "heic"].indexOf(ext) >= 0) return "Images need OCR, which Dream Board does not do yet.";
    if (["mp3", "wav", "m4a", "ogg", "mp4", "mov"].indexOf(ext) >= 0) return "Audio/video transcription is not built yet.";
    if (ext === "doc") return "Legacy .doc is not supported — save it as .docx.";
    return "No text extractor for this file type yet.";
  }

  // ---- Organize My Notes (deterministic; lib/organize.ts rules, BookEngine tokens/duplicates/keySentences) ----
  function analyze(notes) {
    var E = window.BookEngine, wordTo = new Map();
    notes.forEach(function (n) {
      new Set(E.tokens(n.title + " " + n.content)).forEach(function (w) { if (w.length < 4) return; if (!wordTo.has(w)) wordTo.set(w, new Set()); wordTo.get(w).add(n.id); });
    });
    var cands = Array.from(wordTo.entries()).filter(function (x) { return x[1].size >= 2; }).sort(function (a, b) { return b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1); }).slice(0, 8);
    var assigned = new Set(), clusters = [], byId = new Map(notes.map(function (n) { return [n.id, n]; }));
    cands.forEach(function (c) {
      var members = Array.from(c[1]).filter(function (id) { return !assigned.has(id); });
      if (members.length < 2) return;
      members.forEach(function (id) { assigned.add(id); });
      var key = E.keySentences(members.map(function (id) { return byId.get(id).content; }), [c[0]], 1)[0] || "";
      clusters.push({ keyword: c[0], label: c[0].charAt(0).toUpperCase() + c[0].slice(1), ids: members, key: key });
    });
    var dups = [], seen = new Set();
    var dupOf = E.findDuplicates(notes.map(function (n) { return n.title + "\n" + n.content; }));
    for (var i = 0; i < notes.length; i++) {
      if (dupOf[i] >= 0) { var k1 = notes[dupOf[i]].id + notes[i].id; if (!seen.has(k1)) { seen.add(k1); dups.push([notes[dupOf[i]].id, notes[i].id]); } }
      for (var j = i + 1; j < notes.length; j++) if (notes[i].title.trim().toLowerCase() === notes[j].title.trim().toLowerCase()) { var k2 = notes[i].id + notes[j].id; if (!seen.has(k2)) { seen.add(k2); dups.push([notes[i].id, notes[j].id]); } }
    }
    var questions = notes.filter(function (n) { return /\?\s*$/m.test(n.content) || /\?\s*$/.test(n.title); }).map(function (n) { return n.id; });
    return { clusters: clusters, dups: dups, questions: questions, analyzed: notes.length };
  }

  K.css("knowledge", [
    ".kv-item{display:grid;gap:6px}",
    ".kv-item .body{margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--serif);font-size:16px;line-height:1.5;color:var(--cream);display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}",
    ".kv-item.open .body{display:block}",
    ".kv-tags{display:flex;flex-wrap:wrap;gap:5px}",
    ".kv-tags b{font-weight:400;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid rgba(217,181,108,.3);color:var(--gold-hi)}",
    ".kv-list{display:grid;gap:12px}",
    ".kv-org{border-color:rgba(243,217,150,.45)}",
    ".kv-cl{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:10px;border-radius:12px;border:1px solid rgba(217,181,108,.2);background:rgba(4,8,6,.45);cursor:pointer}",
    ".kv-cl input{width:20px;height:20px;margin-top:2px;accent-color:#d9b56c}",
    ".kv-cl small{display:block;color:var(--muted);font-size:12px;margin-top:2px;word-break:break-word}",
    ".kv-cl q{display:block;margin-top:6px;font-family:var(--serif);font-size:15px;color:var(--cream-dim)}",
    ".kv-det{display:inline-block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#1b1407;background:var(--gold);padding:2px 8px;border-radius:999px}",
    ".kv-focus{box-shadow:0 0 0 2px var(--gold-hi),0 0 26px rgba(243,217,150,.25)}",
    ".kv-tabs{display:flex;gap:6px;flex-wrap:wrap}",
    "@media (min-width:980px){.kv-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}}",
    ".kv-two{display:grid;gap:18px}"
  ].join("\n"));

  DBRoom.register("knowledge", {
    mount: async function (el) {
      var S = { rows: [], nodeFor: new Set(), q: "", kind: "", st: "active", mode: "manual", editing: null, open: new Set(), org: null, approved: new Set(), setup: false, importing: null, focus: null, graphOk: true };
      try { var fx = JSON.parse(sessionStorage.getItem("dbos-focus") || "null"); if (fx && fx.room === "knowledge") { S.focus = fx.id; S.open.add(fx.id); sessionStorage.removeItem("dbos-focus"); } } catch (e) {}

      async function load() {
        try { S.rows = await K.q(K.sb.from("dreamboard_vault_entries").select(COLS).order("updated_at", { ascending: false }).limit(500)); }
        catch (e) { if (K.missingTable(e)) S.setup = true; else K.toast("Could not open your Knowledge Vault: " + (e.message || e), true); return; }
        try { var ns = await K.q(K.sb.from("dreamboard_graph_nodes").select("vault_entry_id").not("vault_entry_id", "is", null).limit(2000)); S.nodeFor = new Set(ns.map(function (n) { return n.vault_entry_id; })); }
        catch (e) { S.graphOk = false; }
      }
      function row(id) { for (var i = 0; i < S.rows.length; i++) if (S.rows[i].id === id) return S.rows[i]; return null; }
      function visible() {
        var q = S.q.toLowerCase();
        return S.rows.filter(function (r) { return S.st === "active" ? r.status !== "archived" : r.status === S.st; })
          .filter(function (r) { return !S.kind || r.source_type === S.kind; })
          .filter(function (r) { return !q || (r.title + " " + r.content + " " + (r.tags || []).join(" ")).toLowerCase().indexOf(q) >= 0; });
      }

      async function addNode(r) {
        if (!S.graphOk || S.nodeFor.has(r.id)) return;
        try { await K.insert("dreamboard_graph_nodes", { vault_entry_id: r.id, node_type: "source", label: r.title.slice(0, 160), description: (r.content || "").slice(0, 360), project_id: r.project_id || null }); S.nodeFor.add(r.id); }
        catch (e) { K.toast("Saved, but the graph node could not be added: " + (e.message || e), true); }
      }
      async function save(body, kind, title, tags) {
        var clean = String(body || "").trim(); if (!clean) return null;
        var r = await K.q(K.sb.from("dreamboard_vault_entries").insert({ owner_id: K.uid(), title: (title || deriveTitle(clean)).slice(0, 240), content: clean.slice(0, CAP), source_type: kind, tags: tags || ["Unsorted"] }).select(COLS).single());
        S.rows.unshift(r); await addNode(r); return r;
      }

      function itemHtml(r, i) {
        var e = K.esc;
        if (S.editing === r.id) return '<article class="rm-item kv-item" data-id="' + r.id + '"><label class="rm-l" for="kv-et">Title</label><input id="kv-et" class="bk-in" maxlength="240" value="' + e(r.title) + '"><label class="rm-l" for="kv-ec">Your words</label><textarea id="kv-ec" class="bk-ta">' + e(r.content) + '</textarea><label class="rm-l" for="kv-eg">Tags (comma separated)</label><input id="kv-eg" class="bk-in" value="' + e((r.tags || []).join(", ")) + '"><div class="rm-row"><button class="btn small solid" data-a="save">Save</button><button class="btn small" data-a="cancel">Cancel</button></div></article>';
        var long = (r.content || "").length > 420;
        return '<article class="rm-item kv-item' + (S.open.has(r.id) ? " open" : "") + (S.focus === r.id ? " kv-focus" : "") + '" data-id="' + r.id + '" id="kv-' + r.id + '">' +
          '<div class="rm-meta">' + e(label(KINDS, r.source_type)) + " · " + K.fmtDay(r.created_at) + " · " + K.fmtN(K.words(r.content)) + " words" + (r.status !== "inbox" ? " · " + e(label(STATUS, r.status)) : "") + (S.nodeFor.has(r.id) ? " · in your graph" : "") + "</div>" +
          "<h4>" + e(r.title) + "</h4>" + (r.content ? '<p class="body">' + e(r.content) + "</p>" : "") +
          '<div class="kv-tags">' + (r.tags || []).map(function (t) { return "<b>" + e(t) + "</b>"; }).join("") + "</div>" +
          '<div class="rm-row">' + (long ? '<button class="btn small" data-a="more">' + (S.open.has(r.id) ? "Less" : "Read all") + "</button>" : "") +
          '<button class="btn small" data-a="edit">Edit</button>' +
          (r.status === "archived" ? '<button class="btn small" data-a="unarchive">Restore</button><button class="btn small" data-a="delete">Delete</button>' : '<button class="btn small" data-a="archive">Archive</button>') +
          (S.graphOk ? (S.nodeFor.has(r.id) ? '<a class="btn small" href="#/r/graph">Open graph</a>' : '<button class="btn small" data-a="node">Add to graph</button>') : "") + "</div></article>";
      }

      function orgHtml() {
        if (!S.org) return "";
        var e = K.esc, P = S.org, byId = new Map(S.rows.map(function (r) { return [r.id, r]; }));
        function t(id, n) { var r = byId.get(id); return "“" + e(((r && r.title) || "").slice(0, n || 40)) + "”"; }
        var cl = P.clusters.length ? '<div class="rm-form">' + P.clusters.map(function (c) {
          return '<label class="kv-cl"><input type="checkbox" data-k="' + e(c.keyword) + '"' + (S.approved.has(c.keyword) ? " checked" : "") + "><span><b>" + e(c.label) + "</b><small>" + c.ids.length + " notes share this word: " + c.ids.slice(0, 4).map(function (id) { return t(id, 34); }).join(", ") + (c.ids.length > 4 ? "…" : "") + "</small>" + (c.key ? "<q>" + e(c.key) + "</q>" : "") + "</span></label>";
        }).join("") + "</div>" : '<p class="bk-help">No recurring themes found yet — usually the notes are still too few or too different. Nothing was changed.</p>';
        var dup = P.dups.length ? '<h4 style="margin:14px 0 4px;font-family:var(--serif);font-weight:500;color:var(--gold-hi)">Possible duplicates · review yourself</h4>' + P.dups.slice(0, 6).map(function (d) { return '<p class="bk-help" style="margin:4px 0">' + t(d[0]) + " and " + t(d[1]) + " look very similar. Dream Board never deletes — merge them yourself if they are the same.</p>"; }).join("") : "";
        var qs = P.questions.length ? '<h4 style="margin:14px 0 4px;font-family:var(--serif);font-weight:500;color:var(--gold-hi)">Open questions in your own words</h4><p class="bk-help">' + P.questions.slice(0, 8).map(function (id) { return t(id, 44); }).join(" · ") + "</p>" : "";
        var any = P.clusters.some(function (c) { return S.approved.has(c.keyword); });
        return K.panel("Organize My Notes · a proposal, not a decision",
          '<span class="kv-det">Deterministic rules · no AI ran</span> Dream Board read ' + P.analyzed + " note" + (P.analyzed === 1 ? "" : "s") + " on this device using word-recurrence rules. The quoted line under each group is your own sentence. Approve the groups you agree with — original tags are kept, and nothing changes until you apply.",
          cl + dup + qs + '<div class="rm-row" style="margin-top:14px"><button class="btn solid" data-a="org-apply"' + (any ? "" : " disabled") + '>Apply approved themes</button><button class="btn" data-a="org-close">Close without changes</button></div><p class="rm-meta" style="margin-top:8px">Approved theme tags are added alongside existing tags; “Unsorted” is removed only from themed notes, and they move from Inbox to Organized.</p>', "kv-org");
      }

      function listHtml() { var v = visible(); return v.length ? '<div class="kv-list">' + v.map(itemHtml).join("") + "</div>" : '<div class="bk-empty" style="padding:22px 8px">' + (S.rows.length ? "Nothing matched that view. Your original material remains safe in the vault." : "Your Knowledge Vault is empty. Write a note, keep a journal entry, or import a file — it stays private to your Passport.") + "</div>"; }

      function paint() {
        var e = K.esc, total = S.rows.filter(function (r) { return r.status !== "archived"; }).length;
        var head = K.scene("Knowledge Vault · your source library", "Everything you know, still yours.",
          total ? K.fmtN(total) + " piece" + (total === 1 ? "" : "s") + " of material — notes, journals, research and imports. Each one is also a private source in your Creative Graph." : "Notes, journals, research and imports. Every entry is private to your Passport and becomes a source node in your Creative Graph.",
          "art-orchard.jpg", '<button class="btn solid" data-a="org">Organize my notes</button><a class="btn" href="#/r/graph">Creative Graph</a><a class="btn" href="#/r/search">Search everything</a>');
        if (S.setup) { el.innerHTML = head + '<div class="bk-work one">' + K.setupNotice("Knowledge Vault", "supabase/dreamboard-core-schema.sql") + "</div>"; return; }
        var tabs = [["manual", "Note"], ["journal", "Journal"], ["research", "Research"]];
        var writeP = K.panel(S.mode === "journal" ? "Creation Journal · " + new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : S.mode === "research" ? "Research note" : "New note",
          S.mode === "journal" ? "Leave a note for your future self. The journal is private source material, not a public performance." : "Your words, saved exactly as written.",
          '<div class="kv-tabs" role="group" aria-label="Kind of entry">' + tabs.map(function (t) { return '<button class="bk-chip" data-mode="' + t[0] + '" aria-pressed="' + (S.mode === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>" +
          '<div class="rm-form" style="margin-top:10px"><label class="rm-l" for="kv-new">' + (S.mode === "journal" ? "Today, I want to remember…" : "Your note") + '</label><textarea id="kv-new" class="bk-ta" placeholder="' + (S.mode === "journal" ? "Today, I want to remember…" : "A story, a reflection, a source worth keeping…") + '"></textarea><div class="rm-row"><span class="spacer"></span><button class="btn solid" data-a="add">Keep this ' + (S.mode === "journal" ? "entry" : "note") + "</button></div></div>");
        var importP = K.panel("Import text", "Plain text, Markdown and Word (.docx) are read in your browser — the text becomes vault entries. PDFs, images and audio are honestly skipped until their extractors ship. For whole archives and ChatGPT or Grok exports, use Book Studio.",
          '<div class="bk-drop" id="kv-drop"><h4>Drop files here</h4><label class="btn solid" for="kv-files" style="cursor:pointer">Choose files</label><input id="kv-files" type="file" multiple accept=".txt,.md,.markdown,.docx,.csv,.html,.htm,.json,text/plain,text/markdown" hidden><p class="bk-note" id="kv-imp" style="margin:10px 0 0">' + e(S.importing || "") + "</p></div>" +
          '<div class="rm-form" style="margin-top:12px"><label class="rm-l" for="kv-paste">Or paste text</label><textarea id="kv-paste" class="bk-ta" style="min-height:90px" placeholder="Paste source material…"></textarea><div class="rm-row"><span class="spacer"></span><button class="btn" data-a="paste">Add pasted text</button></div></div>');
        var kinds = S.rows.reduce(function (m, r) { m[r.source_type] = (m[r.source_type] || 0) + 1; return m; }, {});
        var filters = '<div class="bk-chips"><button class="bk-chip" data-kind="" aria-pressed="' + (!S.kind) + '">All kinds</button>' + KINDS.filter(function (k) { return kinds[k[0]]; }).map(function (k) { return '<button class="bk-chip" data-kind="' + k[0] + '" aria-pressed="' + (S.kind === k[0]) + '">' + k[1] + " · " + kinds[k[0]] + "</button>"; }).join("") + "</div>" +
          '<div class="bk-filter"><input type="search" id="kv-q" placeholder="Search your stories, research, reflections and journal entries" aria-label="Search the vault" value="' + e(S.q) + '"><select id="kv-st" aria-label="Status"><option value="active"' + (S.st === "active" ? " selected" : "") + '>Inbox + organized</option><option value="inbox"' + (S.st === "inbox" ? " selected" : "") + '>Inbox</option><option value="organized"' + (S.st === "organized" ? " selected" : "") + '>Organized</option><option value="archived"' + (S.st === "archived" ? " selected" : "") + ">Archived</option></select></div>";
        el.innerHTML = head + '<div class="bk-work one"><div id="kv-org">' + orgHtml() + '</div><div class="kv-two">' + writeP + importP + "</div>" +
          K.panel("Your material", (S.graphOk ? "" : "The Creative Graph is not reachable, so graph links are hidden. ") + "Archive keeps an entry out of the way; delete removes it for good.", filters + '<div id="kv-list">' + listHtml() + "</div>") + "</div>";
        if (S.focus) { var f = document.getElementById("kv-" + S.focus); if (f) f.scrollIntoView({ block: "center" }); S.focus = null; }
      }
      function paintList() { var b = el.querySelector("#kv-list"); if (b) b.innerHTML = listHtml(); else paint(); }
      function paintOrg() { var b = el.querySelector("#kv-org"); if (b) b.innerHTML = orgHtml(); }

      async function patch(id, p) {
        p.updated_at = new Date().toISOString();
        try { var saved = await K.q(K.sb.from("dreamboard_vault_entries").update(p).eq("id", id).select(COLS).single()); S.rows = S.rows.map(function (r) { return r.id === id ? saved : r; }); return saved; }
        catch (e) { K.toast("That change could not be saved: " + (e.message || e), true); return null; }
      }
      async function importFiles(files) {
        var ok = 0, skipped = [], failed = 0, list = Array.prototype.slice.call(files || []);
        if (!list.length) return;
        if (list.some(function (f) { return supportKind(f.name) === "docx"; })) { try { await K.script("book-engine.js?v=1112c"); } catch (e) { K.toast(e.message, true); return; } }
        for (var i = 0; i < list.length; i++) {
          var f = list[i], kind = supportKind(f.name);
          S.importing = "Reading " + (i + 1) + " of " + list.length + ": " + f.name; var p = el.querySelector("#kv-imp"); if (p) p.textContent = S.importing;
          if (kind !== "text" && kind !== "docx") { skipped.push(f.name + " — " + kind); continue; }
          try {
            var text = kind === "docx" ? await docxText(await f.arrayBuffer()) : (await f.text()).trim();
            if (!text) throw new Error("no text");
            await save(text, "import", f.name.slice(0, 240), ["Imported"]); ok++;
          } catch (e) { failed++; skipped.push(f.name + " — " + (e.message || "could not be read")); }
        }
        S.importing = ok + " imported" + (failed ? ", " + failed + " failed" : "") + (skipped.length ? ". Skipped: " + skipped.join("; ") : ".");
        paint(); K.toast(ok ? ok + " file" + (ok === 1 ? "" : "s") + " added to your Knowledge Vault." : "Nothing was imported.", !ok);
      }

      el.addEventListener("input", function (ev) { if (ev.target.id === "kv-q") { S.q = ev.target.value; paintList(); } });
      el.addEventListener("change", function (ev) {
        if (ev.target.id === "kv-st") { S.st = ev.target.value; paintList(); }
        else if (ev.target.id === "kv-files") importFiles(ev.target.files);
        else if (ev.target.dataset.k) { if (ev.target.checked) S.approved.add(ev.target.dataset.k); else S.approved.delete(ev.target.dataset.k); var b = el.querySelector('[data-a="org-apply"]'); if (b) b.disabled = !S.org.clusters.some(function (c) { return S.approved.has(c.keyword); }); }
      });
      el.addEventListener("dragover", function (ev) { var d = ev.target.closest("#kv-drop"); if (d) { ev.preventDefault(); d.classList.add("over"); } });
      el.addEventListener("dragleave", function (ev) { var d = ev.target.closest("#kv-drop"); if (d) d.classList.remove("over"); });
      el.addEventListener("drop", function (ev) { var d = ev.target.closest("#kv-drop"); if (d) { ev.preventDefault(); d.classList.remove("over"); importFiles(ev.dataTransfer.files); } });
      el.addEventListener("click", async function (ev) {
        var m = ev.target.closest("[data-mode]"); if (m) { S.mode = m.dataset.mode; paint(); return; }
        var kd = ev.target.closest("[data-kind]"); if (kd) { S.kind = kd.dataset.kind; paint(); return; }
        var b = ev.target.closest("button[data-a]"); if (!b) return;
        var a = b.dataset.a;
        if (a === "add" || a === "paste") {
          var ta = el.querySelector(a === "add" ? "#kv-new" : "#kv-paste"); if (!ta.value.trim()) { ta.focus(); return; }
          b.disabled = true;
          try { await save(ta.value, a === "paste" ? "import" : S.mode, null, a === "paste" ? ["Imported"] : ["Unsorted"]); ta.value = ""; paint(); K.toast(S.mode === "journal" && a === "add" ? "Your journal entry is in the vault as source material." : "Saved to your private Knowledge Vault and your Creative Graph."); }
          catch (e) { b.disabled = false; K.toast("Could not save: " + (e.message || e), true); }
          return;
        }
        if (a === "org") {
          try { await K.script("book-engine.js?v=1112c"); } catch (e) { K.toast(e.message, true); return; }
          S.org = analyze(S.rows.filter(function (r) { return r.status !== "archived"; }));
          S.approved = new Set(S.org.clusters.map(function (c) { return c.keyword; }));
          paintOrg(); var o = el.querySelector("#kv-org"); if (o) o.scrollIntoView({ block: "start", behavior: "smooth" });
          K.toast("Review the proposed themes. Nothing changes until you approve."); return;
        }
        if (a === "org-close") { S.org = null; paintOrg(); return; }
        if (a === "org-apply") {
          b.disabled = true; var n = 0, fail = 0;
          for (var ci = 0; ci < S.org.clusters.length; ci++) {
            var c = S.org.clusters[ci]; if (!S.approved.has(c.keyword)) continue;
            for (var k = 0; k < c.ids.length; k++) {
              var r0 = row(c.ids[k]); if (!r0) continue;
              var tags = Array.from(new Set((r0.tags || []).filter(function (t) { return t !== "Unsorted"; }).concat([c.label])));
              var res = await patch(r0.id, r0.status === "inbox" ? { tags: tags, status: "organized" } : { tags: tags });
              if (res) n++; else fail++;
            }
          }
          S.org = null; paint(); K.toast(n + " note" + (n === 1 ? "" : "s") + " themed — approved by you" + (fail ? "; " + fail + " could not be saved." : "."), !!fail); return;
        }
        var host = b.closest("[data-id]"); var r = host && row(host.dataset.id); if (!r) return;
        if (a === "more") { if (S.open.has(r.id)) S.open.delete(r.id); else S.open.add(r.id); paintList(); }
        else if (a === "edit") { S.editing = r.id; paintList(); }
        else if (a === "cancel") { S.editing = null; paintList(); }
        else if (a === "save") {
          var tg = el.querySelector("#kv-eg").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 30);
          if (await patch(r.id, { title: el.querySelector("#kv-et").value.trim().slice(0, 240) || "Untitled source", content: el.querySelector("#kv-ec").value.slice(0, CAP), tags: tg })) { S.editing = null; paintList(); K.toast("Saved."); }
        }
        else if (a === "archive") { if (await patch(r.id, { status: "archived" })) { paintList(); K.toast("Archived. Find it under the Archived filter."); } }
        else if (a === "unarchive") { if (await patch(r.id, { status: "inbox" })) { paintList(); K.toast("Restored to your inbox."); } }
        else if (a === "node") { await addNode(r); paintList(); if (S.nodeFor.has(r.id)) K.toast("Added to your Creative Graph as a source."); }
        else if (a === "delete") {
          if (!confirm("Permanently delete “" + r.title + "”? Its source node in your Creative Graph is removed too. This cannot be undone.")) return;
          try {
            if (S.graphOk) await K.q(K.sb.from("dreamboard_graph_nodes").delete().eq("vault_entry_id", r.id));
            await K.remove("dreamboard_vault_entries", r.id);
            S.rows = S.rows.filter(function (x) { return x.id !== r.id; }); S.nodeFor.delete(r.id); paintList(); K.toast("Deleted for good.");
          } catch (e) { K.toast("Could not delete: " + (e.message || e), true); }
        }
      });

      await load();
      paint();
    }
  });
})();
