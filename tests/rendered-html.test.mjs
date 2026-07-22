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

test("server-renders the Dreamboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Dreamboard \| WOW World<\/title>/i);
  assert.match(html, /DREAMBOARD/);
  assert.match(html, /role="status"/);
});

test("renders the core navigation, including both vaults", async () => {
  const html = await (await render()).text();
  for (const view of [
    "Creator’s Home",
    "Search",
    "Passport",
    "Vision Vault",
    "Knowledge Vault",
    "Creative Graph",
    "Book Architect",
    "Projects",
    "Writing Studio",
    "AI Studio",
  ]) {
    assert.match(html, new RegExp(view.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing nav view: ${view}`);
  }
});

test("ships no sample or placeholder creative content", async () => {
  const html = await (await render()).text();
  // The truthfulness rule (ADR-0002): no fake notes, posts, products, or drafts.
  assert.doesNotMatch(html, /lorem ipsum/i);
  assert.doesNotMatch(html, /WM ID/);
  assert.match(html, /Dreamboard is ready for your next real piece of work\./);
});
