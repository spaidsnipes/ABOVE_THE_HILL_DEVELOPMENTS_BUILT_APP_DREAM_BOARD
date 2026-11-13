// Book Studio engine: parsing, author-only passages, duplicates, seeds, themes, placement, docx text.
import test from "node:test";
import assert from "node:assert/strict";
await import("../board/book-engine.js");
const E = globalThis.BookEngine;

const para = (n, w) => Array.from({ length: n }, (_, i) => w + " " + i).join(" ");

test("ChatGPT export keeps the author's messages and their dates", () => {
  const conv = [{ title: "Faith notes", create_time: 1715800000, mapping: {
    a: { message: { author: { role: "user" }, create_time: 1715800001, content: { parts: ["I want to write the book about frequency and faith. " + para(30, "river")] } } },
    b: { message: { author: { role: "assistant" }, create_time: 1715800002, content: { parts: ["Here is an AI answer that is not the author's words."] } } } } }];
  const src = E.parseAny("conversations.json", JSON.stringify(conv));
  assert.equal(src.kind, "chatgpt");
  const ps = E.toPassages(src.units, {});
  assert.equal(ps.length, 1);
  assert.equal(ps[0].speaker, "author");
  assert.match(ps[0].at, /^2024-05-15/);
  assert.equal(E.toPassages(src.units, { keepAI: true }).filter((p) => p.speaker === "ai").length, 1);
});

test("Grok export parses human vs assistant", () => {
  const g = { conversations: [{ conversation: { title: "Grok thread", create_time: "2026-02-11T03:58:00Z" }, responses: [
    { response: { message: "My own words about the mirror and the narrow road. " + para(20, "mirror"), sender: "human", create_time: "2026-02-11T03:58:00Z" } },
    { response: { message: "Grok reply", sender: "assistant" } }] }] };
  const src = E.parseAny("grok.json", JSON.stringify(g));
  assert.equal(src.kind, "grok");
  assert.deepEqual(src.units.map((u) => u.speaker), ["author", "ai"]);
});

test("transcript markdown formats from the vault and thread captures", () => {
  const md = "# T\n\n## FOUNDER [0] 2025-05-15 23:01Z\nHello from me.\n\n## ASSISTANT [1] 2025-05-15 23:01Z\nAI.\n\n## GROK 2026-02-11T03:58\nMore AI.\n";
  const a = E.parseAny("x.md", md);
  assert.equal(a.kind, "transcript");
  assert.deepEqual(a.units.map((u) => u.speaker), ["author", "ai", "ai"]);
  const txt = "# Title\n\n===== USER 2026-08-06 08:47 =====\nMine.\n\n===== ASSISTANT 2026-08-06 08:47 =====\nTheirs.\n";
  assert.deepEqual(E.parseAny("y.full.txt", txt).units.map((u) => u.speaker), ["author", "ai"]);
});

test("plain prose splits into passages; long paragraphs split at sentences", () => {
  const long = Array.from({ length: 60 }, (_, i) => "This is sentence number " + i + " about the fire and the flow.").join(" ");
  const ps = E.toPassages(E.parseAny("draft.txt", long + "\n\nShort tail paragraph with a few words.").units);
  assert.ok(ps.length >= 3);
  ps.forEach((p) => assert.ok(p.words <= 400));
});

test("exact and near-exact repeats are found; originals kept", () => {
  const base = "The key ring principle says every key you carry opens a door you chose and some doors should stay shut for good reasons.";
  const dup = E.findDuplicates([base, "Something else entirely different about rivers and behavior and flowing water today.", base, base.replace("good", "very good")]);
  assert.equal(dup[0], -1);
  assert.equal(dup[2], 0);
  assert.equal(dup[3], 0);
});

test("themes separate distinct subjects deterministically", () => {
  const ps = [];
  for (let i = 0; i < 40; i++) ps.push({ text: "Prayer scripture faith worship jesus grace mercy heaven " + i, speaker: "author", words: 9 });
  for (let i = 0; i < 40; i++) ps.push({ text: "Trading futures chart candle entry stop risk market " + i, speaker: "author", words: 9 });
  const r1 = E.analyze(ps, { k: 2 }), r2 = E.analyze(ps, { k: 2 });
  assert.deepEqual(r1.theme, r2.theme);
  assert.notEqual(r1.theme[0], r1.theme[79]);
  assert.equal(new Set(r1.theme.slice(0, 40)).size, 1);
});

test("idea seeds come from the author's own sentences", () => {
  const s = E.findSeeds(["What if we built a device that hums at the frequency of praise for every home?"]);
  assert.equal(s.length, 1);
  assert.match(s[0].sentence, /What if/);
});

test("placement suggests chapters from keywords", () => {
  const sug = E.suggestPlacement([{ text: "At the pool of Bethesda the lame man waited for mercy and healing." }, { text: "Nothing related here." }],
    [{ key: "a", keywords: ["Bethesda", "mercy", "pool", "healing"] }, { key: "b", keywords: ["calendar", "julian"] }]);
  assert.deepEqual(sug, ["a", null]);
});

test("docx xml to text keeps paragraphs", () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>First</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Second &amp; more</w:t></w:r></w:p></w:body></w:document>';
  assert.equal(E.docxXmlToText(xml), "First\n\nSecond & more");
});

test("templates are filled with the author's terms only", () => {
  const q = E.questionsFor(["nunu", "river"], "River Behavior");
  assert.ok(q.every((x) => typeof x === "string"));
  assert.match(q[0], /nunu/);
});
