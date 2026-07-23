import assert from "node:assert/strict";
import test from "node:test";
import { PROJECT_TEMPLATES, templateForKind, projectToolset, BASE_TOOLS } from "../lib/project-types.ts";

test("provides the 19 universal project templates", () => {
  assert.equal(PROJECT_TEMPLATES.length, 19);
  for (const key of ["book", "research", "invention", "game", "world", "poetry", "general"]) {
    assert.ok(PROJECT_TEMPLATES.some(t => t.slug === key), `missing template: ${key}`);
  }
});

test("every template includes the base tool set", () => {
  for (const template of PROJECT_TEMPLATES) {
    for (const base of BASE_TOOLS) assert.ok(template.tools.includes(base), `${template.slug} missing base tool ${base}`);
  }
});

test("type-specific tools are configured", () => {
  assert.ok(templateForKind("book").tools.includes("writing"));
  assert.ok(templateForKind("invention").tools.includes("equations"));
  assert.ok(templateForKind("game").tools.includes("worldbuilding"));
  assert.ok(templateForKind("podcast").tools.includes("audio"));
});

test("legacy type slugs resolve to a valid universal template", () => {
  assert.equal(templateForKind("memoir").label, "Book");
  assert.equal(templateForKind("script").label, "Film");
  assert.equal(templateForKind("application").label, "Invention");
  assert.equal(templateForKind("website").label, "Business");
});

test("unknown slug becomes a custom type using the provided label", () => {
  const custom = templateForKind("field-notebook", "Field Notebook");
  assert.equal(custom.label, "Field Notebook");
  assert.ok(custom.tools.length >= BASE_TOOLS.length);
  assert.deepEqual(projectToolset("book"), templateForKind("book").tools);
});
