/* Dream Board OS · Voice Guardian (ported from ~/dreamboard app/voice-guardian.tsx + lib/voice-guardian.ts +
 * supabase/dreamboard-voice-guardian.sql). 2026-11-12.
 * The writer keeps samples of their own voice (dreamboard_voice_references). A deterministic fingerprint — counts only,
 * no AI, no model training, no voice cloning — describes those samples, and a check compares any draft against it. */
(function () {
  "use strict";
  var K = window.DBKit, esc = K.esc, SQL = "supabase/dreamboard-os-build.sql";
  var STOP = new Set("a an the and or but if then so of to in on at by for with from as is are was were be been being it its it's this that these those i me my mine we us our you your he him his she her they them their not no do does did have has had will would can could should just than too very there here what which who whom when where why how all any some into out up down over about also only own same such more most other each few both because while until again once".split(" "));

  // ---- deterministic fingerprint ----
  function fingerprint(text) {
    var t = String(text || "").replace(/\r/g, "");
    var words = t.match(/[A-Za-zÀ-ɏ0-9'’]+/g) || [];
    var lower = words.map(function (w) { return w.toLowerCase().replace(/’/g, "'"); });
    var sentences = t.split(/(?<=[.!?…])\s+|\n{2,}/).map(function (s) { return s.trim(); }).filter(function (s) { return /[A-Za-z0-9]/.test(s); });
    var lens = sentences.map(function (s) { return (s.match(/[A-Za-zÀ-ɏ0-9'’]+/g) || []).length; });
    var n = words.length, sc = sentences.length || 1;
    var mean = lens.reduce(function (a, b) { return a + b; }, 0) / sc;
    var sd = Math.sqrt(lens.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / sc);
    // moving-window type-token ratio (100-word windows) so long and short texts compare fairly
    var ttr = 0, win = Math.min(100, n), cnt = 0;
    if (n) { for (var i = 0; i + win <= n; i += 50) { ttr += new Set(lower.slice(i, i + win)).size / win; cnt++; } ttr = cnt ? ttr / cnt : 0; }
    var freq = {}; lower.forEach(function (w) { if (w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)) freq[w] = (freq[w] || 0) + 1; });
    var top = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a] || (a < b ? -1 : 1); }).slice(0, 15).map(function (w) { return [w, freq[w]]; });
    var per100 = function (x) { return n ? (x / n) * 100 : 0; };
    var count = function (re) { return (t.match(re) || []).length; };
    return {
      words: n, sentences: sentences.length,
      m: {
        sentLen: mean, sentSd: sd,
        shortShare: sentences.length ? lens.filter(function (l) { return l < 8; }).length / sc * 100 : 0,
        longShare: sentences.length ? lens.filter(function (l) { return l > 25; }).length / sc * 100 : 0,
        wordLen: n ? lower.reduce(function (a, w) { return a + w.length; }, 0) / n : 0,
        ttr: ttr * 100,
        commas: count(/,/g) / sc,
        questions: count(/\?/g) / sc * 100,
        exclaims: count(/!/g) / sc * 100,
        dashes: per100(count(/—|–| - |--/g)) * 10,
        contractions: per100(lower.filter(function (w) { return /'(s|t|re|ve|ll|d|m)$/.test(w); }).length),
        firstPerson: per100(lower.filter(function (w) { return /^(i|me|my|mine|we|us|our|ours|i'm|i've|i'll|i'd)$/.test(w); }).length)
      },
      top: top, vocab: new Set(lower)
    };
  }
  var METRICS = [
    ["sentLen", "Average sentence length", "words", 1],
    ["sentSd", "Sentence-length variety", "words (spread)", 1],
    ["shortShare", "Short sentences (under 8 words)", "% of sentences", 0],
    ["longShare", "Long sentences (over 25 words)", "% of sentences", 0],
    ["wordLen", "Average word length", "letters", 2],
    ["ttr", "Vocabulary variety", "% new words per 100", 0],
    ["commas", "Commas per sentence", "", 2],
    ["questions", "Questions", "% of sentences", 0],
    ["exclaims", "Exclamations", "% of sentences", 0],
    ["dashes", "Dashes", "per 1,000 words", 1],
    ["contractions", "Contractions", "per 100 words", 1],
    ["firstPerson", "First person (I, me, we…)", "per 100 words", 1]
  ];
  // Close / drifting / far: relative difference with a small absolute floor so tiny numbers don't over-react.
  var FLOOR = { sentLen: 2, sentSd: 2, shortShare: 6, longShare: 6, wordLen: 0.25, ttr: 4, commas: 0.3, questions: 4, exclaims: 4, dashes: 2, contractions: 0.8, firstPerson: 0.8 };
  function band(key, a, b) { var d = Math.abs(a - b), rel = d / Math.max(Math.abs(a), FLOOR[key] * 2); if (d <= FLOOR[key] || rel <= 0.2) return "close"; if (rel <= 0.45) return "drifting"; return "far"; }
  function fmt(x, dp) { return (Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp)).toLocaleString(); }

  function coverage(words, n) { if (!n) return "No samples yet"; if (words < 150) return "Early sample set"; if (words < 750) return "Growing sample set"; return "Substantial sample set"; }

  K.css("voice", [
    ".vg-tbl{width:100%;border-collapse:collapse;font-size:14px}",
    ".vg-tbl th,.vg-tbl td{text-align:left;padding:7px 6px;border-bottom:1px solid rgba(217,181,108,.12);vertical-align:top}",
    ".vg-tbl th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:500}",
    ".vg-tbl td.n{font-variant-numeric:tabular-nums;white-space:nowrap}",
    ".vg-tbl small{display:block;color:var(--muted);font-size:11px}",
    ".vg-b{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid;white-space:nowrap}",
    ".vg-b.close{color:#9fd3a6;border-color:rgba(159,211,166,.5)} .vg-b.drifting{color:var(--gold-hi);border-color:var(--gold-dim)} .vg-b.far{color:#e59a86;border-color:rgba(229,154,134,.55)}",
    ".vg-words{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}",
    ".vg-words span{font-size:12px;padding:3px 9px;border-radius:999px;background:rgba(217,181,108,.1);color:var(--gold-hi)}",
    ".vg-words.new span{background:rgba(159,199,232,.1);color:#bcd8ee}",
    ".vg-det{display:inline-block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#1b1407;background:var(--gold);padding:2px 8px;border-radius:999px;margin-bottom:8px}",
    ".vg-sum{font-family:var(--serif);font-size:22px;color:var(--cream);margin:4px 0 10px}",
    ".vg-ex{white-space:pre-wrap;font-family:var(--serif);font-size:16px;line-height:1.5;margin:6px 0;overflow-wrap:anywhere}",
    ".vg-tog{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--cream-dim)} .vg-tog input{width:18px;height:18px;accent-color:var(--gold);flex:0 0 auto;margin-top:2px}",
    "@media (max-width:560px){.vg-tbl .hide-s{display:none}}"
  ].join("\n"));

  DBRoom.register("voice", {
    mount: async function (el) {
      var sb = K.sb;
      var S = { refs: [], projects: [], docs: [], scope: "", draft: "", draftFrom: "", result: null, miss: false };
      el.innerHTML = K.scene("Dream Board OS · Create", "Voice Guardian", "Opening your voice samples…", "art-orchard.jpg");
      var r = await Promise.all([
        K.q(sb.from("dreamboard_projects").select("id,title").order("updated_at", { ascending: false })),
        K.q(sb.from("dreamboard_writing_documents").select("id,project_id,title,chapter_number,body").order("updated_at", { ascending: false }).limit(200)),
        sb.from("dreamboard_active_context").select("primary_id").limit(1)
      ]);
      S.projects = r[0]; S.docs = r[1]; S.scope = (r[2].data && r[2].data[0] && r[2].data[0].primary_id) || "";
      try { S.refs = await K.list("dreamboard_voice_references", { select: "id,project_id,label,excerpt,created_at", order: "created_at" }); }
      catch (e) { if (K.missingTable(e)) S.miss = true; else throw e; }

      function inScope() { return S.refs.filter(function (x) { return !x.project_id || !S.scope || x.project_id === S.scope; }); }
      function pname(id) { var p = S.projects.filter(function (x) { return x.id === id; })[0]; return p ? p.title : "a removed project"; }

      function samplesPanel() {
        var list = inScope(), w = list.reduce(function (a, x) { return a + K.words(x.excerpt); }, 0);
        var sopts = '<option value="">All my writing</option>' + S.projects.map(function (p) { return '<option value="' + p.id + '"' + (S.scope === p.id ? " selected" : "") + ">" + esc(p.title) + "</option>"; }).join("");
        return K.panel("Your voice samples", "Passages you wrote (or have permission to use) whose rhythm, vocabulary and perspective you want to keep. Private to your Passport. Never used to train a model or clone a voice.",
          '<div class="rm-row" style="margin-bottom:10px"><label class="rm-l" for="vg-sc">Project</label><select class="bk-in" style="width:auto;max-width:100%" id="vg-sc" data-a="scope">' + sopts + '</select><span class="pj-badge" style="font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--gold-dim);color:var(--gold-hi)">' + coverage(w, list.length) + "</span></div>" +
          '<p class="rm-meta">' + list.length + " sample" + (list.length === 1 ? "" : "s") + " · " + K.fmtN(w) + " source words. Coverage is a word count, not a confidence claim." + (S.scope ? " Showing this project’s samples plus samples for all your writing." : "") + "</p>" +
          '<form class="rm-form" data-f="add" style="margin:12px 0"><label class="rm-l" for="vg-l">Where it came from</label><input class="bk-in" id="vg-l" name="label" maxlength="240" required placeholder="e.g. Chapter 2 — original draft">' +
          '<label class="rm-l" for="vg-x">Your own excerpt (20+ words)</label><textarea class="bk-in" id="vg-x" name="excerpt" maxlength="5000" required style="min-height:120px;font-family:var(--serif);font-size:17px" placeholder="Paste a passage in your real voice…"></textarea>' +
          '<label class="vg-tog"><input type="checkbox" name="consent"> This is my work, or I have permission to use it as a private reference.</label><div class="rm-row"><button class="btn solid">Save voice sample</button><span class="bk-note">Saved to ' + (S.scope ? "“" + esc(pname(S.scope)) + "”" : "all my writing") + "</span></div></form>" +
          (list.map(function (x) { return '<div class="rm-item" style="margin-bottom:10px"><h4>' + esc(x.label) + '</h4><div class="rm-meta">' + K.fmtN(K.words(x.excerpt)) + " words · " + (x.project_id ? esc(pname(x.project_id)) : "All my writing") + " · " + K.fmtDay(x.created_at) + '</div><div class="vg-ex">' + esc(x.excerpt.length > 320 ? x.excerpt.slice(0, 320) + "…" : x.excerpt) + '</div><button class="btn small" data-a="del" data-id="' + x.id + '">Remove</button></div>'; }).join("") || K.empty("No samples yet. Add a passage you wrote in your own voice — the fingerprint is built only from what you add here.")));
      }
      function fpPanel() {
        var list = inScope(); if (!list.length) return "";
        var f = fingerprint(list.map(function (x) { return x.excerpt; }).join("\n\n"));
        return K.panel("Your voice fingerprint", "", '<span class="vg-det">Deterministic · counts only · no AI</span><p class="bk-note">Measured from ' + K.fmtN(f.words) + " words in " + f.sentences + " sentences of your samples. The same text always gives the same numbers.</p>" +
          '<table class="vg-tbl"><thead><tr><th>Measure</th><th>Your samples</th></tr></thead><tbody>' + METRICS.map(function (m) { return "<tr><td>" + m[1] + (m[2] ? "<small>" + m[2] + "</small>" : "") + '</td><td class="n">' + fmt(f.m[m[0]], m[3]) + "</td></tr>"; }).join("") + "</tbody></table>" +
          '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:14px 0 4px">Your most-used words</div><div class="vg-words">' + (f.top.map(function (t) { return "<span>" + esc(t[0]) + " · " + t[1] + "</span>"; }).join("") || '<span>Not enough words yet</span>') + "</div>");
      }
      function checkPanel() {
        var dopts = '<option value="">Paste a draft below…</option>' + S.docs.map(function (d) { return '<option value="' + d.id + '"' + (S.draftFrom === d.id ? " selected" : "") + ">" + esc(d.title) + " · ch. " + d.chapter_number + " · " + K.fmtN(K.words(d.body)) + " words</option>"; }).join("");
        var res = "";
        if (S.result) {
          var a = S.result.a, b = S.result.b, rows = METRICS.map(function (m) { var bd = band(m[0], a.m[m[0]], b.m[m[0]]); return { m: m, bd: bd }; });
          var close = rows.filter(function (x) { return x.bd === "close"; }).length, far = rows.filter(function (x) { return x.bd === "far"; });
          var topA = new Set(a.top.map(function (t) { return t[0]; })), shared = b.top.filter(function (t) { return topA.has(t[0]); }), fresh = b.top.filter(function (t) { return !a.vocab.has(t[0]); });
          res = '<div style="margin-top:14px"><span class="vg-det">Deterministic check · not an AI judgment</span><div class="vg-sum">' + close + " of " + METRICS.length + " measures sit close to your samples.</div>" +
            (b.words < 80 ? '<p class="bk-note">This draft is short (' + b.words + " words), so the numbers move a lot. Treat them lightly.</p>" : "") +
            (far.length ? '<p class="bk-help">Furthest from your samples: ' + far.map(function (x) { return x.m[1].toLowerCase(); }).join(", ") + ". That is not wrong — just a place to reread with your own ear.</p>" : '<p class="bk-help">Nothing here is far from your samples.</p>') +
            '<table class="vg-tbl"><thead><tr><th>Measure</th><th class="hide-s">Samples</th><th>Draft</th><th></th></tr></thead><tbody>' + rows.map(function (x) { var m = x.m; return "<tr><td>" + m[1] + (m[2] ? "<small>" + m[2] + "</small>" : "") + '</td><td class="n hide-s">' + fmt(a.m[m[0]], m[3]) + '</td><td class="n">' + fmt(b.m[m[0]], m[3]) + '</td><td><span class="vg-b ' + x.bd + '">' + x.bd + "</span></td></tr>"; }).join("") + "</tbody></table>" +
            '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:14px 0 4px">Your signature words in this draft</div><div class="vg-words">' + (shared.map(function (t) { return "<span>" + esc(t[0]) + "</span>"; }).join("") || "<span>None of your top words appear among the draft’s top words</span>") + "</div>" +
            '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:6px 0 4px">Frequent draft words never seen in your samples</div><div class="vg-words new">' + (fresh.map(function (t) { return "<span>" + esc(t[0]) + " · " + t[1] + "</span>"; }).join("") || "<span>None</span>") + "</div>" +
            '<p class="bk-note">Close = within 20% (or a small fixed margin) of your samples; drifting = within 45%; far = beyond that. Your draft is not changed.</p></div>';
        }
        return K.panel("Check a draft", "Compare any draft with your samples. Read-only: the check never edits your words.",
          '<form class="rm-form" data-f="check"><label class="rm-l" for="vg-d">From Writing Studio</label><select class="bk-in" id="vg-d" data-a="doc">' + dopts + '</select><label class="sr-only" for="vg-t">Draft</label><textarea class="bk-in" id="vg-t" name="draft" style="min-height:150px;font-family:var(--serif);font-size:17px" placeholder="…or paste a draft here">' + esc(S.draft) + '</textarea><div class="rm-row"><button class="btn solid"' + (inScope().length ? "" : " disabled") + '>Check against my voice</button>' + (inScope().length ? "" : '<span class="bk-note">Add a voice sample first.</span>') + "</div></form>" + res);
      }
      function paint() {
        el.innerHTML = K.scene("Dream Board OS · Create", "Voice Guardian", "Protect the voice you brought here. Keep samples of your real writing, see their fingerprint, and check any draft against them.", "art-orchard.jpg",
          '<a class="btn" href="#/r/writing">Writing Studio</a><a class="btn" href="#/book">Book Studio</a>') +
          (S.miss ? '<div class="bk-work one">' + K.setupNotice("Voice Guardian", SQL) + "</div>" : '<div class="bk-work two" style="--bk-rail:minmax(0,1fr)">' + '<div style="display:grid;gap:18px">' + samplesPanel() + "</div>" + '<div style="display:grid;gap:18px">' + checkPanel() + fpPanel() + "</div></div>");
      }
      paint();

      el.addEventListener("change", function (e) {
        var t = e.target;
        if (t.dataset.a === "scope") { S.scope = t.value; S.result = null; paint(); }
        if (t.dataset.a === "doc") { S.draftFrom = t.value; var d = S.docs.filter(function (x) { return x.id === t.value; })[0]; S.draft = d ? d.body : ""; S.result = null; paint(); }
      });
      el.addEventListener("input", function (e) { if (e.target.id === "vg-t") { S.draft = e.target.value; } });
      el.addEventListener("click", async function (e) {
        var b = e.target.closest("[data-a=del]"); if (!b) return;
        if (!confirm("Remove this private voice sample?")) return;
        try { await K.remove("dreamboard_voice_references", b.dataset.id); S.refs = S.refs.filter(function (x) { return x.id !== b.dataset.id; }); S.result = null; K.toast("Voice sample removed."); paint(); }
        catch (er) { K.toast("Could not remove: " + (er.message || er), true); }
      });
      el.addEventListener("submit", async function (e) {
        var f = e.target.closest("form[data-f]"); if (!f) return; e.preventDefault();
        if (f.dataset.f === "add") {
          var label = f.elements.label.value.trim(), ex = f.elements.excerpt.value.trim();
          if (label.length < 2) return K.toast("Name where this voice sample came from.", true);
          if (K.words(ex) < 20) return K.toast("Add at least 20 words so the sample has enough context.", true);
          if (!f.elements.consent.checked) return K.toast("Confirm this is your work, or that you have permission to use it.", true);
          try { var row = await K.insert("dreamboard_voice_references", { project_id: S.scope || null, label: label, excerpt: ex, consented_at: new Date().toISOString() }); S.refs.unshift(row); S.result = null; K.toast("Private voice sample saved. It is not used for model training."); paint(); }
          catch (er) { K.toast("The voice sample could not be saved: " + (er.message || er), true); }
          return;
        }
        if (f.dataset.f === "check") {
          S.draft = f.elements.draft.value;
          if (K.words(S.draft) < 20) return K.toast("Add at least 20 words of draft to check.", true);
          S.result = { a: fingerprint(inScope().map(function (x) { return x.excerpt; }).join("\n\n")), b: fingerprint(S.draft) };
          paint(); var n = el.querySelector(".vg-sum"); if (n) n.scrollIntoView({ block: "center" });
        }
      });
    }
  });
})();
