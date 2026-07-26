import assert from "node:assert/strict";
import test from "node:test";
import { WOW_WORLD_BRIDGE_BOUNDARY, isWowWorldRoute, wowWorldDestination } from "../lib/wow-bridge.ts";

test("WOW World routes never carry Passport or private material in the handoff URL", () => {
  const url = wowWorldDestination("https://example.com/", "radio");
  assert.equal(url, "https://example.com/radio");
  assert.equal(new URL(url).search, "");
  assert.match(WOW_WORLD_BRIDGE_BOUNDARY, /one-time secure handoff/i);
});

test("WOW Passport handoffs only permit the three explicitly supported surfaces", () => {
  assert.equal(isWowWorldRoute("lounge"), true);
  assert.equal(isWowWorldRoute("shop"), true);
  assert.equal(isWowWorldRoute("radio"), true);
  assert.equal(isWowWorldRoute("admin"), false);
  assert.equal(isWowWorldRoute("https://attacker.example"), false);
});
