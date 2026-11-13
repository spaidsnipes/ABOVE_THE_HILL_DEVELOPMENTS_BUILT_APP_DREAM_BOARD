/* Dream Board · Book Studio worker — heavy lifting off the main thread so 1.5M words never freeze the page.
 * import: files (txt/md/html/json/docx/zip incl. ChatGPT + Grok exports) → sources + passages
 * analyze: passages → themes, duplicates, idea seeds, months
 * suggest: passages + chapter keywords → suggested chapter per passage */
/* global importScripts, BookEngine */
importScripts("book-engine.js?v=1112c");
var E = self.BookEngine;

function post(o) { self.postMessage(o); }

// ---- minimal ZIP reader (central directory + deflate-raw via DecompressionStream) ----
function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function zipEntries(buf) {
  var b = new Uint8Array(buf), eocd = -1;
  for (var i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This file is not a readable .zip/.docx");
  var n = u16(b, eocd + 10), off = u32(b, eocd + 16), out = [], dec = new TextDecoder();
  for (var k = 0; k < n; k++) {
    if (u32(b, off) !== 0x02014b50) break;
    var method = u16(b, off + 10), csize = u32(b, off + 20), nlen = u16(b, off + 28), xlen = u16(b, off + 30), clen = u16(b, off + 32), lho = u32(b, off + 42);
    var name = dec.decode(b.subarray(off + 46, off + 46 + nlen));
    out.push({ name: name, method: method, csize: csize, lho: lho });
    off += 46 + nlen + xlen + clen;
  }
  return { bytes: b, entries: out };
}
async function zipRead(z, e) {
  var b = z.bytes, o = e.lho;
  var start = o + 30 + u16(b, o + 26) + u16(b, o + 28);
  var data = b.subarray(start, start + e.csize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Unsupported compression in " + e.name);
  var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

async function readFile(f) {
  var name = f.name, lower = name.toLowerCase();
  if (/\.docx$/.test(lower)) {
    var z = zipEntries(f.buf);
    var doc = z.entries.find(function (e) { return e.name === "word/document.xml"; });
    if (!doc) throw new Error(name + " has no document text");
    return [{ name: name, text: E.docxXmlToText(await zipRead(z, doc)), kind: "docx" }];
  }
  if (/\.zip$/.test(lower)) {
    var z2 = zipEntries(f.buf), out = [];
    for (var i = 0; i < z2.entries.length; i++) {
      var e = z2.entries[i];
      if (/(^|\/)__MACOSX\//.test(e.name) || /\/$/.test(e.name)) continue;
      if (/conversations\.json$|\.(txt|md|markdown|json)$/i.test(e.name) && !/(^|\/)(chat\.html|message_feedback|user|shared_conversations|model_comparisons)\.json$/i.test(e.name)) {
        out.push({ name: name + " › " + e.name, text: await zipRead(z2, e) });
      }
    }
    if (!out.length) throw new Error(name + ": no conversations.json, .txt, .md or .json inside");
    return out;
  }
  if (f.text != null) return [{ name: name, text: f.text }];
  return [{ name: name, text: new TextDecoder().decode(f.buf) }];
}

self.onmessage = async function (ev) {
  var m = ev.data, t0 = Date.now();
  try {
    if (m.type === "import") {
      var sources = [], passages = [];
      for (var i = 0; i < m.files.length; i++) {
        post({ type: "progress", id: m.id, phase: "Reading " + m.files[i].name, done: i, total: m.files.length });
        var docs = await readFile(m.files[i]);
        for (var d = 0; d < docs.length; d++) {
          var doc = docs[d];
          var parsed = E.parseAny(doc.name, doc.text);
          var units = parsed.units;
          var ps = E.toPassages(units, { keepAI: !!m.opts.keepAI });
          var totalWords = E.words(doc.text);
          var mine = ps.filter(function (p) { return p.speaker === "author"; }).reduce(function (a, p) { return a + p.words; }, 0);
          var dates = units.map(function (u) { return u.at; }).filter(Boolean).sort();
          sources.push({ name: doc.name, kind: doc.kind || parsed.kind, words: mine, totalWords: totalWords, passages: ps.length,
            units: units.length, authorUnits: units.filter(function (u) { return u.speaker === "author"; }).length,
            firstAt: dates[0] || null, lastAt: dates[dates.length - 1] || null });
          var si = sources.length - 1;
          ps.forEach(function (p) { p.source = si; passages.push(p); });
        }
      }
      post({ type: "done", id: m.id, sources: sources, passages: passages, ms: Date.now() - t0 });
    } else if (m.type === "analyze") {
      post({ type: "progress", id: m.id, phase: "Finding themes in " + m.passages.length.toLocaleString() + " passages", done: 0, total: 1 });
      var r = E.analyze(m.passages, m.opts || {});
      r.outline = E.proposeOutline(r);
      // key sentences per theme (the author's own sentences)
      r.themes.forEach(function (t) {
        var texts = [];
        for (var i2 = 0; i2 < m.passages.length && texts.length < 400; i2++) if (r.theme[i2] === t.id && r.dupOf[i2] < 0) texts.push(m.passages[i2].text);
        t.key = E.keySentences(texts, t.terms, 3);
      });
      post({ type: "done", id: m.id, result: r, ms: Date.now() - t0 });
    } else if (m.type === "suggest") {
      post({ type: "done", id: m.id, result: E.suggestPlacement(m.passages, m.chapters, m.minScore), ms: Date.now() - t0 });
    } else if (m.type === "keys") {
      post({ type: "done", id: m.id, result: E.keySentences(m.texts, m.terms, m.n || 3), ms: Date.now() - t0 });
    }
  } catch (err) {
    post({ type: "error", id: m.id, error: String(err && err.message || err) });
  }
};
