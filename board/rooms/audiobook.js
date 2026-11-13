/* Dream Board OS · Audiobook Studio (ported from ~/dreamboard/app/audiobook.tsx + supabase/dreamboard-audiobook.sql, 2026-11-12).
 * Human narration first: upload a file or record in the browser (MediaRecorder), stored in the PRIVATE bucket
 * dreamboard-private under <uid>/audiobook/… (storage policies allow only the folder named by your uid).
 * Records live in dreamboard_audio_narrations (supabase/dreamboard-os-publish.sql), linked to a Book Studio chapter.
 * Playback uses short-lived signed URLs. Voice generation is NOT connected and nothing pretends it is. */
(function () {
  "use strict";
  var K = window.DBKit;
  var BUCKET = "dreamboard-private";
  var MAX = 50 * 1024 * 1024; // the bucket's own file-size limit
  var COLS = "id,book_id,chapter_id,title,storage_path,mime_type,byte_size,duration_seconds,pronunciation_notes,source,created_at,updated_at";

  K.css("audiobook",
    ".ab-rec { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px; border-radius: 14px; border: 1px dashed rgba(217,181,108,0.35); }" +
    ".ab-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--muted); flex: 0 0 auto; }" +
    ".ab-dot.on { background: #e5604b; box-shadow: 0 0 12px rgba(229,96,75,0.8); animation: ab-pulse 1.2s ease-in-out infinite; }" +
    "@keyframes ab-pulse { 50% { opacity: .35; } }" +
    ":root[data-motion=reduce] .ab-dot.on { animation: none; }" +
    ".ab-time { font-variant-numeric: tabular-nums; color: var(--cream); min-width: 48px; }" +
    ".ab-player { width: 100%; margin: 4px 0 12px; }" +
    ".ab-list { display: grid; gap: 10px; }" +
    ".ab-item { display: grid; gap: 8px; }" +
    ".ab-item.playing { border-color: var(--gold-hi); box-shadow: 0 0 0 1px var(--gold-hi); }" +
    ".ab-item textarea { min-height: 70px; font-family: var(--sans); font-size: 14px; }" +
    ".ab-src { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--gold); border: 1px solid var(--gold-dim); border-radius: 999px; padding: 1px 8px; }" +
    "@media (min-width: 821px) { .room .bk-work.ab-work { grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); } }" +
    ".ab-honest { border-left: 3px solid #9fc7e8; padding: 8px 12px; border-radius: 8px; background: rgba(159,199,232,0.07); font-size: 13px; color: var(--cream-dim); margin-top: 12px; }"
  );

  var S = null;
  function safeName(n) { return String(n || "narration").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "narration"; }
  function mb(n) { n = Number(n || 0); return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + " KB" : (n / 1024 / 1024).toFixed(1) + " MB"; }
  function clock(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function chapterTitle(id) { var c = S.allChapters[id]; return c ? c.title || "Untitled chapter" : null; }
  function bookTitle(id) { var b = S.books.find(function (x) { return x.id === id; }); return b ? b.title || "Untitled" : null; }
  var canRecord = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  async function loadChapters(bookId) {
    if (!bookId) { S.chapters = []; return; }
    S.chapters = await K.q(K.sb.from("dreamboard_book_chapters").select("id,title,position,book_id").eq("book_id", bookId).order("position", { ascending: true }));
    S.chapters.forEach(function (c) { S.allChapters[c.id] = c; });
  }

  function addPanel() {
    var bookOpts = '<option value="">No book link</option>' + S.books.map(function (b) { return '<option value="' + b.id + '"' + (b.id === S.bookId ? " selected" : "") + ">" + K.esc((b.title || "Untitled").slice(0, 80)) + "</option>"; }).join("");
    var chOpts = '<option value="">No chapter link</option>' + S.chapters.map(function (c, i) { return '<option value="' + c.id + '"' + (c.id === S.chapterId ? " selected" : "") + ">" + (i + 1) + ". " + K.esc((c.title || "Untitled").slice(0, 70)) + "</option>"; }).join("");
    var rec = S.rec || {};
    return K.panel("Add a narration", "Your own or licensed narration, chapter by chapter. Stored privately under your Passport — nothing is generated for you.",
      '<div class="rm-form">' +
      '<label class="rm-l" for="ab-book">Book</label><select id="ab-book" class="bk-in" data-ab="book">' + bookOpts + "</select>" +
      '<label class="rm-l" for="ab-ch">Chapter</label><select id="ab-ch" class="bk-in" data-ab="chapter"' + (S.chapters.length ? "" : " disabled") + ">" + chOpts + "</select>" +
      '<label class="rm-l" for="ab-title">Title (optional — the file name is used otherwise)</label><input id="ab-title" class="bk-in" maxlength="200" placeholder="Chapter 3 · take 2" value="' + K.esc(S.titleDraft) + '">' +
      '<input type="file" id="ab-file" accept="audio/*" hidden>' +
      '<div class="rm-row"><button class="btn solid" type="button" data-ab-act="choose"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? "Storing…" : "Upload audio file") + '</button><span class="note">MP3, WAV, M4A, OGG, WebM · up to 50 MB</span></div>' +
      "</div>" +
      '<h3 style="margin-top:18px">Record here</h3>' +
      (canRecord ?
        '<div class="ab-rec"><span class="ab-dot' + (rec.state === "recording" ? " on" : "") + '"></span><span class="ab-time" data-ab-time>' + clock(rec.secs) + "</span>" +
        (rec.state === "recording" ? '<button class="btn small solid" type="button" data-ab-act="stop">Stop</button>' :
          '<button class="btn small" type="button" data-ab-act="record"' + (S.busy ? " disabled" : "") + ">" + (rec.blob ? "Record again" : "Start recording") + "</button>") +
        (rec.blob && rec.state !== "recording" ? '<button class="btn small solid" type="button" data-ab-act="keep"' + (S.busy ? " disabled" : "") + '>Keep this take</button><button class="btn small" type="button" data-ab-act="discard">Discard</button>' : "") +
        "</div>" + (rec.url ? '<audio class="ab-player" controls src="' + rec.url + '"></audio>' : "") +
        '<p class="note">Your browser asks for the microphone first. A take stays on this device until you press Keep this take.</p>'
        : '<p class="note">Recording is not available in this browser (no MediaRecorder). Upload a file instead.</p>') +
      '<div class="ab-honest"><b>Voice generation is not connected.</b> Dream Board will only offer generated narration after a text-to-speech provider is connected — it never simulates one.</div>');
  }

  function listPanel() {
    var items = S.rows.map(function (n) {
      var ch = chapterTitle(n.chapter_id), bk = bookTitle(n.book_id);
      return '<div class="rm-item ab-item' + (S.playing === n.id ? " playing" : "") + '" data-id="' + n.id + '">' +
        '<div class="rm-row"><h4 style="flex:1;min-width:0;overflow-wrap:anywhere">' + K.esc(n.title) + '</h4><span class="ab-src">' + K.esc(n.source) + "</span></div>" +
        '<div class="rm-meta">' + (bk ? K.esc(bk) + " · " : "") + (ch ? "Chapter: " + K.esc(ch) : "No chapter link") + " · " + mb(n.byte_size) + (n.duration_seconds ? " · " + clock(n.duration_seconds) : "") + " · " + K.fmtDay(n.created_at) + (S.playing === n.id ? " · playing" : "") + "</div>" +
        '<label class="rm-l" for="ab-n-' + n.id + '">Pronunciation notes</label><textarea id="ab-n-' + n.id + '" class="bk-ta" data-ab-notes="' + n.id + '" maxlength="4000" placeholder="Names, places, scripture references — how you say them.">' + K.esc(n.pronunciation_notes || "") + "</textarea>" +
        '<div class="rm-row"><button class="btn small solid" type="button" data-ab-act="play" data-id="' + n.id + '">Play</button><button class="btn small" type="button" data-ab-act="del" data-id="' + n.id + '">Delete</button></div></div>';
    }).join("");
    return K.panel("Your narrations · " + K.fmtN(S.rows.length), "Private to your Passport. Playback links expire after an hour.",
      '<audio class="ab-player" controls id="ab-audio" preload="none">Your browser does not support audio playback.</audio>' +
      (S.rows.length ? '<div class="ab-list">' + items + "</div>" : '<p class="bk-empty">No narrations stored yet. Your first upload or recording appears here with its chapter link and notes.</p>'));
  }

  function render(el) {
    el.innerHTML = K.scene("Dream Board · Audiobook Studio", "Give the manuscript a voice.",
      "Bring in your own narration chapter by chapter, keep pronunciation notes beside each take, and listen back privately.",
      "art-hill-sunrise.jpg", (S.bookId ? '<a class="btn" href="#/book/' + S.bookId + '/outline">Chapters in Book Studio</a>' : '<a class="btn" href="#/book">Book Studio</a>') + '<a class="btn" href="#/r/reader">Reader</a>') +
      '<div class="bk-work two ab-work">' + addPanel() + listPanel() + "</div>";
  }

  async function store(el, blob, name, source, secs) {
    if (!blob || !blob.size) { K.toast("That file is empty.", true); return; }
    if (blob.size > MAX) { K.toast("That file is " + mb(blob.size) + "; the private shelf takes up to 50 MB per file.", true); return; }
    var uid = K.uid(); if (!uid) { K.toast("Sign in with your Passport first.", true); return; }
    S.busy = true; render(el);
    var titleIn = (S.titleDraft || "").trim();
    var path = uid + "/audiobook/" + (S.bookId || "loose") + "/" + Date.now() + "-" + safeName(name);
    var type = blob.type || "audio/mpeg";
    try {
      var up = await K.sb.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
      if (up.error) throw up.error;
      try {
        var row = await K.insert("dreamboard_audio_narrations", { book_id: S.bookId || null, chapter_id: S.chapterId || null, title: (titleIn || name).slice(0, 200), storage_path: path, mime_type: type.slice(0, 120), byte_size: blob.size, duration_seconds: secs || null, source: source });
        S.rows.unshift(row); S.titleDraft = "";
        K.toast((titleIn || name) + " is stored privately" + (S.chapterId ? " and linked to its chapter." : "."));
        return true;
      } catch (e) {
        await K.sb.storage.from(BUCKET).remove([path]); // never leave an orphan file without its record
        throw e;
      }
    } catch (e) {
      K.toast("The narration could not be stored: " + (e.message || e), true);
    } finally { S.busy = false; render(el); }
  }

  DBRoom.register("audiobook", {
    mount: async function (el) {
      S = { books: [], chapters: [], allChapters: {}, rows: [], bookId: "", chapterId: "", busy: false, playing: null, rec: null, titleDraft: "" };
      el.innerHTML = '<p class="loading">Opening Audiobook Studio…</p>';
      try {
        S.rows = await K.list("dreamboard_audio_narrations", { select: COLS, order: "created_at", limit: 200 });
      } catch (e) {
        if (K.missingTable(e)) { el.innerHTML = K.scene("Dream Board · Audiobook Studio", "Give the manuscript a voice.", "", "art-hill-sunrise.jpg") + '<div class="bk-work one">' + K.setupNotice("Audiobook Studio", "supabase/dreamboard-os-publish.sql") + "</div>"; return; }
        throw e;
      }
      try { S.books = await K.list("dreamboard_books", { select: "id,title,updated_at", order: "updated_at" }); } catch (e) { S.books = []; }
      var linked = Array.from(new Set(S.rows.map(function (r) { return r.chapter_id; }).filter(Boolean)));
      if (linked.length) { try { (await K.q(K.sb.from("dreamboard_book_chapters").select("id,title,position,book_id").in("id", linked))).forEach(function (c) { S.allChapters[c.id] = c; }); } catch (e) { /* titles only */ } }
      if (S.books.length) { S.bookId = S.books[0].id; await loadChapters(S.bookId); }
      render(el);

      var timer = null;
      function stopTracks() { if (S.rec && S.rec.stream) S.rec.stream.getTracks().forEach(function (t) { t.stop(); }); }
      function clearTake() { if (S.rec && S.rec.url) URL.revokeObjectURL(S.rec.url); S.rec = null; }

      el.addEventListener("input", function (e) { if (e.target.id === "ab-title") S.titleDraft = e.target.value; });
      el.addEventListener("change", async function (e) {
        var t = e.target;
        if (t.dataset.ab === "book") { S.bookId = t.value; S.chapterId = ""; try { await loadChapters(S.bookId); } catch (err) { K.toast(err.message, true); } render(el); }
        else if (t.dataset.ab === "chapter") { S.chapterId = t.value; }
        else if (t.id === "ab-file") { var f = t.files && t.files[0]; t.value = ""; if (f) await store(el, f, f.name, "uploaded", null); }
        else if (t.dataset.abNotes) {
          var id = t.dataset.abNotes, row = S.rows.find(function (r) { return r.id === id; }); if (!row || row.pronunciation_notes === t.value) return;
          try { var u = await K.update("dreamboard_audio_narrations", id, { pronunciation_notes: t.value.slice(0, 4000), updated_at: new Date().toISOString() }); row.pronunciation_notes = u.pronunciation_notes; K.toast("Pronunciation notes saved."); }
          catch (err) { K.toast("Notes could not save: " + err.message, true); }
        }
      });
      el.addEventListener("click", async function (e) {
        var b = e.target.closest("[data-ab-act]"); if (!b || !el.contains(b)) return;
        var act = b.dataset.abAct;
        if (act === "choose") { el.querySelector("#ab-file").click(); }
        else if (act === "record") {
          clearTake();
          try {
            var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            var mr = new MediaRecorder(stream), chunks = [], t0 = Date.now();
            S.rec = { state: "recording", stream: stream, mr: mr, secs: 0 };
            mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
            mr.onstop = function () {
              clearInterval(timer); stopTracks();
              var blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
              S.rec = { state: "done", blob: blob, url: URL.createObjectURL(blob), secs: (Date.now() - t0) / 1000 };
              if (el.isConnected) render(el);
            };
            mr.start(1000);
            timer = setInterval(function () { if (!el.isConnected) { try { mr.stop(); } catch (x) {} return; } S.rec.secs = (Date.now() - t0) / 1000; var tt = el.querySelector("[data-ab-time]"); if (tt) tt.textContent = clock(S.rec.secs); }, 500);
            render(el);
          } catch (err) { K.toast("The microphone did not open: " + (err.message || err), true); S.rec = null; render(el); }
        }
        else if (act === "stop") { if (S.rec && S.rec.mr && S.rec.mr.state !== "inactive") S.rec.mr.stop(); }
        else if (act === "discard") { clearTake(); render(el); }
        else if (act === "keep") {
          var r = S.rec; if (!r || !r.blob) return;
          var ext = /ogg/.test(r.blob.type) ? "ogg" : /mp4|m4a|aac/.test(r.blob.type) ? "m4a" : "webm";
          var ok = await store(el, r.blob, "recording-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + "." + ext, "recorded", r.secs);
          if (ok) { clearTake(); render(el); }
        }
        else if (act === "play") {
          var n = S.rows.find(function (x) { return x.id === b.dataset.id; }); if (!n) return;
          var s = await K.sb.storage.from(BUCKET).createSignedUrl(n.storage_path, 3600);
          if (s.error || !s.data || !s.data.signedUrl) { K.toast("This narration could not be opened: " + ((s.error && s.error.message) || "no link"), true); return; }
          S.playing = n.id; render(el);
          var a = el.querySelector("#ab-audio"); a.src = s.data.signedUrl; a.play().catch(function () { /* autoplay blocked: controls are there */ });
          a.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        else if (act === "del") {
          var d = S.rows.find(function (x) { return x.id === b.dataset.id; }); if (!d) return;
          if (!window.confirm("Delete the narration “" + d.title + "”? The audio file is removed from your private storage. This cannot be undone.")) return;
          var rm = await K.sb.storage.from(BUCKET).remove([d.storage_path]);
          if (rm.error) { K.toast("The audio file could not be removed: " + rm.error.message, true); return; }
          try { await K.remove("dreamboard_audio_narrations", d.id); } catch (err) { K.toast("The record could not be deleted: " + err.message, true); return; }
          S.rows = S.rows.filter(function (x) { return x.id !== d.id; }); if (S.playing === d.id) S.playing = null;
          render(el); K.toast("The narration was deleted from your private storage.");
        }
      });
    }
  });
})();
