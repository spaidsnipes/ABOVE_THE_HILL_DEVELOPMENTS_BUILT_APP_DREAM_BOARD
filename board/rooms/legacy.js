/* Dream Board OS · Time Machine + Legacy Library (ported from ~/dreamboard/app/legacy.tsx, 2026-11-12)
 * A gentle, read-only view over the author's real rows — never a scoreboard, never shame for what is unfinished.
 *   Time Machine: On This Day (vision, knowledge, writing and Book Studio passages from this month-day in earlier years),
 *                 how each project evolved (timeline events), and earlier drafts (document versions + Book Studio snapshots).
 *   Legacy Library: finished or published projects, and everything exported from Publishing.
 * Reads only; every table is optional (a room that is not set up yet is simply left out). No tables of its own. */
(function () {
  "use strict";
  var K = window.DBKit;
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function md(s) { var d = new Date(s); return isNaN(d) ? null : { m: d.getMonth(), d: d.getDate(), y: d.getFullYear() }; }
  function yearsAgo(y) { var n = new Date().getFullYear() - y; return n <= 0 ? "earlier this year" : n === 1 ? "a year ago" : n + " years ago"; }
  function excerpt(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n).replace(/\s\S*$/, "") + "…" : s; }
  async function soft(p) { try { return await K.q(p); } catch (e) { return null; } } // a room not set up yet → left out quietly

  K.css("legacy", [
    ".lg-day{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}",
    ".lg-day select{width:auto}",
    ".lg-list{display:grid;gap:10px}",
    ".lg-mem{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;padding:12px 14px;border-radius:14px;background:rgba(4,8,6,.42);border:1px solid rgba(217,181,108,.16);text-decoration:none;color:inherit}",
    "a.lg-mem:hover{border-color:var(--gold-dim)}",
    ".lg-mem .g{font-family:var(--serif);color:var(--gold);font-size:20px;line-height:1.1}",
    ".lg-mem b{font-family:var(--serif);font-weight:500;font-size:19px;color:var(--cream)}",
    ".lg-mem p{margin:4px 0 0;font-family:var(--serif);font-size:16px;line-height:1.5;color:var(--cream-dim);word-break:break-word}",
    ".lg-proj{padding:14px;border-radius:14px;background:rgba(4,8,6,.42);border:1px solid rgba(217,181,108,.16)}",
    ".lg-proj h4{margin:0;font-family:var(--serif);font-weight:500;font-size:21px;color:var(--gold-hi)}",
    ".lg-tl{list-style:none;margin:10px 0 0;padding:0 0 0 14px;border-left:1px solid var(--gold-dim)}",
    ".lg-tl li{position:relative;margin:0 0 8px;font-size:14px;color:var(--cream-dim)}",
    ".lg-tl li::before{content:'';position:absolute;left:-19px;top:6px;width:9px;height:9px;border-radius:50%;background:var(--gold)}",
    ".lg-tl li b{color:var(--cream);font-weight:500}",
    ".lg-quiet{font-family:var(--serif);font-size:18px;color:var(--cream-dim);margin:0}"
  ].join("\n"));

  DBRoom.register("legacy", {
    mount: async function (el) {
      var now = new Date();
      var S = { tab: "time", m: now.getMonth(), d: now.getDate(), loaded: false, D: {} };

      async function load() {
        var sb = K.sb;
        var r = await Promise.all([
          soft(sb.from("dreamboard_vision_entries").select("id,title,content,created_at").order("created_at").limit(2000)),
          soft(sb.from("dreamboard_vault_entries").select("id,title,content,source_type,created_at").order("created_at").limit(2000)),
          soft(sb.from("dreamboard_writing_documents").select("id,title,project_id,created_at,updated_at").order("created_at").limit(1000)),
          soft(sb.from("dreamboard_books").select("id,title,owner_id,created_at,updated_at").order("created_at")),
          soft(sb.from("dreamboard_projects").select("id,title,kind,stage,progress,vision,created_at,updated_at").order("created_at").limit(500)),
          soft(sb.from("dreamboard_project_settings").select("project_id,status,archived_at").limit(500)),
          soft(sb.from("dreamboard_timeline_events").select("id,project_id,title,detail,occurred_at").order("occurred_at", { ascending: false }).limit(1000)),
          soft(sb.from("dreamboard_document_versions").select("id,document_id,label,word_count,created_at").order("created_at", { ascending: false }).limit(200)),
          soft(sb.from("dreamboard_book_revisions").select("id,book_id,label,words,created_at").order("created_at", { ascending: false }).limit(200)),
          soft(sb.from("dreamboard_exports").select("id,book_id,format,title,word_count,created_at").order("created_at", { ascending: false }).limit(200))
        ]);
        var uid = K.uid();
        S.D = { vision: r[0] || [], vault: r[1] || [], docs: r[2] || [], books: (r[3] || []).filter(function (b) { return b.owner_id === uid; }), projects: r[4] || [], settings: r[5] || [], timeline: r[6] || [], versions: r[7] || [], revisions: r[8] || [], exports: r[9], passageDates: [] };
        // Book Studio passages carry the date they were first written (written_at). Read only ids + dates here;
        // bodies are fetched for the chosen day only.
        var mine = S.D.books.map(function (b) { return b.id; });
        if (mine.length) {
          for (var page = 0; page < 20; page++) {
            var rows = await soft(sb.from("dreamboard_book_passages").select("id,book_id,written_at").in("book_id", mine).not("written_at", "is", null).order("written_at").range(page * 1000, page * 1000 + 999));
            if (!rows) break;
            S.D.passageDates = S.D.passageDates.concat(rows);
            if (rows.length < 1000) break;
          }
        }
        S.loaded = true;
      }

      function sameDay(s) { var x = md(s); return x && x.m === S.m && x.d === S.d && x.y < now.getFullYear() ? x : null; }
      async function onThisDay() {
        var items = [];
        S.D.vision.forEach(function (v) { var x = sameDay(v.created_at); if (x) items.push({ g: "✧", kind: "Idea", title: v.title, text: v.content, y: x.y, href: "#/r/vision" }); });
        S.D.vault.forEach(function (v) { var x = sameDay(v.created_at); if (x) items.push({ g: "❧", kind: "Knowledge · " + v.source_type, title: v.title, text: v.content, y: x.y, href: "#/r/knowledge" }); });
        S.D.docs.forEach(function (v) { var x = sameDay(v.created_at); if (x) items.push({ g: "✎", kind: "Writing begun", title: v.title, text: "", y: x.y, href: "#/r/writing" }); });
        var pids = S.D.passageDates.filter(function (p) { return sameDay(p.written_at); });
        if (pids.length) {
          var bodies = await soft(K.sb.from("dreamboard_book_passages").select("id,book_id,body,written_at,speaker").in("id", pids.slice(0, 24).map(function (p) { return p.id; })));
          var bt = {}; S.D.books.forEach(function (b) { bt[b.id] = b.title; });
          (bodies || []).forEach(function (p) { var x = md(p.written_at); items.push({ g: "❦", kind: "Book passage · " + (bt[p.book_id] || "your book") + (p.speaker !== "author" ? " · not your words" : ""), title: "", text: p.body, y: x.y, href: "#/book/" + p.book_id }); });
          if (pids.length > 24) items.push({ g: "…", kind: "Book Studio", title: (pids.length - 24) + " more passages were written on this day", text: "", y: 0, href: "#/book" });
        }
        items.sort(function (a, b) { return a.y - b.y; });
        return items;
      }

      function memHtml(it) {
        var e = K.esc;
        return '<a class="lg-mem" href="' + it.href + '"><span class="g" aria-hidden="true">' + it.g + '</span><div><div class="rm-meta">' + e(it.kind) + (it.y ? " · " + it.y + " · " + yearsAgo(it.y) : "") + "</div>" + (it.title ? "<b>" + e(it.title) + "</b>" : "") + (it.text ? "<p>" + e(excerpt(it.text, 320)) + "</p>" : "") + "</div></a>";
      }

      function statusOf(p) { var s = S.D.settings.find(function (x) { return x.project_id === p.id; }); return s ? s.status : (p.stage === "complete" ? "completed" : p.stage); }
      function evolution() {
        var e = K.esc;
        if (!S.D.projects.length) return '<p class="lg-quiet">No projects yet. When you start one, its story is kept here — including the directions you set aside, without judgment.</p>';
        return '<div class="lg-list">' + S.D.projects.map(function (p) {
          var ev = S.D.timeline.filter(function (t) { return t.project_id === p.id; }).slice(0, 6);
          var docs = S.D.docs.filter(function (d) { return d.project_id === p.id; }).length;
          return '<div class="lg-proj"><h4>' + e(p.title) + '</h4><div class="rm-meta">' + e(p.kind) + " · begun " + K.fmtDay(p.created_at) + " · last touched " + K.fmtDay(p.updated_at) + " · " + e(String(statusOf(p) || "").replace(/_/g, " ")) + (docs ? " · " + docs + " document" + (docs === 1 ? "" : "s") : "") + "</div>" +
            (p.vision ? '<p class="rm-meta" style="font-family:var(--serif);font-size:16px;color:var(--cream-dim);margin:8px 0 0">' + e(excerpt(p.vision, 220)) + "</p>" : "") +
            (ev.length ? '<ul class="lg-tl">' + ev.map(function (t) { return "<li><b>" + e(t.title) + "</b> · " + K.fmtDay(t.occurred_at) + (t.detail ? " — " + e(excerpt(t.detail, 140)) : "") + "</li>"; }).join("") + "</ul>" : "") + "</div>";
        }).join("") + "</div>";
      }

      function drafts() {
        var e = K.esc, dt = {}, bt = {};
        S.D.docs.forEach(function (d) { dt[d.id] = d.title; }); S.D.books.forEach(function (b) { bt[b.id] = b.title; });
        var list = S.D.versions.map(function (v) { return { at: v.created_at, g: "◫", kind: "Writing Studio version", title: (dt[v.document_id] || "A document") + " — " + v.label, w: v.word_count, href: "#/r/writing" }; })
          .concat(S.D.revisions.map(function (r) { return { at: r.created_at, g: "❦", kind: "Book Studio snapshot", title: (bt[r.book_id] || "Your book") + " — " + r.label, w: r.words, href: "#/book/" + r.book_id }; }))
          .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 30);
        if (!list.length) return '<p class="lg-quiet">No earlier drafts saved yet. Versions you keep in the Writing Studio and snapshots in Book Studio will give your writing a way back.</p>';
        return '<div class="lg-list">' + list.map(function (x) { return '<a class="lg-mem" href="' + x.href + '"><span class="g" aria-hidden="true">' + x.g + '</span><div><div class="rm-meta">' + e(x.kind) + " · " + K.fmtDay(x.at) + (x.w ? " · " + K.fmtN(x.w) + " words" : "") + "</div><b>" + e(x.title) + "</b></div></a>"; }).join("") + "</div>";
      }

      function library() {
        var e = K.esc;
        var done = S.D.projects.filter(function (p) { var s = statusOf(p); return s === "completed" || s === "published" || p.stage === "complete"; });
        var fin = done.length ? '<div class="lg-list">' + done.map(function (p) { return '<div class="lg-proj"><h4>' + e(p.title) + '</h4><div class="rm-meta">' + e(String(statusOf(p)).replace(/_/g, " ")) + " · " + e(p.kind) + " · begun " + K.fmtDay(p.created_at) + "</div></div>"; }).join("") + "</div>"
          : '<p class="lg-quiet">Nothing marked finished yet — and that is fine. When you mark a project completed or published, it is preserved here.</p>';
        var ex = S.D.exports == null ? '<p class="rm-meta">Export history opens once Publishing is set up.</p>'
          : S.D.exports.length ? '<div class="lg-list">' + S.D.exports.map(function (x) { return '<div class="lg-mem"><span class="g" aria-hidden="true">⇩</span><div><div class="rm-meta">' + e(String(x.format).toUpperCase()) + " · " + K.fmtDay(x.created_at) + (x.word_count ? " · " + K.fmtN(x.word_count) + " words" : "") + "</div><b>" + e(x.title || "Untitled") + "</b></div></div>"; }).join("") + "</div>"
          : '<p class="lg-quiet">No exports yet. Every EPUB, Word or Markdown file you export from Publishing is recorded here.</p>';
        var books = S.D.books.length ? '<div class="bk-books">' + S.D.books.map(function (b) { return '<a class="bk-book" href="#/book/' + b.id + '"><span class="where">Book Studio</span><b>' + e(b.title) + "</b><span>Begun " + K.fmtDay(b.created_at) + "</span></a>"; }).join("") + "</div>" : '<p class="lg-quiet">Your books will stand on this shelf once you begin one in Book Studio.</p>';
        return K.panel("Completed &amp; published", "The work you finished, kept in one place.", fin + '<div class="rm-row" style="margin-top:10px"><a class="btn small" href="#/r/projects">Open Projects</a></div>') +
          K.panel("Your books", "Every manuscript you are shaping in Book Studio.", books) +
          K.panel("Everything you shipped", "Your export history from Publishing.", ex + '<div class="rm-row" style="margin-top:10px"><a class="btn small" href="#/r/publishing">Open Publishing</a></div>');
      }

      async function paint() {
        var head = K.scene("Time Machine · Legacy Library", S.tab === "time" ? "What your work remembers." : "The work you finished.",
          S.tab === "time" ? "Earlier ideas, past drafts and how your thinking has changed — never a scoreboard, never shame for what is unfinished." : "Finished and published work, your books and everything you exported, preserved in one place.",
          "art-sunrise.jpg", "");
        var tabs = '<div class="rm-tabs" role="tablist"><button class="btn small" role="tab" data-a="tab" data-v="time" aria-pressed="' + (S.tab === "time") + '" aria-selected="' + (S.tab === "time") + '">Time Machine</button><button class="btn small" role="tab" data-a="tab" data-v="legacy" aria-pressed="' + (S.tab === "legacy") + '" aria-selected="' + (S.tab === "legacy") + '">Legacy Library</button></div>';
        if (S.tab === "legacy") { el.innerHTML = head + '<div class="bk-work one"><div>' + tabs + "</div>" + library() + "</div>"; return; }
        var days = new Date(2024, S.m + 1, 0).getDate();
        var picker = '<div class="lg-day"><label class="rm-l" for="lg-m">Day</label><select id="lg-m" class="bk-in">' + MONTHS.map(function (n, i) { return '<option value="' + i + '"' + (i === S.m ? " selected" : "") + ">" + n + "</option>"; }).join("") + '</select><select id="lg-d" class="bk-in" aria-label="Day of month">' + Array.from({ length: days }, function (_, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === S.d ? " selected" : "") + ">" + (i + 1) + "</option>"; }).join("") + "</select>" + (S.m !== now.getMonth() || S.d !== now.getDate() ? '<button class="btn small" data-a="today">Back to today</button>' : "") + "</div>";
        el.innerHTML = head + '<div class="bk-work one"><div>' + tabs + "</div>" + K.panel("On this day", "From " + MONTHS[S.m] + " " + S.d + " in earlier years.", picker + '<div id="lg-otd"><p class="rm-meta">Looking back…</p></div>') +
          K.panel("How your projects evolved", "Every project has a history.", evolution()) +
          K.panel("Earlier drafts", "Your writing has a way back.", drafts()) + "</div>";
        var items = await onThisDay();
        var box = el.querySelector("#lg-otd"); if (!box) return;
        box.innerHTML = items.length ? '<div class="lg-list">' + items.map(memHtml).join("") + "</div>" : '<p class="lg-quiet">Nothing resurfaced for this day yet. As the seasons pass, what you wrote and dreamed on this day in earlier years will surface here.</p>';
      }

      el.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-a]"); if (!b || !el.contains(b)) return;
        if (b.dataset.a === "tab") { S.tab = b.dataset.v; paint(); }
        if (b.dataset.a === "today") { S.m = now.getMonth(); S.d = now.getDate(); paint(); }
      });
      el.addEventListener("change", function (ev) {
        if (ev.target.id === "lg-m") { S.m = Number(ev.target.value); S.d = Math.min(S.d, new Date(2024, S.m + 1, 0).getDate()); paint(); }
        if (ev.target.id === "lg-d") { S.d = Number(ev.target.value); paint(); }
      });

      el.innerHTML = K.scene("Time Machine · Legacy Library", "Opening the long view…", "", "art-sunrise.jpg");
      await load();
      await paint();
    }
  });
})();
