// Founder order 2026-11-06: every app gets the WOW community button, served by the ONE WOW dock on WOW OS.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Dreamboard loads the one WOW dock and has a WOW button in the header", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /<script src="https:\/\/thewow\.online\/wow-dock\.js" data-app="Dreamboard" data-side="left" defer \/>/);
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /className="wm-account wow-dock-btn" data-wow-dock="lounge"/);
  assert.doesNotMatch(page + layout, /WOWDock\.setPassport/, "no Passport token crosses into the dock (WOW_WORLD_BRIDGE_BOUNDARY)");
});
