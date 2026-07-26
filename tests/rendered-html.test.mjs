import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the public Dreamboard front door", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Dreamboard \| WOW World<\/title>/i);
  assert.match(html, /DREAMBOARD/);
  assert.match(html, /Write the vision\./);
  assert.match(html, /Make it plain\./);
  assert.match(html, /Passport sign in/);
});

test("renders the public creative path before Passport sign-in", async () => {
  const html = await (await render()).text();
  for (const view of [
    "Capture",
    "Connect",
    "Create",
    "Your work begins private.",
  ]) {
    assert.match(html, new RegExp(view.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing nav view: ${view}`);
  }
});

test("ships no sample or placeholder creative content", async () => {
  const html = await (await render()).text();
  // The truthfulness rule (ADR-0002): no fake notes, posts, products, or drafts.
  assert.doesNotMatch(html, /lorem ipsum/i);
  assert.doesNotMatch(html, /WM ID/);
  assert.match(html, /No project is waiting here under your name\./);
});
