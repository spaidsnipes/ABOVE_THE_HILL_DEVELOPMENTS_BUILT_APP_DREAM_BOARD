import assert from "node:assert/strict";
import test from "node:test";
import { GROWTH_CATEGORIES, GROWTH_PRACTICES, growthLanguage, summarizeGrowth } from "../lib/growth-rings.ts";

test("Growth Rings keeps the complete creator-selected practice taxonomy", () => {
  assert.deepEqual(GROWTH_CATEGORIES, ["spiritual", "physical", "mental", "financial", "creative", "relationships", "work"]);
  assert.ok(GROWTH_PRACTICES.spiritual.includes("Fasting"));
  assert.ok(GROWTH_PRACTICES.creative.includes("Writing"));
});

test("90-day reflection counts only supplied entries and avoids streak punishment", () => {
  const entries = [
    { id: "1", occurred_on: "2026-07-25", category: "physical", practice: "Workout", reflection: null, created_at: "2026-07-25T12:00:00Z" },
    { id: "2", occurred_on: "2026-06-03", category: "spiritual", practice: "Prayer", reflection: null, created_at: "2026-06-03T12:00:00Z" },
    { id: "old", occurred_on: "2026-04-01", category: "creative", practice: "Writing", reflection: null, created_at: "2026-04-01T12:00:00Z" },
  ];
  const summary = summarizeGrowth(entries, new Date("2026-07-26T12:00:00Z"));
  assert.equal(summary.total, 2);
  assert.deepEqual(summary.byPractice.map(item => item.practice), ["Prayer", "Workout"]);
  const language = growthLanguage(summary).toLowerCase();
  assert.match(language, /quiet day does not erase/);
  assert.doesNotMatch(language, /streak|fail|broken/);
});
