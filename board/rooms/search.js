/* Dream Board OS · Universal Search (ported from ~/dreamboard/app/search.tsx, 2026-11-12)
 * One keyword search across the author's own rooms: Vision Vault, Knowledge Vault, Writing documents, Projects,
 * Book Studio (book titles + passages) and Creative Graph nodes. Every query runs as the signed-in Passport, so owner RLS
 * scopes it. Keyword matching only — honestly labelled; nothing is fetched from the web. */
(function () {
  "use strict";
  var K = window.DBKit;
  var LIMIT = 25;
  // [domain, label, room hash, icon]
  var DOMAINS = [["vision", "Vision Vault", "#/r/vision", "✧"], ["knowledge", "Knowledge Vault", "#/r/knowledge", "⌕"], ["writing", "Writing", "#/r/writing", "✎"], ["projects", "Projects", "#/r/projects", "▦"], ["book", "Book Studio", "#/book", "❧"], ["graph", "Graph nodes", "#/r/graph", "⌬"]];
  function dom(d) { for (var i = 0; i < DOMAINS.length; i++) if (DOMAINS[i][0] === d) return DOMAINS[i]; return DOMAINS[0]; }

  function excerpt(text, q) {
    var clean = String(text || "").replace(/\s+/g, " ").trim(), i = clean.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return clean.slice(0, 160) + (clean.length > 160 ? "…" : "");
    var s = Math.max(0, i - 60), end = i + q.length + 100;
    return (s > 0 ? "…" : "") + clean.slice(s, end) + (end < clean.length ? "…" : "");
  }
  function mark(text, q) {
    var e = K.esc(text), qq = K.esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return qq ? e.replace(new RegExp(qq, "gi"), function (m) { return "<mark>" + m + "</mark>"; }) : e;
  }

  K.css("search", [
    ".us-bar{display:flex;gap:8px;flex-wrap:wrap}",
    ".us-bar input{flex:1 1 240px;min-width:0;font-size:17px}",
    ".us-res{display:grid;gap:10px}",
    ".us-hit{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:start;text-decoration:none;color:var(--cream)}",
    ".us-hit:hover{border-color:var(--gold-dim)}",
    ".us-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(217,181,108,.1);color:var(--gold-hi);font-size:18px}",
    ".us-hit p{margin:4px 0 0;font-family:var(--serif);font-size:16px;line-height:1.45;color:var(--cream-dim);word-break:break-word}",
    ".us-hit mark{background:rgba(243,217,150,.32);color:inherit;border-radius:3px;padding:0 2px}",
    ".us-go{align-self:center;font-size:13px;color:var(--gold-hi);white-space:nowrap}",
    "@media (max-width:560px){.us-hit{grid-template-columns:30px minmax(0,1fr)}.us-go{grid-column:2}.us-ic{width:30px;height:30px;font-size:15px}}"
  ].join("\n"));

  DBRoom.register("search", {
    mount: async function (el) {
      var S = { q: "", last: "", on: new Set(DOMAINS.map(function (d) { return d[0]; })), results: [], state: "idle", notes: [] };
      try { var saved = sessionStorage.getItem("dbos-search"); if (saved) S.q = saved; } catch (e) {}

      async function one(domain, table, cols, title, body, pattern, extra) {
        if (!S.on.has(domain)) return [];
        var b = K.sb.from(table).select(cols);
        b = body ? b.or(title + ".ilike." + pattern + "," + body + ".ilike." + pattern) : b.ilike(title, pattern);
        if (extra) b = extra(b);
        var r = await b.limit(LIMIT);
        if (r.error) { S.notes.push(dom(domain)[1] + (K.missingTable(r.error) ? " is not set up yet." : " could not be searched (" + r.error.message + ").")); return []; }
        return r.data;
      }
      async function run() {
        var q = S.q.trim(); if (q.length < 2) return;
        S.state = "searching"; S.last = q; S.notes = []; paintResults();
        try { sessionStorage.setItem("dbos-search", q); } catch (e) {}
        var p = "%" + q.replace(/[%_,()*\\]/g, " ").trim() + "%";
        var res = await Promise.all([
          one("vision", "dreamboard_vision_entries", "id,title,content,status,updated_at", "title", "content", p),
          one("knowledge", "dreamboard_vault_entries", "id,title,content,source_type,updated_at", "title", "content", p),
          one("writing", "dreamboard_writing_documents", "id,title,body,chapter_number,updated_at", "title", "body", p),
          one("projects", "dreamboard_projects", "id,title,vision,kind,updated_at", "title", "vision", p),
          one("book", "dreamboard_books", "id,title,subtitle,updated_at", "title", "subtitle", p),
          one("book", "dreamboard_book_passages", "id,book_id,body,speaker,written_at,updated_at", "body", null, p, function (b) { return b.order("updated_at", { ascending: false }); }),
          one("graph", "dreamboard_graph_nodes", "id,label,description,node_type,vault_entry_id,updated_at", "label", "description", p)
        ]);
        var bookIds = Array.from(new Set(res[5].map(function (r) { return r.book_id; }))), titles = {};
        res[4].forEach(function (b) { titles[b.id] = b.title; });
        var missing = bookIds.filter(function (id) { return !titles[id]; });
        if (missing.length) { var bt = await K.sb.from("dreamboard_books").select("id,title").in("id", missing); (bt.data || []).forEach(function (b) { titles[b.id] = b.title; }); }
        var out = [];
        res[0].forEach(function (r) { out.push({ d: "vision", id: r.id, t: r.title, x: excerpt(r.content, q), u: r.updated_at, sub: r.status.replace(/_/g, " "), href: "#/r/vision", focus: "vision" }); });
        res[1].forEach(function (r) { out.push({ d: "knowledge", id: r.id, t: r.title, x: excerpt(r.content, q), u: r.updated_at, sub: r.source_type, href: "#/r/knowledge", focus: "knowledge" }); });
        res[2].forEach(function (r) { out.push({ d: "writing", id: r.id, t: r.title, x: excerpt(r.body, q), u: r.updated_at, sub: r.chapter_number ? "chapter " + r.chapter_number : "", href: "#/r/writing", focus: "writing" }); });
        res[3].forEach(function (r) { out.push({ d: "projects", id: r.id, t: r.title, x: excerpt(r.vision, q), u: r.updated_at, sub: r.kind, href: "#/r/projects", focus: "projects" }); });
        res[4].forEach(function (r) { out.push({ d: "book", id: r.id, t: r.title, x: excerpt(r.subtitle, q), u: r.updated_at, sub: "book", href: "#/book/" + r.id }); });
        res[5].forEach(function (r) { out.push({ d: "book", id: r.id, t: (titles[r.book_id] || "Book") + " · passage", x: excerpt(r.body, q), u: r.written_at || r.updated_at, sub: r.speaker !== "author" ? r.speaker + " (not your words)" : "your words", href: "#/book/" + r.book_id }); });
        res[6].forEach(function (r) { out.push({ d: "graph", id: r.id, t: r.label, x: excerpt(r.description, q), u: r.updated_at, sub: r.node_type, href: r.vault_entry_id ? "#/r/knowledge" : "#/r/graph", focus: r.vault_entry_id ? "knowledge" : null, fid: r.vault_entry_id }); });
        out.sort(function (a, b) { return String(b.u || "").localeCompare(String(a.u || "")); });
        S.results = out; S.state = "done"; paintResults();
      }

      function resultsHtml() {
        var e = K.esc;
        if (S.state === "idle") return '<div class="bk-empty" style="padding:22px 8px">Search opens your own material only — nothing is fetched from the web, and nothing is indexed until you save it.</div>';
        if (S.state === "searching") return '<p class="bk-count">Searching your rooms for “' + e(S.last) + "”…</p>";
        var notes = S.notes.length ? '<p class="rm-meta">' + S.notes.map(e).join(" ") + "</p>" : "";
        if (!S.results.length) return notes + '<div class="bk-empty" style="padding:22px 8px">Nothing matched “' + e(S.last) + "” in the selected rooms. Your material is unchanged — try another word.</div>";
        var counts = S.results.reduce(function (m, r) { m[r.d] = (m[r.d] || 0) + 1; return m; }, {});
        return '<p class="bk-count">' + S.results.length + " match" + (S.results.length === 1 ? "" : "es") + " for “" + e(S.last) + "” · " + Object.keys(counts).map(function (d) { return dom(d)[1] + " " + counts[d] + (counts[d] >= LIMIT ? "+" : ""); }).join(" · ") + "</p>" + notes +
          '<div class="us-res">' + S.results.map(function (r, i) {
            var d = dom(r.d);
            return '<a class="rm-item us-hit" href="' + r.href + '" data-i="' + i + '"><span class="us-ic" aria-hidden="true">' + d[3] + '</span><span style="min-width:0"><span class="rm-meta">' + e(d[1]) + (r.sub ? " · " + e(r.sub) : "") + (r.u ? " · " + K.fmtDay(r.u) : "") + "</span><h4>" + mark(r.t || "Untitled", S.last) + "</h4>" + (r.x ? "<p>" + mark(r.x, S.last) + "</p>" : "") + '</span><span class="us-go">Open →</span></a>';
          }).join("") + "</div>";
      }
      function paintResults() { var b = el.querySelector("#us-out"); if (b) b.innerHTML = resultsHtml(); var go = el.querySelector("#us-go"); if (go) { go.disabled = S.state === "searching" || S.q.trim().length < 2; go.textContent = S.state === "searching" ? "Searching…" : "Search"; } }
      function paint() {
        el.innerHTML = K.scene("Universal Search · keyword, private to you", "Find it anywhere in your work.",
          "One keyword search across your vaults, writing, projects, Book Studio passages and graph — scoped to your Passport. Semantic search comes later and will be labelled as such.",
          "art-sunrise.jpg", "") +
          '<div class="bk-work one">' + K.panel("", "",
            '<form class="us-bar" id="us-form" role="search"><input type="search" class="bk-in" id="us-q" placeholder="Search everything you have saved (2+ characters)" aria-label="Search query" value="' + K.esc(S.q) + '" autocomplete="off"><button class="btn solid" id="us-go"' + (S.q.trim().length < 2 ? " disabled" : "") + ">Search</button></form>" +
            '<div class="bk-chips" style="margin:12px 0 0" role="group" aria-label="Rooms to search">' + DOMAINS.map(function (d) { return '<button class="bk-chip" data-d="' + d[0] + '" aria-pressed="' + S.on.has(d[0]) + '">' + d[1] + "</button>"; }).join("") + "</div>") +
          K.panel("Results", "Keyword matches in titles and text, newest first, up to " + LIMIT + " per room.", '<div id="us-out">' + resultsHtml() + "</div>") + "</div>";
      }

      el.addEventListener("input", function (ev) { if (ev.target.id === "us-q") { S.q = ev.target.value; var go = el.querySelector("#us-go"); if (go && S.state !== "searching") go.disabled = S.q.trim().length < 2; } });
      el.addEventListener("submit", function (ev) { if (ev.target.id === "us-form") { ev.preventDefault(); run(); } });
      el.addEventListener("click", function (ev) {
        var c = ev.target.closest("[data-d]");
        if (c) { var d = c.dataset.d; if (S.on.has(d)) { if (S.on.size > 1) S.on.delete(d); } else S.on.add(d); el.querySelectorAll("[data-d]").forEach(function (x) { x.setAttribute("aria-pressed", S.on.has(x.dataset.d)); }); if (S.state === "done") run(); return; }
        var a = ev.target.closest("a.us-hit");
        if (a) { var r = S.results[+a.dataset.i]; if (r && r.focus) { try { sessionStorage.setItem("dbos-focus", JSON.stringify({ room: r.focus, id: r.fid || r.id })); } catch (e) {} } }
      });

      paint();
      if (S.q.trim().length >= 2) run();
      var qi = el.querySelector("#us-q"); if (qi && window.innerWidth > 820) qi.focus();
    }
  });
})();
