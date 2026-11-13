/* Dream Board OS · Writing Studio (ported from ~/dreamboard app/writing-studio.tsx and the writer/version parts of
 * app/page.tsx: draft, autosave, word count, focus mode, ⌘S version, Version History compare/restore, Markdown export,
 * Ask AI → append only on click). 2026-11-12.
 * Rows: dreamboard_writing_documents, dreamboard_document_versions. "Send to Book Studio" writes one author passage into
 * a chosen dreamboard_books book (studio source + passage, same owner_id + book_id). Spaidbot only suggests. */
(function () {
  "use strict";
  var K = window.DBKit, esc = K.esc;
  var SPAIDBOT = "https://mission.abovethehilldev.online/api/spaidbot";

  K.css("writing", [
    ".ws-work{display:grid;grid-template-columns:260px minmax(0,1fr) 320px;gap:18px;padding:18px clamp(12px,3vw,40px) 40px;align-items:start}",
    ".ws-docs{display:grid;gap:6px}",
    ".ws-doc{all:unset;box-sizing:border-box;cursor:pointer;display:block;padding:9px 11px;border-radius:12px;border:1px solid transparent;color:var(--cream)}",
    ".ws-doc:hover{background:rgba(217,181,108,.08)} .ws-doc:focus-visible{outline:2px solid var(--gold-hi)}",
    ".ws-doc[aria-current=true]{background:rgba(217,181,108,.14);border-color:var(--gold-dim)}",
    ".ws-doc b{display:block;font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".ws-doc span{font-size:11px;color:var(--muted)}",
    ".ws-head{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:8px;margin-bottom:8px}",
    ".ws-title{font-family:var(--serif);font-size:24px !important}",
    ".ws-ed{width:100%;box-sizing:border-box;min-height:58vh;resize:vertical;background:rgba(250,240,214,.035);border:1px solid rgba(217,181,108,.22);border-radius:14px;padding:18px clamp(14px,3vw,34px);color:var(--cream);font-family:var(--serif);font-size:20px;line-height:1.7}",
    ".ws-ed:focus{outline:none;border-color:var(--gold-dim);box-shadow:0 0 0 1px var(--gold-dim)}",
    ".ws-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;font-size:12px;color:var(--muted)}",
    ".ws-bar .sp{flex:1}",
    ".ws-ver{padding:10px 0;border-bottom:1px solid rgba(217,181,108,.12)}",
    ".ws-ver b{display:block;font-weight:500;font-size:14px;overflow-wrap:anywhere}",
    ".ws-diff{font-family:var(--serif);font-size:17px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;max-height:60vh;overflow:auto;padding:12px;border-radius:12px;background:rgba(4,8,6,.5)}",
    ".ws-diff ins{text-decoration:none;background:rgba(159,211,166,.22);color:#cfeccf;border-radius:3px}",
    ".ws-diff del{background:rgba(229,154,134,.2);color:#f0c2b6;border-radius:3px}",
    ".ws-ai{white-space:pre-wrap;font-family:var(--serif);font-size:16px;line-height:1.5;margin:8px 0;overflow-wrap:anywhere}",
    ".ws-eye{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:14px 0 6px}",
    ".room.ws-focus .bk-scene,.room.ws-focus .ws-rail,.room.ws-focus .ws-side{display:none}",
    ".room.ws-focus .ws-work{grid-template-columns:minmax(0,860px);justify-content:center}",
    ".room.ws-focus .ws-ed{min-height:78vh;background:transparent;border-color:transparent}",
    "@media (max-width:1180px){.ws-work{grid-template-columns:240px minmax(0,1fr)}.ws-side{grid-column:1/-1}}",
    "@media (max-width:820px){.ws-work{grid-template-columns:minmax(0,1fr);padding:12px 16px 28px}.ws-docs{display:flex;overflow-x:auto;gap:8px;scrollbar-width:none}.ws-doc{flex:0 0 170px;border-color:rgba(217,181,108,.2);background:rgba(4,8,6,.5)}.ws-ed{min-height:50vh;font-size:18px}}"
  ].join("\n"));

  // ---- deterministic word-level diff (LCS over words; common prefix/suffix trimmed; falls back to lines when huge) ----
  function tokens(s) { return String(s || "").match(/\s+|[^\s]+/g) || []; }
  function diff(a, b) {
    var A = tokens(a), B = tokens(b), pre = 0, suf = 0;
    while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
    while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
    var a2 = A.slice(pre, A.length - suf), b2 = B.slice(pre, B.length - suf), unit = "word";
    if (a2.length * b2.length > 6e6) { a2 = a2.join("").split(/(\n)/); b2 = b2.join("").split(/(\n)/); unit = "line"; }
    var n = a2.length, m = b2.length, out = [];
    if (n * m > 6e6) { out.push(["-", a2.join("")], ["+", b2.join("")]); unit = "block"; }
    else {
      var W = m + 1, L = new Uint32Array((n + 1) * W);
      for (var i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) L[i * W + j] = a2[i] === b2[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
      i = 0; j = 0;
      while (i < n && j < m) { if (a2[i] === b2[j]) { out.push(["=", a2[i]]); i++; j++; } else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) out.push(["-", a2[i++]]); else out.push(["+", b2[j++]]); }
      while (i < n) out.push(["-", a2[i++]]); while (j < m) out.push(["+", b2[j++]]);
    }
    var head = A.slice(0, pre).join(""), tail = A.slice(A.length - suf).join("");
    var html = esc(head) + out.map(function (o) { return o[0] === "=" ? esc(o[1]) : o[0] === "+" ? "<ins>" + esc(o[1]) + "</ins>" : "<del>" + esc(o[1]) + "</del>"; }).join("") + esc(tail);
    var added = 0, removed = 0; out.forEach(function (o) { if (o[0] === "+") added += K.words(o[1]); if (o[0] === "-") removed += K.words(o[1]); });
    return { html: html, added: added, removed: removed, unit: unit };
  }

  DBRoom.register("writing", {
    mount: async function (el) {
      var sb = K.sb;
      var S = { docs: [], projects: [], settings: {}, books: [], primary: null, filter: "all", cur: null, versions: [], cmpA: "", cmpB: "current", diff: null, ai: null, aiBusy: false, saveState: "saved", focus: false, miss: {} };
      async function soft(pr, key) { try { return await K.q(pr); } catch (e) { if (K.missingTable(e)) { S.miss[key] = true; return []; } throw e; } }

      el.innerHTML = K.scene("Dream Board OS · Create", "Writing Studio", "Opening your desk…", "art-book-studio.jpg");
      var r = await Promise.all([
        K.q(sb.from("dreamboard_writing_documents").select("id,project_id,title,chapter_number,body,created_at,updated_at").order("updated_at", { ascending: false }).limit(500)),
        K.q(sb.from("dreamboard_projects").select("id,title").order("updated_at", { ascending: false })),
        soft(sb.from("dreamboard_project_settings").select("project_id,status,ai_instructions,writing_voice"), "settings"),
        soft(sb.from("dreamboard_books").select("id,title,words").order("updated_at", { ascending: false }), "books"),
        soft(sb.from("dreamboard_active_context").select("primary_id").limit(1), "ctx")
      ]);
      S.docs = r[0]; S.projects = r[1]; r[2].forEach(function (s) { S.settings[s.project_id] = s; }); S.books = r[3];
      S.primary = r[4][0] && r[4][0].primary_id;
      if (S.primary && S.docs.some(function (d) { return d.project_id === S.primary; })) S.filter = S.primary;
      var deep = location.hash.split("/")[2];
      function vis() { return S.docs.filter(function (d) { return S.filter === "all" || (S.filter === "none" ? !d.project_id : d.project_id === S.filter); }); }
      S.cur = (deep && S.docs.filter(function (d) { return d.id === deep; })[0]) || vis()[0] || null;
      function pname(id) { var p = S.projects.filter(function (x) { return x.id === id; })[0]; return p ? p.title : ""; }

      async function loadVersions() { S.versions = S.cur ? await K.list("dreamboard_document_versions", { select: "id,label,body,word_count,created_at", eq: { document_id: S.cur.id }, order: "created_at" }) : []; S.diff = null; S.cmpA = S.versions[0] ? S.versions[0].id : ""; S.cmpB = "current"; }
      await loadVersions();

      function rail() {
        var popts = '<option value="all">All documents</option><option value="none"' + (S.filter === "none" ? " selected" : "") + ">No project</option>" + S.projects.map(function (p) { return '<option value="' + p.id + '"' + (S.filter === p.id ? " selected" : "") + ">" + esc(p.title) + (p.id === S.primary ? " · primary" : "") + "</option>"; }).join("");
        var list = vis().map(function (d) { return '<button class="ws-doc" data-doc="' + d.id + '" aria-current="' + (S.cur && S.cur.id === d.id) + '"><b>' + esc(d.title) + "</b><span>Ch. " + d.chapter_number + " · " + K.fmtN(K.words(d.body)) + " words" + (d.project_id && S.filter === "all" ? " · " + esc(pname(d.project_id)) : "") + "</span></button>"; }).join("");
        return '<aside class="ws-rail">' + K.panel("Documents", "Private to your Passport.", '<label class="sr-only" for="ws-f">Show documents for</label><select class="bk-in" id="ws-f" data-a="filter">' + popts + '</select><div class="rm-row" style="margin:10px 0"><button class="btn small solid" data-a="new">New document</button></div><div class="ws-docs">' + (list || '<p class="bk-note">No documents here yet.</p>') + "</div>") + "</aside>";
      }
      function editor() {
        if (!S.cur) return '<main>' + K.empty("Start with the words you have. Create your first document — it is saved privately under your Passport as you type.<br><br><button class=\"btn solid\" data-a=\"new\">New document</button>") + "</main>";
        var d = S.cur, popts = '<option value="">No project</option>' + S.projects.map(function (p) { return '<option value="' + p.id + '"' + (d.project_id === p.id ? " selected" : "") + ">" + esc(p.title) + "</option>"; }).join("");
        return '<main><div class="ws-head"><label class="sr-only" for="ws-t">Title</label><input class="bk-in ws-title" id="ws-t" data-field="title" maxlength="240" value="' + esc(d.title) + '"><label class="sr-only" for="ws-c">Chapter number</label><input class="bk-in" id="ws-c" data-field="chapter_number" type="number" min="1" max="999" value="' + d.chapter_number + '" title="Chapter number"></div>' +
          '<div class="rm-row" style="margin-bottom:8px"><label class="rm-l" for="ws-p">Project</label><select class="bk-in" style="width:auto;max-width:100%" id="ws-p" data-field="project_id">' + popts + "</select></div>" +
          '<label class="sr-only" for="ws-ed">Manuscript editor</label><textarea class="ws-ed" id="ws-ed" data-field="body" placeholder="Start with the words you have. Dream Board will help you protect, organize and develop them.">' + esc(d.body) + "</textarea>" +
          '<div class="ws-bar"><span id="ws-wc">' + K.fmtN(K.words(d.body)) + " words in this chapter</span><span>·</span><span id=\"ws-save\" role=\"status\">" + saveLabel() + '</span><span class="sp"></span><button class="btn small" data-a="focus" aria-pressed="' + S.focus + '">' + (S.focus ? "Exit focus (Esc)" : "Focus mode") + '</button><button class="btn small" data-a="version">Save version (⌘S)</button><button class="btn small" data-a="export">Export Markdown</button></div></main>';
      }
      function saveLabel() { return S.saveState === "saving" ? "Saving…" : S.saveState === "dirty" ? "Unsaved changes…" : S.saveState === "error" ? "Not saved — will retry" : "Saved to your Passport"; }
      function side() {
        if (!S.cur) return '<aside class="ws-side"></aside>';
        var vopts = function (sel) { return '<option value="current"' + (sel === "current" ? " selected" : "") + ">Current draft</option>" + S.versions.map(function (v) { return '<option value="' + v.id + '"' + (sel === v.id ? " selected" : "") + ">" + esc(v.label) + " · " + K.fmtDay(v.created_at) + "</option>"; }).join(""); };
        var versions = S.versions.map(function (v) { return '<div class="ws-ver"><b>' + esc(v.label) + '</b><span class="rm-meta">' + new Date(v.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " · " + K.fmtN(v.word_count) + ' words</span><div class="rm-row" style="margin-top:6px"><button class="btn small" data-a="cmp-this" data-v="' + v.id + '">Compare</button><button class="btn small" data-a="restore" data-v="' + v.id + '">Restore</button><button class="btn small" data-a="vdel" data-v="' + v.id + '">Delete</button></div></div>'; }).join("");
        var bookOpts = S.books.map(function (b) { return '<option value="' + b.id + '">' + esc(b.title) + "</option>"; }).join("");
        var st = S.cur.project_id && S.settings[S.cur.project_id];
        return '<aside class="ws-side">' +
          K.panel("Versions", "Every brave edit has a way back. ⌘S / Ctrl+S saves one.", '<form class="rm-row" data-f="version"><input class="bk-in" style="flex:1;width:auto;min-width:0" name="label" maxlength="200" placeholder="Name this version (optional)" aria-label="Version name"><button class="btn small">Save</button></form>' + (versions || '<p class="bk-note">No saved versions yet.</p>')) +
          (S.versions.length ? K.panel("Compare", "A simple word-level diff (deterministic). Green was added, red was removed, going from the first to the second.",
            '<div class="rm-form"><select class="bk-in" data-a="cmpA" aria-label="From">' + vopts(S.cmpA) + '</select><select class="bk-in" data-a="cmpB" aria-label="To">' + vopts(S.cmpB) + '</select><div class="rm-row"><button class="btn small solid" data-a="compare">Compare</button>' + (S.diff ? '<button class="btn small" data-a="cmp-close">Close</button>' : "") + "</div></div>" +
            (S.diff ? '<p class="rm-meta">+' + K.fmtN(S.diff.added) + " words · −" + K.fmtN(S.diff.removed) + " words" + (S.diff.unit !== "word" ? " · compared by " + S.diff.unit + " (very long texts)" : "") + '</p><div class="ws-diff">' + S.diff.html + "</div>" : "")) : "") +
          K.panel("Send to Book Studio", "Book Studio is the manuscript home. This adds the current draft as one passage in your words to the book you choose. Nothing else changes.",
            S.miss.books ? '<p class="bk-note">Book Studio is not set up for this Passport yet.</p>' : S.books.length ? '<div class="rm-form"><label class="sr-only" for="ws-bk">Book</label><select class="bk-in" id="ws-bk" data-a="book">' + bookOpts + '</select><div class="rm-row"><button class="btn small solid" data-a="send">Send this draft</button><a class="btn small" href="#/book">Open Book Studio</a></div></div>' : '<p class="bk-note">You have no books yet.</p><a class="btn small" href="#/book">Start one in Book Studio</a>') +
          K.panel("Ask Spaidbot", "It suggests; you write. " + (st && (st.ai_instructions || st.writing_voice) ? "This project’s AI instructions and writing voice go with the question." : "Nothing is added to your draft unless you click."),
            '<form class="rm-form" data-f="ask"><textarea class="bk-in" name="q" maxlength="1200" style="min-height:70px" placeholder="e.g. Where does this chapter lose momentum?" aria-label="Your question"></textarea><div class="rm-row"><button class="btn small"' + (S.aiBusy ? " disabled" : "") + ">" + (S.aiBusy ? "Asking…" : "Ask about this draft") + "</button></div></form>" +
            (S.ai ? '<div class="rm-item rm-ai" style="margin-top:10px"><div class="rm-meta">Spaidbot</div><div class="ws-ai">' + esc(S.ai) + '</div><div class="rm-row"><button class="btn small" data-a="ai-insert">Insert at end of draft</button><button class="btn small" data-a="ai-copy">Copy</button><button class="btn small" data-a="ai-clear">Dismiss</button></div></div>' : "")) +
          K.panel("", "", '<div class="rm-row"><a class="btn small" href="#/r/voice">Check voice</a><button class="btn small" data-a="docdel">Delete document</button></div>') + "</aside>";
      }
      function paint() {
        var room = el.closest(".room") || el; room.classList.toggle("ws-focus", S.focus);
        el.innerHTML = K.scene("Dream Board OS · Create", "Writing Studio", "Draft chapters and documents in your own words. Autosaved privately, with versions you can compare and restore.", "art-book-studio.jpg",
          '<a class="btn" href="#/book">Book Studio</a><a class="btn" href="#/r/voice">Voice Guardian</a><a class="btn" href="#/r/projects">Projects</a>') +
          '<div class="ws-work">' + rail() + editor() + side() + "</div>";
      }
      paint();

      // ---- autosave ----
      var timer = null;
      function markSave(s) { S.saveState = s; var n = el.querySelector("#ws-save"); if (n) n.textContent = saveLabel(); }
      async function flush() {
        clearTimeout(timer); timer = null; if (!S.cur || S.saveState === "saved") return;
        var d = S.cur; markSave("saving");
        try {
          var patch = { title: (d.title || "").trim().slice(0, 240) || "Untitled", chapter_number: Math.min(999, Math.max(1, parseInt(d.chapter_number, 10) || 1)), body: d.body, project_id: d.project_id || null, updated_at: new Date().toISOString() };
          await K.update("dreamboard_writing_documents", d.id, patch); d.updated_at = patch.updated_at; // never write the sent snapshot back: the writer may have typed meanwhile
          markSave(S.saveState === "saving" ? "saved" : S.saveState);
        } catch (e) { markSave("error"); timer = setTimeout(flush, 5000); }
      }
      function schedule() { markSave("dirty"); clearTimeout(timer); timer = setTimeout(flush, 1200); }
      window.addEventListener("hashchange", function once() { window.removeEventListener("hashchange", once); flush(); });

      async function saveVersion(label) {
        if (!S.cur) return; await flush();
        var d = S.cur, wc = K.words(d.body);
        var lbl = (label || "").trim() ? label.trim().slice(0, 200) + " · Chapter " + d.chapter_number : "Chapter " + d.chapter_number + " · " + d.title.slice(0, 180);
        try { var v = await K.insert("dreamboard_document_versions", { document_id: d.id, label: lbl, body: d.body, word_count: wc }); S.versions.unshift(v); if (!S.cmpA) S.cmpA = v.id; K.toast("Version saved privately (" + K.fmtN(wc) + " words)."); paint(); }
        catch (e) { K.toast("The version could not be saved: " + (e.message || e), true); }
      }
      function bodyOf(id) { if (id === "current") return S.cur.body; var v = S.versions.filter(function (x) { return x.id === id; })[0]; return v ? v.body : ""; }

      el.addEventListener("input", function (e) {
        var f = e.target.dataset.field; if (!f || !S.cur) return;
        if (f === "project_id") return;
        S.cur[f] = e.target.value;
        if (f === "body") { var n = el.querySelector("#ws-wc"); if (n) n.textContent = K.fmtN(K.words(e.target.value)) + " words in this chapter"; }
        schedule();
      });
      el.addEventListener("change", async function (e) {
        var t = e.target;
        if (t.dataset.field === "project_id") { S.cur.project_id = t.value || null; schedule(); await flush(); paint(); return; }
        if (t.dataset.field === "title" || t.dataset.field === "chapter_number") { await flush(); var keep = t.id; paint(); var n = el.querySelector("#" + keep); if (n) n.focus(); return; }
        if (t.dataset.a === "filter") { await flush(); S.filter = t.value; var v = vis(); if (!S.cur || v.indexOf(S.cur) < 0) { S.cur = v[0] || null; await loadVersions(); } paint(); return; }
        if (t.dataset.a === "cmpA") S.cmpA = t.value; if (t.dataset.a === "cmpB") S.cmpB = t.value;
      });
      el.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && S.cur) { e.preventDefault(); saveVersion(""); return; }
        if (e.key === "Escape" && S.focus) { S.focus = false; paint(); var ed = el.querySelector("#ws-ed"); if (ed) ed.focus(); }
      });
      el.addEventListener("submit", async function (e) {
        var f = e.target.closest("form[data-f]"); if (!f) return; e.preventDefault();
        if (f.dataset.f === "version") return saveVersion(f.elements.label.value);
        if (f.dataset.f === "ask") {
          var q = f.elements.q.value.trim(); if (!q || !S.cur) return;
          var st = S.cur.project_id && S.settings[S.cur.project_id];
          var excerpt = S.cur.body.length > 6000 ? S.cur.body.slice(-6000) : S.cur.body;
          var content = "I am writing in Dream Board's Writing Studio. Please only suggest — do not rewrite my text for me unless I ask, and keep my voice.\n" +
            (st && st.ai_instructions ? "Project instructions: " + st.ai_instructions + "\n" : "") + (st && st.writing_voice ? "My writing voice for this project: " + st.writing_voice + "\n" : "") +
            "Document: " + S.cur.title + " (chapter " + S.cur.chapter_number + ")\n---\n" + excerpt + "\n---\nMy question: " + q;
          S.aiBusy = true; paint();
          try {
            var res, tries = 0;
            do { res = await fetch(SPAIDBOT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: content }], product: "ath" }) }); tries++; if (res.status === 503 && tries < 3) await new Promise(function (ok) { setTimeout(ok, 2500 * tries); }); } while (res.status === 503 && tries < 3);
            var b = await res.json().catch(function () { return {}; });
            if (!res.ok || !b.reply) throw new Error(res.status === 503 ? "Spaidbot is busy — try again in a moment." : "Spaidbot answered " + res.status + ".");
            S.ai = b.reply;
          } catch (er) { K.toast(er.message || String(er), true); }
          S.aiBusy = false; paint();
        }
      });
      el.addEventListener("click", async function (e) {
        var dn = e.target.closest("[data-doc]"); if (dn) { await flush(); S.cur = S.docs.filter(function (d) { return d.id === dn.dataset.doc; })[0]; S.ai = null; await loadVersions(); paint(); var ed0 = el.querySelector("#ws-ed"); if (ed0 && innerWidth > 820) ed0.focus(); return; }
        var b = e.target.closest("[data-a]"); if (!b || b.tagName === "SELECT") return;
        var a = b.dataset.a;
        if (a === "new") {
          await flush();
          var pid = S.filter !== "all" && S.filter !== "none" ? S.filter : (S.primary || null);
          var n = S.docs.filter(function (d) { return d.project_id === pid; }).reduce(function (m, d) { return Math.max(m, d.chapter_number); }, 0) + 1;
          try { var row = await K.insert("dreamboard_writing_documents", { project_id: pid, title: "Untitled chapter", chapter_number: Math.min(999, n), body: "" }); S.docs.unshift(row); S.cur = row; if (S.filter !== "all" && S.filter !== pid && !(S.filter === "none" && !pid)) S.filter = "all"; await loadVersions(); paint(); var t = el.querySelector("#ws-t"); if (t) { t.focus(); t.select(); } }
          catch (er) { K.toast("Could not create the document: " + (er.message || er), true); }
          return;
        }
        if (a === "focus") { S.focus = !S.focus; paint(); var ed = el.querySelector("#ws-ed"); if (ed) ed.focus(); return; }
        if (a === "version") return saveVersion("");
        if (a === "export") { await flush(); var d = S.cur; K.download(new Blob(["# " + d.title + "\n\n## Chapter " + d.chapter_number + "\n\n" + d.body + "\n"], { type: "text/markdown" }), (d.title.replace(/[^\w\- ]+/g, "").trim() || "chapter") + ".md"); K.toast("A Markdown copy was downloaded."); return; }
        if (a === "cmp-this") { S.cmpA = b.dataset.v; S.cmpB = "current"; S.diff = diff(bodyOf(S.cmpA), bodyOf("current")); paint(); return; }
        if (a === "compare") { if (S.cmpA === S.cmpB) return K.toast("Choose two different texts to compare.", true); S.diff = diff(bodyOf(S.cmpA), bodyOf(S.cmpB)); paint(); return; }
        if (a === "cmp-close") { S.diff = null; paint(); return; }
        if (a === "restore") { var v = S.versions.filter(function (x) { return x.id === b.dataset.v; })[0]; if (!v || !confirm("Restore “" + v.label + "”? Your current draft is replaced in the editor — save a version first if you want to keep it.")) return; S.cur.body = v.body; S.saveState = "dirty"; await flush(); S.diff = null; paint(); K.toast("Restored. Your other versions are still here."); return; }
        if (a === "vdel") { if (!confirm("Delete this saved version? This cannot be undone.")) return; try { await K.remove("dreamboard_document_versions", b.dataset.v); S.versions = S.versions.filter(function (x) { return x.id !== b.dataset.v; }); S.diff = null; if (S.cmpA === b.dataset.v) S.cmpA = S.versions[0] ? S.versions[0].id : ""; if (S.cmpB === b.dataset.v) S.cmpB = "current"; paint(); } catch (er) { K.toast("Could not delete: " + (er.message || er), true); } return; }
        if (a === "docdel") {
          if (!confirm("Delete “" + S.cur.title + "” and its saved versions? This cannot be undone. (Anything you already sent to Book Studio stays there.)")) return;
          clearTimeout(timer); S.saveState = "saved";
          try { await K.remove("dreamboard_writing_documents", S.cur.id); var gone = S.cur.id; S.docs = S.docs.filter(function (x) { return x.id !== gone; }); S.cur = vis()[0] || null; await loadVersions(); paint(); K.toast("Document deleted."); } catch (er) { K.toast("Could not delete: " + (er.message || er), true); }
          return;
        }
        if (a === "send") {
          await flush();
          var bookId = el.querySelector("#ws-bk").value, book = S.books.filter(function (x) { return x.id === bookId; })[0], body = S.cur.body.trim();
          if (!body) return K.toast("This draft has no words to send yet.", true);
          if (body.length > 40000) return K.toast("Book Studio passages hold up to 40,000 characters. Split this draft into smaller documents first.", true);
          if (!confirm("Add this draft (" + K.fmtN(K.words(body)) + " words) to “" + book.title + "” as a passage in your words?")) return;
          b.disabled = true;
          try {
            var uid = K.uid(), now = new Date().toISOString(), w = K.words(body);
            var src = (await K.q(sb.from("dreamboard_book_sources").select("id,words,passages").eq("book_id", bookId).eq("kind", "studio").limit(1)))[0];
            if (!src) src = await K.insert("dreamboard_book_sources", { id: crypto.randomUUID(), book_id: bookId, name: "Written in Book Studio", kind: "studio", words: 0, passages: 0, imported_at: now, meta: {} });
            var last = (await K.q(sb.from("dreamboard_book_passages").select("seq").eq("book_id", bookId).order("seq", { ascending: false }).limit(1)))[0];
            await K.q(sb.from("dreamboard_book_passages").insert({ id: crypto.randomUUID(), book_id: bookId, owner_id: uid, source_id: src.id, seq: (last ? last.seq : 0) + 1, body: body, words: w, written_at: now, speaker: "author", starred: false, updated_at: now }));
            await K.q(sb.from("dreamboard_book_sources").update({ words: (src.words || 0) + w, passages: (src.passages || 0) + 1 }).eq("id", src.id));
            // bump the book so Book Studio pulls the new passage on its next open
            await K.q(sb.from("dreamboard_books").update({ words: (book.words || 0) + w, updated_at: now }).eq("id", bookId)); book.words = (book.words || 0) + w;
            K.toast("Sent to “" + book.title + "” as a passage in your words. Place it in a chapter from Book Studio.");
          } catch (er) { K.toast("Could not send to Book Studio: " + (er.message || er), true); }
          b.disabled = false; return;
        }
        if (a === "ai-insert") { if (!S.ai) return; S.cur.body = S.cur.body ? S.cur.body + "\n\n" + S.ai : S.ai; S.saveState = "dirty"; await flush(); S.ai = null; paint(); K.toast("Inserted at the end of your draft. Edit or remove it freely."); return; }
        if (a === "ai-copy") { try { await navigator.clipboard.writeText(S.ai); K.toast("Copied."); } catch (er) { K.toast("Copy is not available here.", true); } return; }
        if (a === "ai-clear") { S.ai = null; paint(); return; }
      });
    }
  });
})();
