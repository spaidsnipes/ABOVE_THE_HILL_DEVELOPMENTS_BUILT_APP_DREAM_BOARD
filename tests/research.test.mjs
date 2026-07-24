import assert from "node:assert/strict";
import test from "node:test";
import { EVIDENCE_CLASSES, evidenceLabel } from "../lib/research.ts";

test("provides the full evidence-class taxonomy in humble-first order", () => {
  const slugs = EVIDENCE_CLASSES.map(([s]) => s);
  assert.equal(EVIDENCE_CLASSES.length, 13);
  for (const key of ["established", "hypothesis", "interpretation", "testimony", "theological", "fictional", "analogy", "needs_verification", "rejected"]) {
    assert.ok(slugs.includes(key), `missing evidence class: ${key}`);
  }
  assert.ok(slugs.indexOf("established") < slugs.indexOf("rejected"));
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(evidenceLabel("hypothesis"), "Hypothesis");
});
