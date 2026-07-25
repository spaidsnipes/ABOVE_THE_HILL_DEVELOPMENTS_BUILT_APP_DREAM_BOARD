import assert from "node:assert/strict";
import test from "node:test";
import { deriveCreativeHealth, validateMemoryDraft } from "../lib/memory-health.ts";

const baseDraft = { content: "Keep the project grounded in first-person testimony.", scope: "project", category: "purpose", sourceLabel: "Creator entry", sourceType: "creator", inferred: false, sensitive: false, sensitiveConsent: false };

test("private memory requires source and explicit sensitive consent", () => {
  assert.equal(validateMemoryDraft(baseDraft), null);
  assert.match(validateMemoryDraft({ ...baseDraft, sourceLabel: "" }) ?? "", /where this memory came from/i);
  assert.match(validateMemoryDraft({ ...baseDraft, sensitive: true }) ?? "", /explicit consent/i);
  assert.equal(validateMemoryDraft({ ...baseDraft, sensitive: true, sensitiveConsent: true }), null);
});

test("Creative Health is explainable, gentle, and based only on supplied activity", () => {
  const observations = deriveCreativeHealth({ projectSelected: true, noteCount: 12, draftWords: 0, importingCount: 2, unresolvedQuestionCount: 3, unverifiedClaimCount: 4, versionCount: 0 });
  assert.deepEqual(observations.map(item => item.id), ["import-queue", "research-open", "material-before-draft"]);
  assert.ok(observations.every(item => item.evidence.length > 0 && item.options.length > 0));
  assert.deepEqual(deriveCreativeHealth({ projectSelected: false, noteCount: 99, draftWords: 99, importingCount: 99, unresolvedQuestionCount: 99, unverifiedClaimCount: 99, versionCount: 99 }), []);
});
