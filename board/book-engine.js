/* Dream Board · Book Studio engine (Above the Hill Developments, 2026-11-12)
 * Pure functions shared by the browser worker (importScripts) and Node (require) — no DOM.
 * It ORGANIZES the author's words: parse → passages → themes → duplicates → idea seeds → outline.
 * It never writes prose. Every summary is the author's own sentences; every question is a template
 * filled with the author's own terms. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BookEngine = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";

  // ---------------- text helpers ----------------
  function words(s) { var m = String(s || "").match(/[A-Za-z0-9À-ɏ'’]+/g); return m ? m.length : 0; }
  function clean(s) {
    return String(s || "").replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function toISO(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") { var ms = v < 1e12 ? v * 1000 : v; var d = new Date(ms); return isNaN(d) ? null : d.toISOString(); }
    var s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?Z?$/.test(s)) { s = s.replace(" ", "T"); if (s.length === 10) s += "T12:00:00"; if (!/Z$/.test(s)) s += "Z"; }
    var d2 = new Date(s); return isNaN(d2) ? null : d2.toISOString();
  }
  function decodeEntities(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, "&");
  }

  // ---------------- parsers ----------------
  // A "unit" is one message or one block of writing: { text, speaker: 'author'|'ai'|'other', at, thread }
  var AUTHOR_ROLES = /^(user|you|founder|human|me|author|king david|spaid|dave)$/i;
  var AI_ROLES = /^(assistant|chatgpt|gpt|grok|claude|ai|model|bot|system|tool|gemini|copilot|spaidbot)$/i;
  function roleOf(name) {
    var n = String(name || "").trim().replace(/[:\s]+$/, "");
    if (AUTHOR_ROLES.test(n)) return "author";
    if (AI_ROLES.test(n) || /^tool:/i.test(n)) return "ai";
    return "other";
  }

  function parseChatGPTExport(json) {
    var convs = Array.isArray(json) ? json : (json && Array.isArray(json.conversations) ? json.conversations : null);
    if (!convs || !convs.length || !convs[0] || !convs[0].mapping) return null;
    var units = [];
    convs.forEach(function (c) {
      var title = c.title || "ChatGPT conversation";
      var nodes = Object.keys(c.mapping).map(function (k) { return c.mapping[k]; }).filter(function (n) { return n && n.message; });
      nodes.sort(function (a, b) { return (a.message.create_time || 0) - (b.message.create_time || 0); });
      nodes.forEach(function (n) {
        var m = n.message, role = m.author && m.author.role;
        if (!m.content) return;
        var parts = m.content.parts || (m.content.text ? [m.content.text] : []);
        var text = parts.filter(function (p) { return typeof p === "string"; }).join("\n\n");
        if (!text.trim()) return;
        units.push({ text: text, speaker: role === "user" ? "author" : role === "assistant" ? "ai" : "other", at: toISO(m.create_time || c.create_time), thread: title });
      });
    });
    return { kind: "chatgpt", units: units };
  }

  function parseGrokExport(json) {
    var convs = json && (json.conversations || (Array.isArray(json) ? json : null));
    if (!convs || !convs.length) return null;
    var first = convs[0];
    if (!(first && (first.responses || (first.conversation && first.responses)))) return null;
    var units = [];
    convs.forEach(function (c) {
      var meta = c.conversation || c;
      var title = meta.title || "Grok conversation";
      (c.responses || []).forEach(function (r) {
        var x = r.response || r;
        var text = x.message || x.text || "";
        if (!String(text).trim()) return;
        var sender = String(x.sender || x.role || "").toLowerCase();
        var at = x.create_time && (x.create_time.$date ? (x.create_time.$date.$numberLong ? +x.create_time.$date.$numberLong : x.create_time.$date) : x.create_time);
        units.push({ text: String(text), speaker: sender === "human" || sender === "user" ? "author" : "ai", at: toISO(at || meta.create_time), thread: title });
      });
    });
    return { kind: "grok", units: units };
  }

  // Generic JSON: walk for objects that look like messages ({role|sender|author, content|text|message}).
  function parseGenericJSON(json, name) {
    var units = [];
    (function walk(o, title, depth) {
      if (!o || depth > 12) return;
      if (Array.isArray(o)) { o.forEach(function (x) { walk(x, title, depth + 1); }); return; }
      if (typeof o !== "object") return;
      var t = o.title || o.name || title;
      var who = o.role || o.sender || (o.author && (o.author.role || o.author.name || o.author)) || o.from;
      var body = o.content != null ? o.content : (o.text != null ? o.text : o.message);
      if (who && body != null) {
        if (Array.isArray(body)) body = body.map(function (b) { return typeof b === "string" ? b : (b && (b.text || b.content)) || ""; }).join("\n\n");
        if (typeof body === "object") body = body.text || (body.parts || []).join("\n\n") || "";
        if (String(body).trim()) units.push({ text: String(body), speaker: roleOf(typeof who === "string" ? who : ""), at: toISO(o.create_time || o.created_at || o.timestamp || o.date), thread: t || name });
        return;
      }
      Object.keys(o).forEach(function (k) { if (typeof o[k] === "object") walk(o[k], t, depth + 1); });
    })(json, name, 0);
    return units.length ? { kind: "json", units: units } : null;
  }

  // Chat transcripts saved as text/markdown.
  // Supports: "## FOUNDER [3] 2025-05-15 23:01Z", "## GROK 2026-02-11T03:58", "===== USER 2026-08-06 08:47 =====",
  // "You said:" / "ChatGPT said:" blocks, and "User:" / "Assistant:" line prefixes.
  var HEAD_RES = [
    /^#{2,3}\s+([A-Za-z][A-Za-z :]{0,30}?)\s*(?:\[\d+\])?\s*(\d{4}-\d{2}-\d{2}[T ]?[\d:]*Z?)?\s*$/,
    /^=====\s+([A-Za-z][A-Za-z ]{0,30}?)\s+(\d{4}-\d{2}-\d{2}[ T][\d:]+)?\s*=====\s*$/,
    /^(You|ChatGPT|Grok|Claude|Assistant|User)\s+said:\s*$/i,
    /^\[\d+\]\s+(USER|ASSISTANT|GROK|CHATGPT|FOUNDER)\s*$/
  ];
  function parseTranscript(text, name) {
    var lines = clean(text).split("\n"), units = [], cur = null, heads = 0, title = name;
    var m0 = lines[0] && lines[0].match(/^#\s+(.+)/); if (m0) title = m0[1].trim();
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], hit = null;
      for (var r = 0; r < HEAD_RES.length && !hit; r++) hit = ln.match(HEAD_RES[r]);
      if (hit) {
        var role = roleOf(hit[1]);
        if (role === "other" && !/^(tool|system)/i.test(hit[1])) { if (cur) cur.lines.push(ln); continue; }
        heads++;
        if (cur) units.push(cur);
        cur = { speaker: role, at: toISO(hit[2] || null), lines: [], thread: title };
        continue;
      }
      if (cur) cur.lines.push(ln);
    }
    if (cur) units.push(cur);
    if (heads < 2) return null;
    return { kind: "transcript", units: units.map(function (u) { return { text: u.lines.join("\n"), speaker: u.speaker, at: u.at, thread: u.thread }; }).filter(function (u) { return u.text.trim(); }) };
  }

  function parseProse(text, name, kind) {
    return { kind: kind || "text", units: [{ text: clean(text), speaker: "author", at: null, thread: name }] };
  }

  // DOCX: word/document.xml → paragraphs. (zip handling lives in the caller; this takes the XML string.)
  function docxXmlToText(xml) {
    var out = [];
    var paras = xml.split(/<\/w:p>/);
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var t = "";
      var re = /<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g, m;
      while ((m = re.exec(p))) t += m[1] != null ? m[1] : (m[0] === "<w:tab/>" ? "\t" : "\n");
      out.push(decodeEntities(t));
    }
    return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function parseAny(name, text) {
    var lower = String(name || "").toLowerCase();
    var trimmed = String(text || "").trim();
    if (/\.json$/.test(lower) || /^[\[{]/.test(trimmed)) {
      try {
        var json = JSON.parse(trimmed);
        return parseChatGPTExport(json) || parseGrokExport(json) || parseGenericJSON(json, name) || parseProse(JSON.stringify(json, null, 1), name, "json");
      } catch (e) { /* not JSON after all */ }
    }
    if (/\.html?$/.test(lower) || /^<!doctype html|^<html/i.test(trimmed)) {
      var plain = decodeEntities(trimmed.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li)>/gi, "\n\n").replace(/<[^>]+>/g, ""));
      return parseTranscript(plain, name) || parseProse(plain, name, "html");
    }
    return parseTranscript(trimmed, name) || parseProse(trimmed, name, /\.md$/.test(lower) ? "md" : "text");
  }

  // ---------------- passages ----------------
  // Paragraph-first. Short paragraphs from the same thread+speaker merge until ~MIN words;
  // very long paragraphs split at sentence ends near MAX words.
  var MIN = 45, TARGET = 160, MAX = 380;
  function sentences(s) {
    var out = s.match(/[^.!?\n]+(?:[.!?]+["'”’)\]]*|\n|$)/g) || [s];
    return out.map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function stripNoise(t) {
    return t.replace(/^\s*\[(image|file|attachment)[^\]]*\]\s*$/gim, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/```[\s\S]*?```/g, function (b) { return b.length > 1200 ? "" : b; });
  }
  function toPassages(units, opts) {
    opts = opts || {};
    var keepAI = !!opts.keepAI;
    var out = [], buf = null;
    function flush() { if (buf && buf.text.trim()) out.push(buf); buf = null; }
    units.forEach(function (u) {
      if (u.speaker !== "author" && !(keepAI && u.speaker === "ai")) return;
      var paras = stripNoise(clean(u.text)).split(/\n\s*\n/);
      paras.forEach(function (para) {
        para = para.trim(); if (!para || /^([-*_=~]\s*){3,}$/.test(para)) return;
        var w = words(para);
        if (w > MAX) {
          flush();
          var chunk = "", cw = 0;
          sentences(para).forEach(function (s) {
            var sw = words(s);
            if (cw + sw > TARGET && cw >= MIN) { out.push({ text: chunk.trim(), speaker: u.speaker, at: u.at, thread: u.thread }); chunk = ""; cw = 0; }
            chunk += (chunk ? " " : "") + s; cw += sw;
          });
          if (chunk.trim()) buf = { text: chunk.trim(), speaker: u.speaker, at: u.at, thread: u.thread };
          return;
        }
        if (buf && buf.thread === u.thread && buf.speaker === u.speaker && words(buf.text) < MIN && words(buf.text) + w <= MAX) {
          buf.text += "\n\n" + para;
        } else { flush(); buf = { text: para, speaker: u.speaker, at: u.at, thread: u.thread }; }
        if (words(buf.text) >= TARGET) flush();
      });
      // a message boundary is a natural break once the buffer is big enough
      if (buf && words(buf.text) >= MIN) flush();
    });
    flush();
    return out.map(function (p) { p.words = words(p.text); return p; }).filter(function (p) { return p.words >= 4; });
  }

  // ---------------- vectors ----------------
  var STOP = new Set(("a about above after again against all also am an and any are aren as at be because been before being below between both but by can cannot could couldn did didn do does doesn doing don down during each few for from further had hadn has hasn have haven having he her here hers herself him himself his how i if in into is isn it its itself just let me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was wasn we were weren what when where which while who whom why will with won would wouldn you your yours yourself yourselves " +
    "im ive id ill youre youve youll thats theres whats lets dont cant wont didnt doesnt isnt wasnt arent gonna wanna gotta yeah yes yea yep nah no ok okay like just really thing things stuff get got getting go going gone make made know knew think thought say said tell told want need one two also even still back way well much many lot lots something anything everything nothing someone everyone kind sort right now today then than maybe actually literally basically pretty bro bruh fam yo lol lmao man dude shit fuck fucking damn ass bitch nigga niggas hell oh uh um hey hi please thank thanks sure good great new old first last next every come came see saw look use used using put take took give gave keep let feel felt mean means call called time times day days year years way ways people person part make makes need needs want wants work works cause kinda guess hes shes theyre yall gotta second seconds minute minutes hour hours anyway alright aint ima finna tryna" ).split(/\s+/));
  function tokens(s) {
    var m = String(s).toLowerCase().replace(/[’']/g, "").match(/[a-z][a-z0-9]{2,}/g) || [];
    var out = [];
    for (var i = 0; i < m.length; i++) {
      var w = m[i];
      if (STOP.has(w) || w.length > 24) continue;
      if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + "y";
      else if (w.length > 4 && /[^sui]s$/.test(w)) w = w.slice(0, -1);
      if (STOP.has(w)) continue;
      out.push(w);
    }
    return out;
  }

  function buildVectors(texts, vocabCap) {
    vocabCap = vocabCap || 6000;
    var N = texts.length, df = new Map(), toks = new Array(N);
    for (var i = 0; i < N; i++) {
      var t = tokens(texts[i]); toks[i] = t;
      var seen = new Set(t);
      seen.forEach(function (w) { df.set(w, (df.get(w) || 0) + 1); });
    }
    var minDf = N > 2000 ? 4 : N > 200 ? 3 : 2, maxDf = Math.max(3, Math.floor(N * 0.6));
    var cand = [];
    df.forEach(function (n, w) { if (n >= minDf && n <= maxDf) cand.push([w, n]); });
    cand.sort(function (a, b) { return b[1] - a[1]; });
    cand = cand.slice(0, vocabCap);
    var vocab = new Map(), terms = [], idf = new Float32Array(cand.length);
    cand.forEach(function (c, j) { vocab.set(c[0], j); terms.push(c[0]); idf[j] = Math.log((N + 1) / (c[1] + 0.5)); });
    var vecs = new Array(N);
    for (i = 0; i < N; i++) {
      var tf = new Map();
      toks[i].forEach(function (w) { var j = vocab.get(w); if (j != null) tf.set(j, (tf.get(j) || 0) + 1); });
      var idx = new Int32Array(tf.size), val = new Float32Array(tf.size), k = 0, norm = 0;
      tf.forEach(function (c, j) { idx[k] = j; var v = (1 + Math.log(c)) * idf[j]; val[k] = v; norm += v * v; k++; });
      norm = Math.sqrt(norm) || 1;
      for (k = 0; k < val.length; k++) val[k] /= norm;
      vecs[i] = { idx: idx, val: val };
    }
    return { vecs: vecs, terms: terms, idf: idf, vocab: vocab };
  }
  function dotDense(v, dense, off) { var s = 0; for (var k = 0; k < v.idx.length; k++) s += v.val[k] * dense[off + v.idx[k]]; return s; }

  // Deterministic PRNG so the same writing always yields the same themes.
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // Spherical k-means on sparse TF-IDF.
  function kmeans(vecs, V, k, iters, seed) {
    var N = vecs.length, rand = rng(seed || 7);
    var live = []; for (var i = 0; i < N; i++) if (vecs[i].idx.length) live.push(i);
    k = Math.max(1, Math.min(k, live.length));
    var C = new Float32Array(k * V), assign = new Int32Array(N).fill(-1);
    // k-means++ seeding on a sample
    var sample = live.length > 3000 ? live.filter(function () { return rand() < 3000 / live.length; }) : live.slice();
    var first = sample[Math.floor(rand() * sample.length)];
    var chosen = [first];
    function setC(c, vi) { var v = vecs[vi]; for (var q = 0; q < v.idx.length; q++) C[c * V + v.idx[q]] = v.val[q]; }
    setC(0, first);
    var best = new Float32Array(sample.length).fill(-2);
    for (var c = 1; c < k; c++) {
      var tot = 0, dist = new Float32Array(sample.length);
      for (var s = 0; s < sample.length; s++) {
        var sim = dotDense(vecs[sample[s]], C, (c - 1) * V);
        if (sim > best[s]) best[s] = sim;
        var d = Math.max(0, 1 - best[s]); dist[s] = d * d; tot += dist[s];
      }
      var r = rand() * tot, acc = 0, pick = sample[0];
      for (s = 0; s < sample.length; s++) { acc += dist[s]; if (acc >= r) { pick = sample[s]; break; } }
      chosen.push(pick); setC(c, pick);
    }
    for (var it = 0; it < (iters || 14); it++) {
      var moved = 0;
      for (i = 0; i < N; i++) {
        var v = vecs[i]; if (!v.idx.length) continue;
        var bi = 0, bs = -1;
        for (c = 0; c < k; c++) { var sc = dotDense(v, C, c * V); if (sc > bs) { bs = sc; bi = c; } }
        if (assign[i] !== bi) { assign[i] = bi; moved++; }
      }
      C.fill(0);
      var counts = new Int32Array(k);
      for (i = 0; i < N; i++) { if (assign[i] < 0) continue; counts[assign[i]]++; var w = vecs[i]; for (var q = 0; q < w.idx.length; q++) C[assign[i] * V + w.idx[q]] += w.val[q]; }
      for (c = 0; c < k; c++) {
        var nrm = 0; for (var j = 0; j < V; j++) nrm += C[c * V + j] * C[c * V + j];
        nrm = Math.sqrt(nrm);
        if (nrm > 0) for (j = 0; j < V; j++) C[c * V + j] /= nrm;
        else { var re = live[Math.floor(rand() * live.length)]; setC(c, re); }
      }
      if (moved < N * 0.002) break;
    }
    return { assign: assign, C: C, k: k };
  }

  function fnv(s, seed) { var h = 2166136261 ^ seed; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  // MinHash over word 3-shingles (32 hashes, LSH 8 bands × 4 rows; verified at estimated Jaccard ≥ 0.7).
  var MH = 32, MH_A = new Uint32Array(MH), MH_B = new Uint32Array(MH);
  (function () { var r = rng(20261112); for (var i = 0; i < MH; i++) { MH_A[i] = (Math.floor(r() * 4294967295) | 1) >>> 0; MH_B[i] = Math.floor(r() * 4294967295) >>> 0; } })();
  function minhash(n) {
    var w = n.split(" "), sig = new Uint32Array(MH).fill(4294967295), cnt = Math.max(1, w.length - 2);
    for (var i = 0; i < cnt; i++) {
      var h = fnv(w.slice(i, i + 3).join(" "), 0);
      for (var k = 0; k < MH; k++) { var v = (Math.imul(h, MH_A[k]) + MH_B[k]) >>> 0; if (v < sig[k]) sig[k] = v; }
    }
    return sig;
  }
  // dupOf[i] = index of the earlier passage it repeats (exact or near), else -1.
  function findDuplicates(texts) {
    var N = texts.length, dupOf = new Int32Array(N).fill(-1), exact = new Map(), sigs = new Array(N), bands = [];
    for (var b0 = 0; b0 < 8; b0++) bands.push(new Map());
    for (var i = 0; i < N; i++) {
      var n = norm(texts[i]);
      if (n.length < 12) continue;
      var key = fnv(n, 1) + ":" + n.length;
      if (exact.has(key)) { dupOf[i] = exact.get(key); continue; }
      exact.set(key, i);
      if (n.split(" ").length < 10) continue;
      var sig = minhash(n); sigs[i] = sig;
      var keys = [], found = -1;
      for (var b = 0; b < 8; b++) keys.push(sig[b * 4] + "," + sig[b * 4 + 1] + "," + sig[b * 4 + 2] + "," + sig[b * 4 + 3]);
      for (b = 0; b < 8 && found < 0; b++) {
        var list = bands[b].get(keys[b]);
        if (list) for (var q = 0; q < list.length; q++) {
          var o = sigs[list[q]], same = 0;
          for (var k = 0; k < MH; k++) if (o[k] === sig[k]) same++;
          if (same / MH >= 0.7) { found = list[q]; break; }
        }
      }
      if (found >= 0) { dupOf[i] = dupOf[found] >= 0 ? dupOf[found] : found; continue; }
      for (b = 0; b < 8; b++) { var l2 = bands[b].get(keys[b]); if (l2) l2.push(i); else bands[b].set(keys[b], [i]); }
    }
    return dupOf;
  }

  // Idea seeds: the author's own sentences that carry an intention, a "what if", a vision or an invention.
  var SEED_RES = [
    [/\bwhat if\b/i, 3], [/\bimagine\b/i, 2], [/\b(i|we) (want|wanna|need|have) to (build|make|create|write|start|launch|invent|design)\b/i, 3],
    [/\b(idea|invention|vision|dream|concept|prototype)\b/i, 1.5], [/\b(i'?m|i am|we'?re|we are) (gonna|going to) (build|make|create|write|start|launch)\b/i, 3],
    [/\bone day\b/i, 1.5], [/\bwe should\b/i, 2], [/\b(book|chapter|movie|film|game|app|device|company|nonprofit)\b/i, 1],
    [/\?\s*$/, 1]
  ];
  function findSeeds(texts, limit) {
    var out = [];
    for (var i = 0; i < texts.length; i++) {
      var ss = sentences(texts[i]), best = null;
      for (var s = 0; s < ss.length; s++) {
        var sen = ss[s], w = words(sen); if (w < 6 || w > 60) continue;
        var score = 0; for (var r = 0; r < SEED_RES.length; r++) if (SEED_RES[r][0].test(sen)) score += SEED_RES[r][1];
        if (score >= 2.5 && (!best || score > best.score)) best = { i: i, sentence: sen, score: score };
      }
      if (best) out.push(best);
    }
    var seen = new Set();
    out = out.filter(function (x) { var k = norm(x.sentence); if (seen.has(k)) return false; seen.add(k); return true; });
    out.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return limit ? out.slice(0, limit) : out;
  }

  function titleCase(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  // ---------------- analysis ----------------
  // passages: [{ text, at?, speaker? }] → themes, assignment, duplicates, seeds, month histogram.
  function analyze(passages, opts) {
    opts = opts || {};
    var texts = passages.map(function (p) { return p.text; });
    var N = texts.length;
    var dupOf = findDuplicates(texts);
    var use = []; for (var i = 0; i < N; i++) if (dupOf[i] < 0 && passages[i].speaker !== "ai") use.push(i);
    var model = buildVectors(use.map(function (i) { return texts[i]; }), opts.vocabCap);
    var V = model.terms.length;
    var k = opts.k || Math.max(4, Math.min(24, Math.round(Math.sqrt(use.length / 10))));
    var km = V ? kmeans(model.vecs, V, k, opts.iters || 14, opts.seed || 7) : { assign: new Int32Array(use.length), C: new Float32Array(0), k: 1 };
    k = km.k;
    var theme = new Int32Array(N).fill(-1), sims = new Float32Array(N);
    use.forEach(function (pi, u) { theme[pi] = km.assign[u]; sims[pi] = V ? dotDense(model.vecs[u], km.C, km.assign[u] * V) : 0; });
    for (i = 0; i < N; i++) if (dupOf[i] >= 0 && theme[dupOf[i]] >= 0) theme[i] = theme[dupOf[i]];
    // label each theme by its most distinctive centroid terms
    var themes = [];
    for (var c = 0; c < k; c++) {
      var scored = [];
      for (var j = 0; j < V; j++) { var wv = km.C[c * V + j]; if (wv > 0) scored.push([j, wv]); }
      scored.sort(function (a, b) { return b[1] - a[1]; });
      var terms = scored.slice(0, 8).map(function (s) { return model.terms[s[0]]; });
      var members = []; for (i = 0; i < N; i++) if (theme[i] === c) members.push(i);
      if (!members.length) continue;
      var dates = members.map(function (m) { return passages[m].at; }).filter(Boolean).sort();
      var wordsSum = members.reduce(function (a, m) { return a + (passages[m].words || words(texts[m])); }, 0);
      themes.push({ id: c, label: terms.slice(0, 3).map(titleCase).join(" · ") || "Theme " + (c + 1), terms: terms, size: members.length, words: wordsSum,
        firstAt: dates[0] || null, medianAt: dates.length ? dates[Math.floor(dates.length / 2)] : null });
    }
    // stable order: by median date when dated, else by size
    themes.sort(function (a, b) { if (a.medianAt && b.medianAt && a.medianAt !== b.medianAt) return a.medianAt < b.medianAt ? -1 : 1; return b.size - a.size; });
    var seeds = findSeeds(texts.map(function (t, ix) { return dupOf[ix] >= 0 || passages[ix].speaker === "ai" ? "" : t; }), opts.seedLimit || 400);
    var months = {};
    passages.forEach(function (p, ix) { if (!p.at) return; var m = p.at.slice(0, 7); var o = months[m] || (months[m] = { words: 0, n: 0, byTheme: {} }); o.words += p.words || 0; o.n++; o.byTheme[theme[ix]] = (o.byTheme[theme[ix]] || 0) + (p.words || 0); });
    return { themes: themes, theme: Array.from(theme), centrality: Array.from(sims), dupOf: Array.from(dupOf), seeds: seeds, months: months, vocabSize: V, k: k };
  }

  // Outline proposal: one chapter per theme in theme order; titles are the theme terms (the author renames).
  function proposeOutline(result) {
    var parts = ["The Beginning", "The Middle", "The Turn", "The Becoming"];
    var n = result.themes.length;
    return result.themes.map(function (t, i) {
      return { title: t.label, part: n >= 8 ? parts[Math.min(3, Math.floor(i * 4 / n))] : "", themeId: t.id, terms: t.terms, size: t.size, words: t.words };
    });
  }

  // Suggest a chapter for each passage from chapter keyword lists (used with an author-provided outline).
  // chapters: [{ key, keywords: [..] }] → suggestion[i] = key or null
  function suggestPlacement(passages, chapters, minScore) {
    var lists = chapters.map(function (ch) {
      var set = new Map();
      ch.keywords.forEach(function (kw) { tokens(kw).forEach(function (t) { set.set(t, (set.get(t) || 0) + 1); }); });
      return set;
    });
    var df = new Map();
    lists.forEach(function (s) { s.forEach(function (_, t) { df.set(t, (df.get(t) || 0) + 1); }); });
    return passages.map(function (p) {
      if (p.speaker === "ai") return null;
      var tk = tokens(p.text), tf = new Map();
      tk.forEach(function (t) { tf.set(t, (tf.get(t) || 0) + 1); });
      var best = null, bestScore = 0;
      lists.forEach(function (set, ci) {
        var s = 0;
        set.forEach(function (w, t) { var c = tf.get(t); if (c) s += w * (1 + Math.log(c)) / (df.get(t) || 1); });
        s = s / Math.sqrt(1 + tk.length / 40);
        if (s > bestScore) { bestScore = s; best = chapters[ci].key; }
      });
      return bestScore >= (minScore || 1.6) ? best : null;
    });
  }

  // Extractive summary: the author's own sentences closest to the theme's centre (never generated text).
  function keySentences(texts, terms, n) {
    var tset = new Set(terms), cands = [];
    texts.forEach(function (t, ti) {
      sentences(t).forEach(function (s) {
        var w = words(s); if (w < 8 || w > 45) return;
        var tk = tokens(s), hit = 0; tk.forEach(function (x) { if (tset.has(x)) hit++; });
        if (hit) cands.push({ s: s, score: hit / Math.sqrt(tk.length + 2), ti: ti });
      });
    });
    cands.sort(function (a, b) { return b.score - a.score; });
    var out = [], used = new Set();
    for (var i = 0; i < cands.length && out.length < (n || 3); i++) { var key = norm(cands[i].s).slice(0, 60); if (used.has(key)) continue; used.add(key); out.push(cands[i].s); }
    return out;
  }

  // Questions + creative prompts: fixed templates filled with the author's own terms. Labelled as templates in the UI.
  function questionsFor(terms, title) {
    var a = terms[0] || "this", b = terms[1] || "it", c = terms[2] || "what changed";
    return [
      "When did " + a + " first become real for you? Write the scene: where were you, who was there?",
      "What did you believe about " + b + " before, and what do you believe now?",
      "Which story about " + a + " have you told the most? Which one have you never told?",
      "What would a reader who has never heard of " + c + " need to know first?",
      "If \"" + (title || a) + "\" had one sentence on its back cover, what would it say?"
    ];
  }
  function promptsFor(terms) {
    var a = terms[0] || "this", b = terms[1] || "that";
    return [
      "Write 300 words to your younger self about " + a + ".",
      "Describe " + b + " using only the five senses — no explanations.",
      "Write the moment " + a + " and " + b + " collided."
    ];
  }

  return { words: words, clean: clean, toISO: toISO, parseAny: parseAny, parseTranscript: parseTranscript, docxXmlToText: docxXmlToText,
    toPassages: toPassages, tokens: tokens, buildVectors: buildVectors, kmeans: kmeans, findDuplicates: findDuplicates, findSeeds: findSeeds,
    analyze: analyze, proposeOutline: proposeOutline, suggestPlacement: suggestPlacement, keySentences: keySentences,
    questionsFor: questionsFor, promptsFor: promptsFor, sentences: sentences, roleOf: roleOf };
});
