/* Dream Board OS · Publishing (ported from ~/dreamboard/app/publishing.tsx + lib/epub.ts + supabase/dreamboard-publishing.sql, 2026-11-12).
 * Builds a real EPUB 3 in the browser from a Book Studio book: chapters in position order, only the author's placed
 * passages, in the author's words. The zip is written by hand, store-only (no compression), with the "mimetype" entry
 * first and uncompressed as the EPUB OCF spec requires. Word and Markdown stay with Book Studio's own export
 * (#/book/<id>/export) so there is one exporter per format. The readiness checklist is deterministic: it only counts rows.
 * Export history: dreamboard_exports (supabase/dreamboard-os-publish.sql). Nothing is published anywhere public. */
(function () {
  "use strict";
  var K = window.DBKit;

  K.css("publishing",
    ".pb-check { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }" +
    ".pb-check li { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 8px; align-items: start; font-size: 14px; color: var(--cream); }" +
    ".pb-check li i { font-style: normal; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 600; }" +
    ".pb-check li.pass i { background: rgba(159,211,166,0.18); color: var(--ok); border: 1px solid rgba(159,211,166,0.5); }" +
    ".pb-check li.warn i { background: rgba(217,181,108,0.16); color: var(--gold-hi); border: 1px solid var(--gold-dim); }" +
    ".pb-check li.fail i { background: rgba(229,154,134,0.16); color: var(--danger); border: 1px solid rgba(229,154,134,0.5); }" +
    ".pb-check li small { display: block; color: var(--muted); font-size: 12px; }" +
    ".pb-score { font-family: var(--serif); font-size: 34px; color: var(--gold-hi); line-height: 1; }" +
    ".pb-hist { width: 100%; border-collapse: collapse; font-size: 14px; }" +
    ".pb-hist th, .pb-hist td { text-align: left; padding: 8px 6px; border-bottom: 1px solid rgba(217,181,108,0.14); }" +
    ".pb-hist th { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--gold); font-weight: 500; }" +
    ".pb-hist td.n { font-variant-numeric: tabular-nums; }" +
    ".pb-honest { margin-top: 12px; border-left: 3px solid var(--gold-dim); padding: 8px 12px; border-radius: 8px; background: rgba(217,181,108,0.06); font-size: 13px; color: var(--cream-dim); }" +
    "@media (max-width: 560px) { .pb-hist .hide-s { display: none; } }" +
    "@media (min-width: 821px) { .room .bk-work.pb-work { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }"
  );

  // ---------------- EPUB 3 (store-only zip) ----------------
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function le(n, len) { var a = new Uint8Array(len); for (var i = 0; i < len; i++) a[i] = (n >>> (8 * i)) & 255; return a; }
  /** files: [[name, string]] — written in order, every entry STORED (method 0). The caller puts "mimetype" first. */
  function zipStore(files, mime) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0, d = new Date();
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosDate = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
      // mimetype must have no extra field and no UTF-8 flag oddities; plain ASCII names keep flag 0 for all entries.
      parts.push(le(0x04034b50, 4), le(10, 2), le(0, 2), le(0, 2), le(dosTime, 2), le(dosDate, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), name, data);
      central.push(le(0x02014b50, 4), le(20, 2), le(10, 2), le(0, 2), le(0, 2), le(dosTime, 2), le(dosDate, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (a, x) { return a + x.length; }, 0);
    var end = [le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(csize, 4), le(off, 4), le(0, 2)];
    return new Blob(parts.concat(central, end), { type: mime });
  }
  function x(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); })); }

  function buildEpub(o) {
    // o: { title, subtitle, author, lang, chapters: [{ title, part, paras: [string] }] }
    var id = "urn:uuid:" + uuid();
    var modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    var lang = o.lang || "en";
    function page(title, body) {
      return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' + x(lang) + '" lang="' + x(lang) + '">\n<head><meta charset="UTF-8"/><title>' + x(title) + '</title><link rel="stylesheet" type="text/css" href="style.css"/></head>\n<body>\n' + body + "\n</body>\n</html>";
    }
    var css = "body{font-family:Georgia,serif;line-height:1.5;margin:0 5%;}h1,h2{font-weight:normal;text-align:center;}h1.title{margin-top:30%;font-size:2em;}p.sub{text-align:center;font-style:italic;}p.by{text-align:center;margin-top:2em;}p.part{text-align:center;letter-spacing:.2em;text-transform:uppercase;margin-top:1em;}p.kick{text-align:center;font-size:.8em;letter-spacing:.3em;text-transform:uppercase;margin-top:3em;}p{margin:0;text-indent:1.4em;}p.first{text-indent:0;}";
    var files = [["mimetype", "application/epub+zip"],
      ["META-INF/container.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n</container>'],
      ["OEBPS/style.css", css],
      ["OEBPS/title.xhtml", page(o.title, '<section epub:type="titlepage"><h1 class="title">' + x(o.title) + "</h1>" + (o.subtitle ? '<p class="sub">' + x(o.subtitle) + "</p>" : "") + '<p class="by">' + x(o.author) + "</p></section>")]];
    var manifest = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>', '<item id="css" href="style.css" media-type="text/css"/>', '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>'];
    var spine = ['<itemref idref="title"/>'], navLis = [], ncx = [];
    o.chapters.forEach(function (c, i) {
      var n = String(i + 1).padStart(3, "0"), href = "ch-" + n + ".xhtml", label = "Chapter " + (i + 1) + (c.title ? ": " + c.title : "");
      var body = '<section epub:type="chapter">' + (c.partStart ? '<p class="part">' + x(c.part) + "</p>" : "") + '<p class="kick">Chapter ' + (i + 1) + "</p><h2>" + x(c.title || "Untitled chapter") + "</h2>\n" +
        c.paras.map(function (p, j) { return '<p' + (j === 0 ? ' class="first"' : "") + ">" + x(p).replace(/\n/g, "<br/>") + "</p>"; }).join("\n") + "</section>";
      files.push(["OEBPS/" + href, page(label, body)]);
      manifest.push('<item id="ch' + n + '" href="' + href + '" media-type="application/xhtml+xml"/>');
      spine.push('<itemref idref="ch' + n + '"/>');
      navLis.push('<li><a href="' + href + '">' + x(label) + "</a></li>");
      ncx.push('<navPoint id="np' + n + '" playOrder="' + (i + 1) + '"><navLabel><text>' + x(label) + '</text></navLabel><content src="' + href + '"/></navPoint>');
    });
    files.push(["OEBPS/nav.xhtml", page("Contents", '<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>' + navLis.join("") + "</ol></nav>")]);
    files.push(["OEBPS/toc.ncx", '<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="' + id + '"/></head><docTitle><text>' + x(o.title) + "</text></docTitle><navMap>" + ncx.join("") + "</navMap></ncx>"]);
    files.push(["OEBPS/content.opf", '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="' + x(lang) + '">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    <dc:identifier id="pub-id">' + id + "</dc:identifier>\n    <dc:title>" + x(o.title) + "</dc:title>\n    <dc:creator>" + x(o.author) + "</dc:creator>\n    <dc:language>" + x(lang) + '</dc:language>\n    <meta property="dcterms:modified">' + modified + "</meta>\n  </metadata>\n  <manifest>\n    " + manifest.join("\n    ") + '\n  </manifest>\n  <spine toc="ncx">\n    ' + spine.join("\n    ") + "\n  </spine>\n</package>"]);
    return zipStore(files, "application/epub+zip");
  }
  window.DBEpub = { build: buildEpub }; // exposed for the proof script only; the room does not depend on it

  // ---------------- data ----------------
  var S = null;
  async function pageAll(build) {
    var out = [], from = 0;
    for (;;) { var r = await build().range(from, from + 999); if (r.error) throw r.error; out = out.concat(r.data || []); if (!r.data || r.data.length < 1000) break; from += 1000; }
    return out;
  }
  async function loadBook(id) {
    var sb = K.sb;
    S.chapters = await K.q(sb.from("dreamboard_book_chapters").select("id,title,part,position").eq("book_id", id).order("position", { ascending: true }));
    var ps = await pageAll(function () { return sb.from("dreamboard_book_passages").select("id,chapter_id,position,seq,body,words,dup_of").eq("book_id", id).eq("speaker", "author").order("seq", { ascending: true }); });
    S.byCh = {}; S.unplaced = 0; S.dupPlaced = 0;
    ps.forEach(function (p) {
      if (!p.chapter_id) { if (!p.dup_of) S.unplaced++; return; }
      if (p.dup_of) S.dupPlaced++;
      (S.byCh[p.chapter_id] = S.byCh[p.chapter_id] || []).push(p);
    });
    Object.keys(S.byCh).forEach(function (k) { S.byCh[k].sort(function (a, b) { return (a.position || 0) - (b.position || 0) || a.seq - b.seq; }); });
  }
  function chWords(c) { return (S.byCh[c.id] || []).reduce(function (a, p) { return a + (p.words || K.words(p.body)); }, 0); }
  function book() { return S.books.find(function (b) { return b.id === S.bookId; }); }

  /** Deterministic readiness: every line is a count or a presence check on your own rows. No AI, no scoring model. */
  function checklist() {
    var b = book(), out = [];
    var placedWords = S.chapters.reduce(function (a, c) { return a + chWords(c); }, 0);
    var empty = S.chapters.filter(function (c) { return !(S.byCh[c.id] || []).length; });
    var untitled = S.chapters.filter(function (c) { return !(c.title || "").trim(); });
    var short = S.chapters.filter(function (c) { var w = chWords(c); return w > 0 && w < 300; });
    out.push([b && (b.title || "").trim() ? "pass" : "fail", "The book has a title", b && b.title ? "“" + b.title + "”" : "Name it in Book Studio → Export → Book settings."]);
    out.push([(S.author || "").trim() ? "pass" : "fail", "An author name is set for the EPUB", (S.author || "").trim() ? S.author : "Type the name readers will see."]);
    out.push([S.chapters.length ? "pass" : "fail", "The book has chapters", K.fmtN(S.chapters.length) + " chapter" + (S.chapters.length === 1 ? "" : "s")]);
    out.push([!S.chapters.length ? "fail" : empty.length ? "fail" : "pass", "Every chapter holds placed passages", empty.length ? K.fmtN(empty.length) + " empty: " + empty.slice(0, 4).map(function (c) { return c.title || "Untitled"; }).join(", ") + (empty.length > 4 ? "…" : "") : "None empty"]);
    out.push([untitled.length ? "warn" : "pass", "Every chapter has a title", untitled.length ? K.fmtN(untitled.length) + " untitled" : "All titled"]);
    out.push([short.length ? "warn" : "pass", "No chapter is under 300 words", short.length ? K.fmtN(short.length) + " short: " + short.slice(0, 4).map(function (c) { return c.title || "Untitled"; }).join(", ") : "All chapters 300+ words"]);
    out.push([S.dupPlaced ? "warn" : "pass", "No repeated passage is placed in a chapter", S.dupPlaced ? K.fmtN(S.dupPlaced) + " repeat" + (S.dupPlaced === 1 ? "" : "s") + " placed — review Duplicates in Book Studio" : "No repeats placed"]);
    out.push([S.unplaced ? "warn" : "pass", "All your passages are placed", S.unplaced ? K.fmtN(S.unplaced) + " of your passages are not in any chapter (they stay out of the book)" : "Everything is placed"]);
    out.push([b && (b.subtitle || "").trim() ? "pass" : "warn", "A subtitle is set (optional)", b && b.subtitle ? b.subtitle : "Optional"]);
    return { items: out, words: placedWords };
  }

  function render(el) {
    var b = book(), ck = S.bookId ? checklist() : null;
    var fails = ck ? ck.items.filter(function (i) { return i[0] === "fail"; }).length : 0, warns = ck ? ck.items.filter(function (i) { return i[0] === "warn"; }).length : 0;
    var exportable = b && S.chapters.length && ck.words > 0;
    var hist = S.history === null ? K.setupNotice("Export history", "supabase/dreamboard-os-publish.sql") :
      K.panel("Export history", "Every EPUB you built here, private to your Passport. Delete removes the record only — your downloaded file is yours.",
        S.history.length ? '<table class="pb-hist"><thead><tr><th>Book</th><th>Format</th><th class="hide-s">Chapters</th><th>Words</th><th class="hide-s">When</th><th></th></tr></thead><tbody>' + S.history.map(function (h) {
          return "<tr><td>" + K.esc(h.title || "Untitled") + "</td><td>" + K.esc(h.format.toUpperCase()) + '</td><td class="n hide-s">' + K.fmtN(h.chapter_count) + '</td><td class="n">' + K.fmtN(h.word_count) + '</td><td class="hide-s">' + K.esc(new Date(h.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) + '</td><td><button class="btn small" type="button" data-pb-act="hdel" data-id="' + h.id + '" aria-label="Delete this history record">Delete</button></td></tr>';
        }).join("") + "</tbody></table>" : '<p class="bk-empty">No exports recorded yet. Your first EPUB appears here with its word count and date.</p>');
    el.innerHTML = K.scene("Dream Board · Publishing", "Ship the real thing, on purpose.",
      "Exports are built on this device from your Book Studio manuscript — only the passages you placed, in your order and your words. Nothing is published anywhere public; every output is a file you hold.",
      "art-orchard.jpg", (b ? '<a class="btn" href="#/book/' + b.id + '/export">Word &amp; Markdown in Book Studio</a>' : "") + '<a class="btn" href="#/r/reader">Read it first</a>') +
      (!S.books.length ? '<div class="bk-work one">' + K.empty('No books yet. <a href="#/book">Start one in Book Studio</a>, place your passages in chapters, then come back to export.') + "</div>" :
      '<div class="bk-work two pb-work">' +
      K.panel("Readiness", "Deterministic checks — counted from your own rows, no AI. Guidance, not a gate: exporting is always your call.",
        '<label class="rm-l" for="pb-book">Book</label><select id="pb-book" class="bk-in" data-pb="book">' + S.books.map(function (x) { return '<option value="' + x.id + '"' + (x.id === S.bookId ? " selected" : "") + ">" + K.esc((x.title || "Untitled").slice(0, 80)) + "</option>"; }).join("") + "</select>" +
        '<div class="rm-row" style="margin:14px 0 10px"><span class="pb-score">' + (ck.items.length - fails - warns) + "/" + ck.items.length + '</span><span class="note">' + (fails ? K.fmtN(fails) + " to fix" : "Nothing blocking") + (warns ? " · " + K.fmtN(warns) + " to review" : "") + "</span></div>" +
        '<ul class="pb-check">' + ck.items.map(function (i) { return '<li class="' + i[0] + '"><i aria-hidden="true">' + (i[0] === "pass" ? "✓" : i[0] === "warn" ? "!" : "✕") + '</i><span><span class="sr-only">' + i[0] + ": </span>" + K.esc(i[1]) + "<small>" + K.esc(i[2]) + "</small></span></li>"; }).join("") + "</ul>") +
      K.panel("Export", K.fmtN(S.chapters.length) + " chapters · " + K.fmtN(ck.words) + " placed words · ≈" + K.fmtN(Math.max(1, Math.round(ck.words / 275))) + " book pages",
        '<div class="rm-form"><label class="rm-l" for="pb-author">Author name (on the title page and in the EPUB metadata)</label><input id="pb-author" class="bk-in" data-pb="author" maxlength="160" value="' + K.esc(S.author) + '" placeholder="Your name as readers will see it">' +
        '<label class="rm-l" for="pb-lang">Language</label><select id="pb-lang" class="bk-in" data-pb="lang">' + [["en", "English"], ["es", "Spanish"], ["fr", "French"], ["pt", "Portuguese"], ["de", "German"]].map(function (l) { return '<option value="' + l[0] + '"' + (S.lang === l[0] ? " selected" : "") + ">" + l[1] + "</option>"; }).join("") + "</select></div>" +
        '<div class="rm-row" style="margin-top:14px"><button class="btn solid" type="button" data-pb-act="epub"' + (exportable && !S.busy ? "" : " disabled") + ">" + (S.busy ? "Building…" : "Download EPUB") + "</button>" +
        (b ? '<a class="btn" href="#/book/' + b.id + '/export">Word (.docx) / Markdown →</a>' : "") + "</div>" +
        (exportable ? "" : '<p class="note" style="margin-top:10px">Place passages in chapters first (Book Studio → Outline).</p>') +
        '<p class="note" style="margin-top:12px">EPUB 3 with a title page, a table of contents and one file per chapter — opens in Apple Books, Kobo, Google Play Books and Calibre. Word and Markdown come from Book Studio\'s own exporter so there is one source for each format.</p>' +
        '<div class="pb-honest"><b>Not built yet (and not faked):</b> PDF export, a public preview page and direct store or print destinations. No button here pretends otherwise. Print/save-PDF from the Reader works today.</div>') +
      "</div>" + '<div class="bk-work one">' + hist + "</div>");
  }

  DBRoom.register("publishing", {
    mount: async function (el) {
      S = { books: [], bookId: null, chapters: [], byCh: {}, unplaced: 0, dupPlaced: 0, history: [], author: "", lang: "en", busy: false };
      el.innerHTML = '<p class="loading">Opening Publishing…</p>';
      try { S.books = await K.list("dreamboard_books", { select: "id,title,subtitle,updated_at", order: "updated_at" }); }
      catch (e) { if (K.missingTable(e)) { el.innerHTML = '<div class="bk-work one">' + K.setupNotice("Book Studio", "supabase/dreamboard-book-studio.sql") + "</div>"; return; } throw e; }
      try { S.history = await K.list("dreamboard_exports", { select: "id,book_id,format,title,word_count,chapter_count,created_at", order: "created_at", limit: 50 }); }
      catch (e) { if (K.missingTable(e)) S.history = null; else throw e; }
      try { var prof = await K.q(K.sb.from("dreamboard_profiles").select("display_name").eq("id", K.uid()).maybeSingle()); S.author = (prof && prof.display_name) || ""; } catch (e) { S.author = ""; }
      try { var saved = localStorage.getItem("dreamboard-publish-author"); if (saved) S.author = saved; } catch (e) { /* storage blocked */ }
      if (S.books.length) { S.bookId = S.books[0].id; await loadBook(S.bookId); }
      render(el);

      el.addEventListener("input", function (e) {
        if (e.target.dataset.pb === "author") { S.author = e.target.value; try { localStorage.setItem("dreamboard-publish-author", S.author); } catch (x2) { /* blocked */ } }
      });
      el.addEventListener("change", async function (e) {
        var k = e.target.dataset.pb;
        if (k === "book") { S.bookId = e.target.value; try { await loadBook(S.bookId); } catch (err) { K.toast(err.message, true); } render(el); }
        else if (k === "lang") S.lang = e.target.value;
        else if (k === "author") render(el); // refresh the checklist line
      });
      el.addEventListener("click", async function (e) {
        var b = e.target.closest("[data-pb-act]"); if (!b || !el.contains(b)) return;
        if (b.dataset.pbAct === "epub") {
          var bk = book(); if (!bk) return;
          S.busy = true; render(el);
          try {
            var words = 0, part = null;
            var chapters = S.chapters.map(function (c) {
              var paras = [];
              (S.byCh[c.id] || []).forEach(function (p) { words += p.words || K.words(p.body); String(p.body || "").split(/\n\s*\n/).forEach(function (t) { t = t.trim(); if (t) paras.push(t); }); });
              var partStart = !!(c.part && c.part !== part); if (c.part) part = c.part;
              return { title: c.title, part: c.part, partStart: partStart, paras: paras };
            }).filter(function (c) { return c.paras.length; });
            var blob = buildEpub({ title: bk.title || "Untitled", subtitle: bk.subtitle || "", author: (S.author || "").trim() || "Unknown author", lang: S.lang, chapters: chapters });
            var name = String(bk.title || "book").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "book";
            K.download(blob, name + ".epub");
            if (S.history !== null) {
              try { var row = await K.insert("dreamboard_exports", { book_id: bk.id, format: "epub", title: (bk.title || "").slice(0, 300), word_count: words, chapter_count: chapters.length }); S.history.unshift(row); }
              catch (err) { K.toast("The EPUB downloaded; its history record could not save: " + err.message, true); }
            }
            K.toast("EPUB downloaded — " + K.fmtN(chapters.length) + " chapters, " + K.fmtN(words) + " of your words.");
          } catch (err) { K.toast("The EPUB could not be built on this device: " + (err.message || err) + ". Your manuscript is unchanged.", true); }
          S.busy = false; render(el);
        } else if (b.dataset.pbAct === "hdel") {
          if (!window.confirm("Delete this export record? Your downloaded file is not affected.")) return;
          try { await K.remove("dreamboard_exports", b.dataset.id); S.history = S.history.filter(function (h) { return h.id !== b.dataset.id; }); render(el); K.toast("Export record deleted."); }
          catch (err) { K.toast("Could not delete: " + err.message, true); }
        }
      });
    }
  });
})();
