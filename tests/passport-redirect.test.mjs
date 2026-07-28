import assert from "node:assert/strict";
import test from "node:test";
import { cleanPassportRedirect, readPassportRedirect } from "../lib/passport-redirect.ts";

test("Passport redirect exchanges a short-lived callback code and preserves an intended view", () => {
  assert.deepEqual(readPassportRedirect("?code=temporary-code&view=growth-rings"), { kind: "exchange", code: "temporary-code" });
  assert.equal(cleanPassportRedirect("?code=temporary-code&view=growth-rings"), "?view=growth-rings");
});

test("Passport redirect surfaces errors and never mistakes an ordinary view for sign-in", () => {
  assert.deepEqual(readPassportRedirect("?error_description=Link+expired"), { kind: "error", message: "Link expired" });
  assert.deepEqual(readPassportRedirect("?view=projects"), { kind: "none" });
  assert.deepEqual(readPassportRedirect("?passport=ready"), { kind: "ready" });
});
