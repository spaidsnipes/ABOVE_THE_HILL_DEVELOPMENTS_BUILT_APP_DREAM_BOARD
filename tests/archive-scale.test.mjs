import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVE_STAGE_LIMIT, planArchiveIntake } from "../lib/archive-scale.ts";
import { buildCreatorWorkspaceExport } from "../lib/creator-export.ts";

test("archive plans keep a seven-thousand-file intake explicit and resumable", () => {
  const plan = planArchiveIntake(Array.from({ length: 7_000 }, () => ({ size: 10 })));
  assert.equal(plan.withinStageLimit, true);
  assert.equal(plan.extractionPasses, 14);
  assert.match(plan.message, /resumable/i);
  assert.equal(planArchiveIntake(Array.from({ length: ARCHIVE_STAGE_LIMIT + 1 }, () => ({ size: 0 }))).withinStageLimit, false);
});

test("creator export states its current-device scope instead of claiming a cloud backup", () => {
  const archive = buildCreatorWorkspaceExport({ notes: [], draft: "work", snapshots: [] });
  assert.equal(archive.scope, "current-device-workspace");
  assert.match(archive.limitations.join(" "), /not silently copied/i);
});
