import assert from "node:assert/strict";
import test from "node:test";
import { countReferenceWords, validateVoiceReference, voiceReferenceCoverage } from "../lib/voice-guardian.ts";

test("Voice Guardian measures reference coverage without claiming model confidence", () => {
  const samples = [{ excerpt: "one two three" }, { excerpt: "four five six seven" }];
  assert.equal(countReferenceWords(samples), 7);
  assert.equal(voiceReferenceCoverage([]), "No references yet");
  assert.equal(voiceReferenceCoverage(samples), "Early reference set");
});

test("Voice Guardian requires ownership or permission consent", () => {
  assert.match(validateVoiceReference({ label: "Original draft", excerpt: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty", consent: false }) || "", /permission/i);
  assert.equal(validateVoiceReference({ label: "Original draft", excerpt: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty", consent: true }), null);
});
