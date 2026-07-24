import assert from "node:assert/strict";
import test from "node:test";
import { MASTER_PERSONAS, SKILLS, routeRequest, buildMessages, parseSegments, localFramework } from "../lib/companion.ts";

test("provides 25 master personas and a skill registry", () => {
  assert.equal(MASTER_PERSONAS.length, 25);
  assert.ok(SKILLS.length >= 25);
  for (const p of MASTER_PERSONAS) {
    assert.ok(p.name && p.summary && p.reasoningStyle && p.safety && p.skills.length, `persona ${p.id} incomplete`);
    for (const s of p.skills) assert.ok(SKILLS.some(sk => sk.id === s), `${p.id} references unknown skill ${s}`);
  }
});

test("routes by keyword and by explicit pins, capped at 3", () => {
  const science = routeRequest("check the units and reproducibility of this experiment", false);
  assert.ok(science.personas.some(p => p.id === "scientific-researcher"));
  const pinned = routeRequest("anything", false, ["story-architect", "voice-guardian"]);
  assert.deepEqual(pinned.personas.map(p => p.id), ["story-architect", "voice-guardian"]);
  const many = routeRequest("world game plot character research", false, ["worldbuilding-master", "game-director", "story-architect", "editor"]);
  assert.ok(many.personas.length <= 3);
});

test("wisdom lens is carried into the system prompt", () => {
  const route = routeRequest("help me finish", true);
  const { system } = buildMessages("help me finish", route, { projectTitle: null, chapterTitle: null, draftExcerpt: "", sources: [] });
  assert.match(system, /Wisdom lens/);
});

test("parseSegments labels output by category; local framework is honest", () => {
  const segs = parseSegments("[EVIDENCE] a fact\n[SPECULATION] a guess");
  assert.equal(segs[0].category, "evidence");
  assert.equal(segs[1].category, "speculation");
  const route = routeRequest("edit this", false);
  const local = localFramework("edit this", route, { projectTitle: null, chapterTitle: null, draftExcerpt: "one two three", sources: [] });
  assert.ok(local.some(s => /local framework/i.test(s.text)));
});
