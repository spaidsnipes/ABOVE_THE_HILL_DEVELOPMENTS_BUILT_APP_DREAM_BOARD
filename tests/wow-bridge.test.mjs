import assert from "node:assert/strict";
import test from "node:test";
import { WOW_WORLD_BRIDGE_BOUNDARY, wowWorldDestination } from "../lib/wow-bridge.ts";

test("WOW World routes never carry Passport or private material in the handoff URL", () => {
  const url = wowWorldDestination("https://example.com/", "radio");
  assert.equal(url, "https://example.com/radio");
  assert.equal(new URL(url).search, "");
  assert.match(WOW_WORLD_BRIDGE_BOUNDARY, /does not transfer/i);
});
