/* Dream Board OS · Reader (ported from ~/dreamboard/app/reader.tsx, 2026-11-12).
 * Reads a Book Studio manuscript straight from the Passport tables: dreamboard_books → dreamboard_book_chapters (position order)
 * → the author's placed passages (dreamboard_book_passages, speaker = 'author', by position). Nothing here edits the book.
 * Typography (size, line height, serif/sans, page tone) is remembered on this device in localStorage. */
(function () {
  "use strict";
  var K = window.DBKit;
  var PREF_KEY = "dreamboard-reader-type";
  var LAST_KEY = "dreamboard-reader-last";
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? Object.assign({}, d, v) : d; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: still works for this visit */ } }

  K.css("reader",
    ".rd-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; align-items: end; }" +
    ".rd-controls label { display: grid; gap: 6px; font-size: 12px; color: var(--cream-dim); letter-spacing: .06em; }" +
    ".rd-controls input[type=range] { width: 100%; accent-color: var(--gold); }" +
    ".rd-seg { display: inline-flex; border: 1px solid var(--gold-dim); border-radius: 999px; overflow: hidden; }" +
    ".rd-seg button { background: none; border: 0; padding: 7px 14px; min-height: 38px; color: var(--cream-dim); cursor: pointer; font-size: 13px; }" +
    ".rd-seg button[aria-pressed=true] { background: rgba(217,181,108,0.22); color: var(--gold-hi); }" +
    ".rd-progress { position: sticky; top: 0; z-index: 7; height: 4px; background: rgba(217,181,108,0.14); margin: 0 clamp(12px, 3vw, 40px); border-radius: 3px; overflow: hidden; }" +
    ".rd-progress i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--gold), var(--gold-hi)); transition: width .15s linear; }" +
    ".rd-pct { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }" +
    ".rd-page { max-width: 42em; margin: 0 auto; padding: clamp(22px, 5vw, 64px) clamp(18px, 6vw, 72px); border-radius: 6px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); overflow-wrap: break-word; }" +
    ".rd-page.tone-night { background: #0b130f; color: #eadfc6; border: 1px solid rgba(217,181,108,0.18); }" +
    ".rd-page.tone-paper { background: #f6eedb; color: #2a2418; border: 1px solid #e3d6b6; }" +
    ".rd-page.tone-comfortable { background: #e9dcbc; color: #33291a; border: 1px solid #d6c497; }" +
    ".rd-page.face-serif { font-family: var(--serif); }" +
    ".rd-page.face-sans { font-family: var(--sans); }" +
    ".rd-page p { margin: 0 0 1em; text-indent: 1.4em; }" +
    ".rd-page p.first, .rd-page .rd-part + p, .rd-page h2 + p { text-indent: 0; }" +
    ".rd-page h2 { font-family: var(--serif); font-weight: 500; font-size: 1.7em; line-height: 1.15; margin: 0 0 1.1em; text-align: center; }" +
    ".rd-page .rd-kick { display: block; text-align: center; font-family: var(--sans); font-size: 11px; letter-spacing: .3em; text-transform: uppercase; opacity: .7; margin: 2.6em 0 .6em; }" +
    ".rd-page .rd-kick:first-child { margin-top: 0; }" +
    ".rd-page .rd-part { text-align: center; font-family: var(--serif); font-size: 1.1em; letter-spacing: .2em; text-transform: uppercase; opacity: .8; margin: 3em 0 0; }" +
    ".rd-page .rd-empty { text-indent: 0; text-align: center; opacity: .7; font-style: italic; }" +
    ".rd-page footer { display: flex; justify-content: space-between; margin-top: 2.4em; padding-top: 1em; border-top: 1px solid currentColor; opacity: .72; font-family: var(--sans); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; }" +
    ".rd-page.proof { max-width: 6in; min-height: 9in; padding: .75in .7in; font-size: 11.5pt !important; line-height: 1.45 !important; }" +
    ".rd-page.proof .rd-run { display: flex; justify-content: space-between; font-family: var(--sans); font-size: 9px; letter-spacing: .2em; text-transform: uppercase; opacity: .55; margin-bottom: 2em; }" +
    ".rd-run { display: none; }" +
    ".rd-break { break-before: page; page-break-before: always; }" +
    "@media (max-width: 560px) { .rd-page { border-radius: 0; margin: 0 -16px; box-shadow: none; } .rd-page.proof { min-height: 0; padding: 28px 20px; } }" +
    "@media print { body.rd-printing * { visibility: hidden !important; } body.rd-printing .rd-page, body.rd-printing .rd-page * { visibility: visible !important; }" +
    " body.rd-printing .rd-page { position: absolute; left: 0; top: 0; width: 100%; max-width: none; margin: 0; padding: 0; box-shadow: none; border: 0; background: #fff !important; color: #000 !important; }" +
    " body.rd-printing .rd-run { display: flex !important; } body.rd-printing { background: #fff !important; } @page { size: 6in 9in; margin: .75in .65in; } }"
  );

  var S = null;

  async function pageAll(build) {
    var out = [], from = 0, size = 1000;
    for (;;) {
      var r = await build().range(from, from + size - 1);
      if (r.error) throw r.error;
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < size) break;
      from += size;
    }
    return out;
  }

  async function loadBook(id) {
    var sb = K.sb;
    var chapters = await K.q(sb.from("dreamboard_book_chapters").select("id,title,part,position").eq("book_id", id).order("position", { ascending: true }));
    var passages = await pageAll(function () {
      return sb.from("dreamboard_book_passages").select("id,chapter_id,position,seq,body,words").eq("book_id", id).eq("speaker", "author").not("chapter_id", "is", null).order("seq", { ascending: true });
    });
    var by = {};
    passages.forEach(function (p) { (by[p.chapter_id] = by[p.chapter_id] || []).push(p); });
    Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return (a.position || 0) - (b.position || 0) || a.seq - b.seq; }); });
    S.chapters = chapters; S.byCh = by;
  }

  function chapterWords(c) { return (S.byCh[c.id] || []).reduce(function (a, p) { return a + (p.words || K.words(p.body)); }, 0); }

  function pageHtml() {
    var book = S.books.find(function (b) { return b.id === S.bookId; });
    if (!book) return "";
    var list = S.chapter === "all" ? S.chapters : S.chapters.filter(function (c) { return c.id === S.chapter; });
    var cls = "rd-page tone-" + S.pref.tone + " face-" + S.pref.face + (S.proof ? " proof" : "");
    var style = S.proof ? "" : ' style="font-size:' + S.pref.size + "px;line-height:" + S.pref.lh + '"';
    var html = '<article class="' + cls + '" id="rd-page"' + style + ' aria-label="Manuscript">' +
      '<div class="rd-run"><span>' + K.esc(book.title || "Untitled") + "</span><span>Proof · " + K.esc(K.fmtDay(new Date().toISOString())) + "</span></div>";
    if (!S.chapters.length) {
      html += '<p class="rd-empty">This book has no chapters yet. Propose or build an outline in Book Studio, then place your passages.</p>';
    } else {
      var part = null;
      list.forEach(function (c, i) {
        var idx = S.chapters.indexOf(c);
        var broke = false;
        if (S.chapter === "all" && c.part && c.part !== part) { part = c.part; broke = true; html += '<div class="rd-part' + (i ? " rd-break" : "") + '">' + K.esc(part) + "</div>"; }
        html += '<span class="rd-kick' + (i && !broke ? " rd-break" : "") + '">Chapter ' + (idx + 1) + "</span><h2>" + K.esc(c.title || "Untitled chapter") + "</h2>";
        var ps = S.byCh[c.id] || [];
        if (!ps.length) { html += '<p class="rd-empty">No passages are placed in this chapter yet.</p>'; return; }
        var first = true;
        ps.forEach(function (p) {
          String(p.body || "").split(/\n\s*\n/).forEach(function (para) {
            var t = para.trim(); if (!t) return;
            html += "<p" + (first ? ' class="first"' : "") + ">" + K.esc(t).replace(/\n/g, "<br>") + "</p>"; first = false;
          });
        });
      });
    }
    html += "<footer><span>Dream Board</span><b>" + (S.chapter === "all" ? "Whole book" : "Chapter " + (S.chapters.findIndex(function (c) { return c.id === S.chapter; }) + 1)) + "</b></footer></article>";
    return html;
  }

  function render(el) {
    var book = S.books.find(function (b) { return b.id === S.bookId; });
    var chOpts = '<option value="all"' + (S.chapter === "all" ? " selected" : "") + ">Whole book</option>" + S.chapters.map(function (c, i) {
      return '<option value="' + c.id + '"' + (S.chapter === c.id ? " selected" : "") + ">" + (i + 1) + ". " + K.esc((c.title || "Untitled").slice(0, 70)) + " · " + K.fmtN(chapterWords(c)) + " words</option>";
    }).join("");
    var total = S.chapters.reduce(function (a, c) { return a + chapterWords(c); }, 0);
    var seg = function (key, opts) { return '<span class="rd-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-rd-pref="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (S.pref[key] === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</span>"; };
    el.innerHTML = K.scene("Dream Board · Reader", "Read it the way a reader will.",
      "Your placed passages, chapter by chapter, in your order and your words. The Reader never edits the book — Book Studio is where the manuscript lives.",
      "art-sunrise.jpg",
      (book ? '<a class="btn solid" href="#/book/' + book.id + '/outline">Open in Book Studio</a>' : '<a class="btn solid" href="#/book">Open Book Studio</a>') + '<a class="btn" href="#/r/publishing">Publishing</a>') +
      '<div class="bk-work one">' +
      K.panel("Reading desk", (book ? K.fmtN(S.chapters.length) + " chapters · " + K.fmtN(total) + " placed words · ≈" + K.fmtN(Math.max(1, Math.round(total / 275))) + " book pages" : ""),
        '<div class="rd-controls">' +
        '<label>Book<select class="bk-in" data-rd="book">' + S.books.map(function (b) { return '<option value="' + b.id + '"' + (b.id === S.bookId ? " selected" : "") + ">" + K.esc((b.title || "Untitled").slice(0, 80)) + "</option>"; }).join("") + "</select></label>" +
        '<label>Chapter<select class="bk-in" data-rd="chapter"' + (S.chapters.length ? "" : " disabled") + ">" + chOpts + "</select></label>" +
        '<label><span>Type size · <span data-rd-out="size">' + S.pref.size + 'px</span></span><input type="range" min="14" max="28" step="1" value="' + S.pref.size + '" data-rd="size"' + (S.proof ? " disabled" : "") + "></label>" +
        '<label><span>Line height · <span data-rd-out="lh">' + S.pref.lh + '</span></span><input type="range" min="1.3" max="2.2" step="0.05" value="' + S.pref.lh + '" data-rd="lh"' + (S.proof ? " disabled" : "") + "></label>" +
        "</div>" +
        '<div class="rm-row" style="margin-top:12px">' + seg("face", [["serif", "Serif"], ["sans", "Sans"]]) + seg("tone", [["comfortable", "Comfortable"], ["paper", "Paper"], ["night", "Night"]]) +
        '<span class="spacer"></span><button class="btn small" type="button" data-rd-act="proof" aria-pressed="' + S.proof + '">' + (S.proof ? "Close proof preview" : "Proof preview (6×9)") + '</button><button class="btn small solid" type="button" data-rd-act="print">Print / save PDF</button></div>' +
        '<p class="note" style="margin:10px 0 0">Type settings are remembered on this device. Proof preview sets a 6×9 trim at 11.5 pt so you can judge real page length; Print uses your browser\'s print dialog.</p>') +
      "</div>" +
      '<div class="rd-progress" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>' +
      '<div class="bk-work one"><div class="rm-row" style="justify-content:flex-end"><span class="rd-pct" data-rd-pct>0% read</span></div>' + pageHtml() + "</div>";
    onScroll();
  }

  function onScroll() {
    var page = document.getElementById("rd-page"); var bar = document.querySelector(".rd-progress");
    if (!page || !bar) return;
    var r = page.getBoundingClientRect(); var vh = window.innerHeight;
    var total = r.height - vh * 0.6; var seen = -r.top + vh * 0.4;
    var pct = total <= 0 ? (r.top < vh ? 100 : 0) : Math.max(0, Math.min(100, Math.round(seen / total * 100)));
    bar.firstChild.style.width = pct + "%"; bar.setAttribute("aria-valuenow", pct);
    var t = document.querySelector("[data-rd-pct]"); if (t) t.textContent = pct + "% read";
  }

  DBRoom.register("reader", {
    mount: async function (el) {
      S = { books: [], bookId: null, chapters: [], byCh: {}, chapter: "all", proof: false, pref: readJSON(PREF_KEY, { size: 19, lh: 1.7, face: "serif", tone: "paper" }) };
      var last = readJSON(LAST_KEY, {});
      el.innerHTML = '<p class="loading">Opening your manuscripts…</p>';
      try {
        S.books = await K.list("dreamboard_books", { select: "id,title,subtitle,words,updated_at", order: "updated_at" });
      } catch (e) {
        if (K.missingTable(e)) { el.innerHTML = K.scene("Dream Board · Reader", "Read it the way a reader will.", "", "art-sunrise.jpg") + '<div class="bk-work one">' + K.setupNotice("Book Studio", "supabase/dreamboard-book-studio.sql") + "</div>"; return; }
        throw e;
      }
      if (!S.books.length) {
        el.innerHTML = K.scene("Dream Board · Reader", "Read it the way a reader will.", "The Reader opens the manuscript you build in Book Studio. You have no book on your Passport yet.", "art-sunrise.jpg", '<a class="btn solid" href="#/book">Start a book in Book Studio</a>') +
          '<div class="bk-work one">' + K.empty("No books yet. Bring your writing into Book Studio, place passages in chapters, and they will read here.") + "</div>";
        return;
      }
      S.bookId = S.books.some(function (b) { return b.id === last.book; }) ? last.book : S.books[0].id;
      await loadBook(S.bookId);
      if (last.book === S.bookId && last.chapter && S.chapters.some(function (c) { return c.id === last.chapter; })) S.chapter = last.chapter;
      render(el);

      function remember() { writeJSON(LAST_KEY, { book: S.bookId, chapter: S.chapter }); }
      el.addEventListener("change", async function (e) {
        var k = e.target.dataset.rd; if (!k) return;
        if (k === "book") { S.bookId = e.target.value; S.chapter = "all"; el.querySelector("#rd-page").style.opacity = ".4"; try { await loadBook(S.bookId); } catch (err) { K.toast("This book could not open: " + (err.message || err), true); } remember(); render(el); window.scrollTo(0, 0); }
        else if (k === "chapter") { S.chapter = e.target.value; remember(); render(el); var p = document.getElementById("rd-page"); if (p) window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY - 80); }
      });
      el.addEventListener("input", function (e) {
        var k = e.target.dataset.rd; if (k !== "size" && k !== "lh") return;
        S.pref[k] = Number(e.target.value); writeJSON(PREF_KEY, S.pref);
        var out = el.querySelector('[data-rd-out="' + k + '"]'); if (out) out.textContent = k === "size" ? S.pref.size + "px" : S.pref.lh;
        var page = document.getElementById("rd-page"); if (page && !S.proof) { page.style.fontSize = S.pref.size + "px"; page.style.lineHeight = S.pref.lh; }
        onScroll();
      });
      el.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b || !el.contains(b)) return;
        if (b.dataset.rdPref) { S.pref[b.dataset.rdPref] = b.dataset.v; writeJSON(PREF_KEY, S.pref); render(el); return; }
        if (b.dataset.rdAct === "proof") { S.proof = !S.proof; render(el); return; }
        if (b.dataset.rdAct === "print") {
          document.body.classList.add("rd-printing");
          var done = function () { document.body.classList.remove("rd-printing"); window.removeEventListener("afterprint", done); };
          window.addEventListener("afterprint", done);
          window.print(); setTimeout(done, 1500);
        }
      });
      var onS = function () { if (!el.isConnected) { window.removeEventListener("scroll", onS); window.removeEventListener("resize", onS); return; } onScroll(); };
      window.addEventListener("scroll", onS, { passive: true }); window.addEventListener("resize", onS);
    }
  });
})();
