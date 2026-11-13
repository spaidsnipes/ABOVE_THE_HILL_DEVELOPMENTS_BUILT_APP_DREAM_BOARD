/* Dream Board OS · Projects (ported from ~/dreamboard app/projects.tsx, lib/project-types.ts, lib/active-context.ts,
 * app/memory-health.tsx, lib/memory-health.ts, lib/creative-health.ts). 2026-11-12.
 * Real rows only: dreamboard_projects + dreamboard_project_settings (side table, supabase/dreamboard-os-build.sql),
 * dreamboard_active_context, dreamboard_project_memory, dreamboard_creative_health_preferences.
 * Finishing Engine and Creative Health are deterministic rules over the Passport's own rows — no AI judgment. */
(function () {
  "use strict";
  var K = window.DBKit;
  var esc = K.esc;
  var SQL = "supabase/dreamboard-os-build.sql";

  // ---- lib/project-types.ts: 19 universal templates + custom ----
  var BASE = ["capture", "sources", "graph", "timeline", "export"];
  var TOOL_LABEL = { capture: "Capture", sources: "Sources", outline: "Outline", writing: "Writing", research: "Research", equations: "Equations", worldbuilding: "Worldbuilding", storyboard: "Storyboard", audio: "Audio", business: "Business", graph: "Graph", timeline: "Timeline", export: "Export" };
  function wb(t) { var s = BASE.slice(); t.forEach(function (x) { if (s.indexOf(x) < 0) s.push(x); }); return s; }
  var TEMPLATES = [
    ["book", "Book", "✦", "Long-form writing with chapters, drafts, and versions.", ["outline", "writing"]],
    ["research", "Research Project", "⌕", "Questions, claims, evidence, sources, and citations.", ["research", "writing"]],
    ["invention", "Invention", "⚙", "Problems, components, constraints, experiments, and documentation.", ["research", "equations", "writing"]],
    ["device", "Device Concept", "▣", "System concepts, specifications, and validation status.", ["research", "equations"]],
    ["film", "Film", "▤", "Script, treatment, scenes, and production notes.", ["outline", "writing", "storyboard"]],
    ["series", "Television Series", "▦", "Episodes, arcs, and season structure.", ["outline", "writing", "storyboard"]],
    ["podcast", "Podcast", "◉", "Episodes, segments, questions, and recordings.", ["outline", "audio", "writing"]],
    ["game", "Game", "◈", "Mechanics, worlds, progression, and production scope.", ["worldbuilding", "outline", "storyboard"]],
    ["world", "Virtual World", "◍", "Geography, cultures, histories, rules, and lore.", ["worldbuilding", "writing"]],
    ["comic", "Comic", "❏", "Panels, script-to-panel planning, and character sheets.", ["storyboard", "outline", "writing"]],
    ["music", "Music Project", "♪", "Concepts, arrangements, recording, and release plans.", ["audio", "writing"]],
    ["art", "Visual Art Project", "◐", "Image boards, references, and composition.", ["storyboard"]],
    ["business", "Business", "◆", "Model, operations, roadmap, and growth.", ["business", "research", "writing"]],
    ["nonprofit", "Nonprofit", "♥", "Mission, programs, and operations.", ["business", "writing"]],
    ["course", "Course", "❖", "Learning paths, modules, and materials.", ["outline", "writing"]],
    ["archive", "Personal Archive", "▥", "Preserve materials, versions, and provenance.", []],
    ["family", "Family Legacy", "❦", "Family history, people, places, and events.", ["writing"]],
    ["poetry", "Poetry Collection", "❧", "Poems, sequences, and revisions.", ["writing"]],
    ["general", "General Creative Project", "✧", "A flexible workspace for any idea.", ["outline", "writing", "research"]]
  ].map(function (t) { return { slug: t[0], label: t[1], icon: t[2], description: t[3], tools: wb(t[4]) }; });
  var BY_SLUG = {}; TEMPLATES.forEach(function (t) { BY_SLUG[t.slug] = t; });
  var ALIAS = { memoir: "book", script: "film", application: "invention", website: "business" };
  function templateFor(kind, label) {
    var s = ALIAS[kind] || kind;
    if (BY_SLUG[s]) return BY_SLUG[s];
    return { slug: kind || "custom", label: (label || "").trim() || "Custom Project", icon: "✺", description: "A creator-defined project type.", tools: wb(["outline", "writing", "research"]) };
  }
  var STATUSES = ["idea", "incubating", "planning", "active", "paused", "blocked", "review", "ready_to_publish", "published", "completed", "archived"];
  var MAX_ACTIVE = 7;

  // ---- lib/memory-health.ts ----
  var SCOPES = [["project", "Current project"], ["workspace_item", "Current workspace item"], ["active_context", "Active Context projects"], ["conversation", "Current conversation"], ["creator", "Creator-wide (explicitly enabled)"]];
  var CATS = [["purpose", "Project purpose"], ["preference", "Creator preference"], ["voice", "Voice guidance"], ["person", "Important person"], ["place", "Important place"], ["canon_fact", "Canon fact"], ["research_conclusion", "Research conclusion"], ["unresolved_question", "Unresolved question"], ["sensitive_exclusion", "Sensitive exclusion"], ["ai_preference", "AI behavior preference"], ["collaboration_rule", "Collaboration rule"]];
  var SRC = [["creator", "Creator entry"], ["workspace", "Workspace item"], ["import", "Imported material"], ["companion", "Companion suggestion"]];
  function lab(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v; }
  function opts(list, v) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join(""); }

  /* Creative Health — deterministic rules (merged from lib/memory-health.ts deriveCreativeHealth + lib/creative-health.ts).
   * Never a score, never a diagnosis. Every observation names the exact rows behind it. */
  function creativeHealth(h) {
    var o = [], pl = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
    if (h.importing > 0) o.push({ id: "import-queue", title: "Material is still arriving.", detail: "An import is waiting before it can become part of your working library.", evidence: pl(h.importing, "import batch") + " uploading or processing under your Passport (all projects).", go: ["Book Studio import", "#/book"] });
    if (h.visionInbox >= 5 && h.words === 0) o.push({ id: "many-ideas", title: "Lots of ideas, no draft yet.", detail: "That is a fine place to pause and choose one.", evidence: pl(h.visionInbox, "idea") + " in this project's Vision Vault inbox and no words in its writing documents.", go: ["Vision Vault", "#/r/vision"] });
    if (h.notes >= 8 && h.words === 0) o.push({ id: "material-before-draft", title: "Your source material is ready to meet the page.", detail: "A small draft can turn a collection into direction. Nothing needs to be perfect before you begin.", evidence: pl(h.notes, "Knowledge Vault item") + " belong to this project, while its writing documents hold no words yet.", go: ["Writing Studio", "#/r/writing"] });
    if (h.versions >= 6 && h.words > 0 && h.words < 400) o.push({ id: "editing-loop", title: "Many versions of a short piece.", detail: "Consider finishing this pass, or switching to a small new task.", evidence: h.versions + " saved versions with " + K.fmtN(h.words) + " words in this project's documents.", go: ["Writing Studio", "#/r/writing"] });
    if (h.daysSince != null && h.daysSince >= 14) o.push({ id: "quiet", title: "It's been a while since you saved a version.", detail: "Whenever you're ready, your work is exactly where you left it.", evidence: "Your last saved version for this project was " + h.daysSince + " days ago.", go: ["Writing Studio", "#/r/writing"] });
    if (h.words > 0 && h.versions > 0) o.push({ id: "revision-rhythm", title: "Your work has a revision trail.", detail: "Keep drafting with confidence: earlier versions remain available to revisit.", evidence: K.fmtN(h.words) + " draft words and " + pl(h.versions, "saved version") + " in this project's writing documents.", go: ["Writing Studio", "#/r/writing"] });
    if (!o.length) o.push({ id: "begin-gently", title: "Your project is quiet — and ready.", detail: "Dream Board does not turn a calm season into a warning. Add the next true piece whenever you are ready.", evidence: "There is not enough project activity yet for a stronger observation.", go: ["Vision Vault", "#/r/vision"] });
    return o;
  }

  K.css("projects", [
    ".pj-tpl{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:6px 0 10px}",
    ".pj-tpl button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:8px;align-items:center;padding:9px 10px;border-radius:12px;border:1px solid rgba(217,181,108,.22);background:rgba(4,8,6,.45);color:var(--cream-dim);font-size:13px;line-height:1.2;min-height:44px}",
    ".pj-tpl button i{font-style:normal;color:var(--gold);font-size:17px;width:20px;text-align:center;flex:0 0 auto}",
    ".pj-tpl button[aria-checked=true]{border-color:var(--gold-hi);color:var(--cream);background:rgba(217,181,108,.16);box-shadow:0 0 18px rgba(243,217,150,.18)}",
    ".pj-tpl button:focus-visible{outline:2px solid var(--gold-hi)}",
    ".pj-tools{font-size:12px;color:var(--muted)}",
    ".pj-list{display:grid;gap:12px}",
    ".pj-card{border-radius:16px;border:1px solid rgba(217,181,108,.2);background:rgba(4,8,6,.42);overflow:hidden}",
    ".pj-card.open{border-color:var(--gold-dim)}",
    ".pj-sum{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:14px 16px}",
    ".pj-sum:focus-visible{outline:2px solid var(--gold-hi);outline-offset:-2px}",
    ".pj-eb{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}",
    ".pj-sum h4{margin:2px 0 0;font-family:var(--serif);font-weight:500;font-size:22px;color:var(--cream);overflow-wrap:anywhere}",
    ".pj-sum small{font-size:12px;color:var(--muted);text-align:right}",
    ".pj-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}",
    ".pj-badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid rgba(217,181,108,.35);color:var(--gold-hi)}",
    ".pj-badge.pri{background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:#1b1407;border-color:transparent}",
    ".pj-body{padding:4px 16px 16px;border-top:1px solid rgba(217,181,108,.14)}",
    ".pj-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
    ".pj-check{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(217,181,108,.1);font-size:14px;color:var(--cream-dim)}",
    ".pj-check i{font-style:normal;width:22px;height:22px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;border:1px solid var(--gold-dim);color:var(--gold);font-size:12px}",
    ".pj-check.ok{color:var(--cream)} .pj-check.ok i{background:var(--gold);color:#1b1407;border-color:transparent}",
    ".pj-li{display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:10px;background:rgba(4,8,6,.4);margin:4px 0;font-size:14px;overflow-wrap:anywhere}",
    ".pj-li span{flex:1;min-width:0}",
    ".pj-eye{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:14px 0 6px}",
    ".pj-mem{padding:12px 14px;border-radius:12px;border:1px solid rgba(217,181,108,.2);background:rgba(4,8,6,.45);margin-bottom:10px}",
    ".pj-mem.sens{border-left:3px solid #e59a86}",
    ".pj-mem p{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".pj-obs{padding:14px;border-radius:14px;border:1px solid rgba(159,211,166,.25);background:rgba(4,8,6,.45);margin-bottom:10px}",
    ".pj-obs h4{margin:4px 0;font-family:var(--serif);font-weight:500;font-size:20px;color:var(--cream)}",
    ".pj-obs small{display:block;color:var(--muted);margin:6px 0 8px}",
    ".pj-tog{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--cream-dim)}",
    ".pj-tog input{width:18px;height:18px;accent-color:var(--gold)}",
    "@media (max-width:640px){.pj-grid2{grid-template-columns:minmax(0,1fr)}.pj-sum{grid-template-columns:minmax(0,1fr)}.pj-sum small{text-align:left}.pj-tpl{grid-template-columns:repeat(2,minmax(0,1fr))}}"
  ].join("\n"));

  DBRoom.register("projects", {
    mount: async function (el) {
      var sb = K.sb, uid = K.uid();
      var S = { projects: [], settings: {}, ctx: { project_ids: [], primary_id: null }, counts: {}, books: [], batches: [], memory: [], prefs: null,
        miss: {}, open: null, tab: "details", kind: "general", custom: "", archived: false, bookCheck: {} };
      var deep = location.hash.split("/")[2]; if (deep) S.open = deep;

      async function soft(promise, key) { try { return await K.q(promise); } catch (e) { if (K.missingTable(e)) { S.miss[key] = true; return []; } throw e; } }

      async function load() {
        var r = await Promise.all([
          K.q(sb.from("dreamboard_projects").select("id,title,kind,vision,stage,created_at,updated_at").order("updated_at", { ascending: false }).limit(300)),
          soft(sb.from("dreamboard_project_settings").select("*"), "settings"),
          soft(sb.from("dreamboard_active_context").select("project_ids,primary_id").limit(1), "ctx"),
          soft(sb.from("dreamboard_vault_entries").select("project_id,status").not("project_id", "is", null), "vault"),
          soft(sb.from("dreamboard_vision_entries").select("project_id,status").not("project_id", "is", null), "vision"),
          K.q(sb.from("dreamboard_writing_documents").select("id,project_id,body")),
          K.q(sb.from("dreamboard_document_versions").select("document_id,created_at")),
          soft(sb.from("dreamboard_books").select("id,title,words").order("updated_at", { ascending: false }), "books"),
          soft(sb.from("dreamboard_import_batches").select("status"), "batches")
        ]);
        S.projects = r[0]; S.settings = {}; r[1].forEach(function (s) { S.settings[s.project_id] = s; });
        if (r[2][0]) S.ctx = { project_ids: r[2][0].project_ids || [], primary_id: r[2][0].primary_id };
        var docProj = {}, c = {};
        function cc(id) { return c[id] || (c[id] = { vision: 0, visionInbox: 0, knowledge: 0, documents: 0, words: 0, versions: 0, lastVersion: null }); }
        r[3].forEach(function (x) { cc(x.project_id).knowledge++; });
        r[4].forEach(function (x) { var o = cc(x.project_id); o.vision++; if (x.status === "inbox") o.visionInbox++; });
        r[5].forEach(function (d) { if (!d.project_id) return; docProj[d.id] = d.project_id; var o = cc(d.project_id); o.documents++; o.words += K.words(d.body); });
        r[6].forEach(function (v) { var p = docProj[v.document_id]; if (!p) return; var o = cc(p); o.versions++; if (!o.lastVersion || v.created_at > o.lastVersion) o.lastVersion = v.created_at; });
        S.counts = c; S.books = r[7]; S.batches = r[8];
      }
      function st(p) { return S.settings[p.id] || { status: "idea", description: "", mission: "", intended_outcome: "", completion_definition: "", custom_type_label: null, ai_instructions: "", writing_voice: "", metadata: {} }; }
      function meta(p) { return st(p).metadata || {}; }
      function cnt(id) { return S.counts[id] || { vision: 0, visionInbox: 0, knowledge: 0, documents: 0, words: 0, versions: 0, lastVersion: null }; }

      async function saveSettings(pid, patch) {
        if (S.miss.settings) { K.toast("Project details need their shelf first (" + SQL + ").", true); return false; }
        var row = Object.assign({ project_id: pid, owner_id: uid }, S.settings[pid] ? {} : { status: "idea" }, patch, { updated_at: new Date().toISOString() });
        if (patch.status) row.archived_at = patch.status === "archived" ? row.updated_at : null;
        try {
          var data = await K.q(sb.from("dreamboard_project_settings").upsert(row, { onConflict: "project_id" }).select().single());
          S.settings[pid] = data;
          await K.q(sb.from("dreamboard_projects").update({ updated_at: row.updated_at }).eq("id", pid));
          return true;
        } catch (e) { K.toast("That change could not be saved: " + (e.message || e), true); return false; }
      }
      async function saveCtx(ids, primary) {
        if (S.miss.ctx) { K.toast("Active context needs its shelf first (" + SQL + ").", true); return; }
        try {
          await K.q(sb.from("dreamboard_active_context").upsert({ owner_id: uid, project_ids: ids, primary_id: primary, updated_at: new Date().toISOString() }, { onConflict: "owner_id" }));
          S.ctx = { project_ids: ids, primary_id: primary };
        } catch (e) { K.toast("Active context could not be saved: " + (e.message || e), true); }
      }
      async function loadProjectLayer(pid) {
        S.memory = []; S.prefs = null;
        S.memory = await soft(sb.from("dreamboard_project_memory").select("*").or("project_id.eq." + pid + ",project_id.is.null").order("updated_at", { ascending: false }).limit(300), "memory");
        var pr = await soft(sb.from("dreamboard_creative_health_preferences").select("enabled,dismissed_signal_ids").eq("project_id", pid).limit(1), "prefs");
        S.prefs = pr[0] || { enabled: true, dismissed_signal_ids: [] };
        var bid = S.settings[pid] && (S.settings[pid].metadata || {}).book_id;
        if (bid && !S.bookCheck[bid]) {
          try {
            var r = await Promise.all([K.q(sb.from("dreamboard_book_chapters").select("id").eq("book_id", bid)), K.q(sb.from("dreamboard_book_passages").select("chapter_id,words").eq("book_id", bid).eq("speaker", "author"))]);
            var placed = {}, w = 0; r[1].forEach(function (p) { w += p.words || 0; if (p.chapter_id) placed[p.chapter_id] = 1; });
            S.bookCheck[bid] = { total: r[0].length, done: r[0].filter(function (c) { return placed[c.id]; }).length, words: w };
          } catch (e) { S.bookCheck[bid] = { error: e.message || String(e) }; }
        }
      }

      // ---------- views ----------
      function ctxPanel() {
        var ids = S.ctx.project_ids.filter(function (id) { return S.projects.some(function (p) { return p.id === id; }); });
        var pri = S.projects.filter(function (p) { return p.id === S.ctx.primary_id; })[0];
        var names = ids.map(function (id) { var p = S.projects.filter(function (x) { return x.id === id; })[0]; return '<span class="pj-badge' + (id === S.ctx.primary_id ? " pri" : "") + '">' + esc(p.title) + "</span>"; }).join("");
        return K.panel("Active context", "Which projects are in focus right now (up to " + MAX_ACTIVE + "). Your private books, inventions and journals never blend automatically — cross-project context is always your choice. The primary project is what Writing Studio, Voice Guardian and Memory open first.",
          S.miss.ctx ? '<p class="bk-note">Active context is getting its shelf (' + SQL + ").</p>" :
          (ids.length ? '<div class="pj-badges">' + names + '</div><div class="rm-row" style="margin-top:10px"><span class="bk-note">' + (pri ? "Primary: " + esc(pri.title) : "No primary project") + '</span><button class="btn small" data-a="ctx-clear">Clear focus</button></div>' : '<p class="bk-note">No filter — every project is in view. Use “Focus” on a project below to narrow your board.</p>'));
      }
      function createPanel() {
        var t = templateFor(S.kind, S.custom);
        var tpl = TEMPLATES.map(function (x) { return '<button type="button" role="radio" aria-checked="' + (S.kind === x.slug) + '" data-kind="' + x.slug + '" title="' + esc(x.description) + '"><i>' + x.icon + "</i><span>" + esc(x.label) + "</span></button>"; }).join("") +
          '<button type="button" role="radio" aria-checked="' + (S.kind === "custom") + '" data-kind="custom" title="Define your own project type"><i>✺</i><span>Custom</span></button>';
        return K.panel("New project", "A project is a container for real work — a book, a business, a course. It starts private.",
          '<form class="rm-form" data-f="create"><label class="rm-l" for="pj-title">Project title</label><input class="bk-in" id="pj-title" name="title" maxlength="160" required placeholder="The honest name for the work">' +
          '<span class="rm-l" id="pj-tl">Project type</span><div class="pj-tpl" role="radiogroup" aria-labelledby="pj-tl">' + tpl + "</div>" +
          (S.kind === "custom" ? '<label class="rm-l" for="pj-cl">Custom type name</label><input class="bk-in" id="pj-cl" name="custom" maxlength="60" required value="' + esc(S.custom) + '" placeholder="e.g. Field Notebook, Screenplay Bible">' : '<p class="pj-tools">' + esc(t.description) + "</p>") +
          '<p class="pj-tools">Workspace: ' + t.tools.map(function (k) { return TOOL_LABEL[k]; }).join(" · ") + '</p><div class="rm-row"><button class="btn solid">Create project →</button></div></form>');
      }
      function card(p) {
        var s = st(p), c = cnt(p.id), t = templateFor(p.kind, s.custom_type_label), open = S.open === p.id;
        var inCtx = S.ctx.project_ids.indexOf(p.id) >= 0, pri = S.ctx.primary_id === p.id;
        return '<article class="pj-card' + (open ? " open" : "") + '" id="pj-' + p.id + '"><button class="pj-sum" data-a="toggle" data-id="' + p.id + '" aria-expanded="' + open + '"><div><div class="pj-eb">' + t.icon + " " + esc(t.label) + " · " + esc(s.status.replace(/_/g, " ")) + "</div><h4>" + esc(p.title) + "</h4>" +
          (pri || inCtx ? '<div class="pj-badges">' + (pri ? '<span class="pj-badge pri">Primary</span>' : '<span class="pj-badge">In focus</span>') + "</div>" : "") +
          (s.description && !open ? '<p class="bk-note" style="margin:4px 0 0">' + esc(s.description.slice(0, 140)) + "</p>" : "") + "</div><small>" +
          c.documents + " doc" + (c.documents === 1 ? "" : "s") + " · " + K.fmtN(c.words) + " words<br>" + c.vision + " idea" + (c.vision === 1 ? "" : "s") + " · " + c.knowledge + " source" + (c.knowledge === 1 ? "" : "s") + "</small></button>" +
          (open ? '<div class="pj-body">' + detail(p) + "</div>" : "") + "</article>";
      }
      function detail(p) {
        var tabs = [["details", "Details"], ["finish", "Finishing Engine"], ["memory", "Memory"], ["health", "Creative Health"]];
        var inCtx = S.ctx.project_ids.indexOf(p.id) >= 0, pri = S.ctx.primary_id === p.id;
        return '<div class="rm-row" style="margin:12px 0"><button class="btn small' + (pri ? " solid" : "") + '" data-a="primary" data-id="' + p.id + '">' + (pri ? "Primary project ✓" : "Make primary") + '</button><button class="btn small" data-a="focus" data-id="' + p.id + '" aria-pressed="' + inCtx + '">' + (inCtx ? "Remove from focus" : "Focus") + '</button><a class="btn small" href="#/r/writing">Writing Studio</a><a class="btn small" href="#/r/voice">Voice Guardian</a><a class="btn small" href="#/r/constellation">Constellation</a></div>' +
          '<div class="rm-tabs" role="tablist">' + tabs.map(function (t) { return '<button class="btn small" role="tab" aria-pressed="' + (S.tab === t[0]) + '" aria-selected="' + (S.tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
          ({ details: details, finish: finishing, memory: memoryView, health: healthView })[S.tab](p);
      }
      function ta(name, label, val, ph) { return '<div class="rm-form"><label class="rm-l" for="pj-' + name + '">' + label + '</label><textarea class="bk-in" style="min-height:84px" id="pj-' + name + '" name="' + name + '" maxlength="4000" placeholder="' + esc(ph) + '">' + esc(val) + "</textarea></div>"; }
      function details(p) {
        var s = st(p), m = meta(p), t = templateFor(p.kind, s.custom_type_label);
        if (S.miss.settings) return K.setupNotice("Project details", SQL);
        return '<p class="pj-tools"><b>' + t.icon + " " + esc(t.label) + "</b> · this project’s workspace: " + t.tools.map(function (k) { return TOOL_LABEL[k]; }).join(" · ") + "</p>" +
          '<form class="rm-form" data-f="details" data-id="' + p.id + '">' +
          '<label class="rm-l" for="pj-t2">Title</label><input class="bk-in" id="pj-t2" name="title" maxlength="160" required value="' + esc(p.title) + '">' +
          ta("description", "Description", s.description, "What this project is, in your own words.") +
          '<div class="pj-grid2">' + ta("mission", "Mission", s.mission, "Why this work matters.") + ta("intended_outcome", "Intended outcome", s.intended_outcome, "What exists in the world when it ships.") +
          ta("completion_definition", "Definition of done", s.completion_definition, "The honest checklist for calling it complete.") +
          '<div class="rm-form"><label class="rm-l" for="pj-na">Current next action</label><input class="bk-in" id="pj-na" name="next_action" maxlength="400" value="' + esc(m.next_action || "") + '" placeholder="The next faithful step."></div>' +
          ta("ai_instructions", "Project AI instructions", s.ai_instructions, "How Spaidbot should work in this project (tone, boundaries, domain).") +
          ta("writing_voice", "Writing voice", s.writing_voice, "This project’s voice: vocabulary, rhythm, what to preserve.") + "</div>" +
          '<div class="rm-row"><button class="btn solid">Save project details</button><label class="rm-l" for="pj-st">Status</label><select class="bk-in" style="width:auto" id="pj-st" name="status">' + STATUSES.map(function (x) { return '<option value="' + x + '"' + (x === s.status ? " selected" : "") + ">" + x.replace(/_/g, " ") + "</option>"; }).join("") + "</select></div></form>" +
          '<div class="rm-row" style="margin-top:14px">' + (s.status === "archived" ? '<button class="btn small" data-a="restore" data-id="' + p.id + '">Restore</button><button class="btn small" data-a="delete" data-id="' + p.id + '">Delete permanently</button>' : '<button class="btn small" data-a="archive" data-id="' + p.id + '">Archive</button>') +
          '<span class="bk-note">AI instructions and writing voice stay inside this project. Spaidbot only reads them when you ask it something from this project.</span></div>';
      }
      function finishChecks(p) {
        var s = st(p), m = meta(p), c = cnt(p.id), rem = m.remaining_work || [], bl = m.blockers || [];
        var bc = m.book_id ? S.bookCheck[m.book_id] : null, book = m.book_id ? S.books.filter(function (b) { return b.id === m.book_id; })[0] : null;
        var words = c.words + (bc && bc.words ? bc.words : 0);
        var ch = !m.book_id ? [true, "Chapters complete — rule skipped: no Book Studio book is linked to this project"] :
          !bc ? [false, "Chapters complete — checking your Book Studio book…"] : bc.error ? [false, "Chapters complete — could not read the linked book (" + bc.error + ")"] :
          [bc.total === 0 || bc.done === bc.total, bc.total ? "Every chapter of “" + (book ? book.title : "linked book") + "” has your passages (" + bc.done + "/" + bc.total + ")" : "Chapters complete (the linked book has no chapters yet)"];
        return [
          [!!s.completion_definition.trim(), "Definition of done is written"],
          [!!s.mission.trim(), "Mission is stated"],
          ch,
          [words > 0, "The manuscript has words in it (" + K.fmtN(words) + " across writing documents" + (m.book_id ? " and the linked book" : "") + ")"],
          [rem.length === 0, rem.length ? "Remaining required work is empty (" + rem.length + " item" + (rem.length === 1 ? "" : "s") + " left)" : "Remaining required work is empty"],
          [bl.length === 0, bl.length ? "No blockers (" + bl.length + " open)" : "No blockers"]
        ];
      }
      function listEd(pid, key, label, items, ph) {
        return '<div><div class="pj-eye">' + label + "</div>" + items.map(function (it, i) { return '<div class="pj-li"><span>' + esc(it) + '</span><button class="btn small" data-a="li-del" data-id="' + pid + '" data-k="' + key + '" data-i="' + i + '" aria-label="Remove ' + esc(it) + '">✕</button></div>'; }).join("") +
          '<form class="rm-row" data-f="li-add" data-id="' + pid + '" data-k="' + key + '"><input class="bk-in" style="flex:1;min-width:0;width:auto" name="v" maxlength="400" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '"><button class="btn small">Add</button></form></div>';
      }
      function finishing(p) {
        if (S.miss.settings) return K.setupNotice("The Finishing Engine", SQL);
        var s = st(p), m = meta(p), checks = finishChecks(p), ready = checks.every(function (c) { return c[0]; });
        var cand = s.status === "review" || s.status === "ready_to_publish";
        var bookOpts = '<option value="">No book linked</option>' + S.books.map(function (b) { return '<option value="' + b.id + '"' + (b.id === m.book_id ? " selected" : "") + ">" + esc(b.title) + "</option>"; }).join("");
        return '<div class="pj-eye">Finishing Engine · deterministic rules, no AI judgment</div>' +
          checks.map(function (c) { return '<div class="pj-check' + (c[0] ? " ok" : "") + '"><i>' + (c[0] ? "✓" : "○") + "</i><span>" + esc(c[1]) + "</span></div>"; }).join("") +
          '<div class="pj-grid2">' + listEd(p.id, "remaining_work", "Remaining required work", m.remaining_work || [], "What must exist before this is done") + listEd(p.id, "blockers", "Blockers", m.blockers || [], "What is genuinely in the way") +
          listEd(p.id, "deferred_ideas", "Deferred ideas (not required)", m.deferred_ideas || [], "Good ideas that can wait for the next version") +
          '<form class="rm-form" data-f="meta" data-id="' + p.id + '"><div class="pj-eye">Version target</div><input class="bk-in" name="version_target" maxlength="120" value="' + esc(m.version_target || "") + '" placeholder="e.g. First edition, v1.0" aria-label="Version target">' +
          '<div class="pj-eye">Manuscript in Book Studio</div><select class="bk-in" name="book_id" aria-label="Linked Book Studio book">' + bookOpts + '</select><div class="rm-row"><button class="btn small">Save</button>' + (m.book_id ? '<a class="btn small" href="#/book/' + esc(m.book_id) + '">Open the book</a>' : "") + "</div></form></div>" +
          '<div class="rm-row" style="margin-top:14px"><button class="btn solid" data-a="ready" data-id="' + p.id + '"' + (!ready || cand ? " disabled" : "") + ">" + (cand ? "Already in release review" : ready ? "Mark ready to publish" : "Readiness rules not yet met") + "</button>" +
          (!ready ? '<span class="bk-note">The button unlocks when every rule above passes — Dream Board never fakes completion.</span>' : "") + "</div>";
      }
      function memoryView(p) {
        if (S.miss.memory) return K.setupNotice("Project Memory", SQL);
        var list = S.memory.map(function (mm) {
          if (S.editMem === mm.id) return '<form class="pj-mem rm-form" data-f="mem-edit" data-mid="' + mm.id + '"><textarea class="bk-in" name="content" maxlength="4000" style="min-height:90px" aria-label="Memory">' + esc(mm.content) + '</textarea><div class="pj-grid2"><select class="bk-in" name="scope" aria-label="Scope">' + opts(SCOPES, mm.scope) + '</select><select class="bk-in" name="category" aria-label="Category">' + opts(CATS, mm.category) + '</select></div><div class="rm-row"><button class="btn small solid">Save</button><button type="button" class="btn small" data-a="mem-cancel">Cancel</button></div></form>';
          return '<article class="pj-mem' + (mm.sensitive ? " sens" : "") + '"><div class="rm-row"><span class="pj-badge">' + esc(lab(CATS, mm.category)) + "</span>" + (mm.inferred ? '<span class="pj-badge">Inferred</span>' : "") + (mm.sensitive ? '<span class="pj-badge">Sensitive</span>' : "") + "</div><p>" + esc(mm.content) + '</p><div class="rm-meta">Source: ' + esc(mm.source_label) + " (" + esc(lab(SRC, mm.source_type)) + ") · " + esc(lab(SCOPES, mm.scope)) + " · saved " + K.fmtDay(mm.created_at) + '</div><div class="rm-row" style="margin-top:8px"><button class="btn small" data-a="mem-edit" data-mid="' + mm.id + '">Edit</button><button class="btn small" data-a="mem-del" data-mid="' + mm.id + '">Delete</button></div></article>';
        }).join("");
        return '<p class="bk-note">Exactly what Dream Board remembers for this project. Every item is visible, editable and deletable, keeps its source, and inferred memory is labelled inferred. Nothing is remembered invisibly. Creator-wide items show in every project and are labelled.</p>' +
          '<div class="pj-grid2"><form class="rm-form" data-f="mem-add" data-id="' + p.id + '"><div class="pj-eye">Add an inspectable memory</div><textarea class="bk-in" name="content" maxlength="4000" required style="min-height:90px" placeholder="Example: This project’s purpose is…" aria-label="What should Dream Board remember?"></textarea>' +
          '<label class="rm-l">Scope<select class="bk-in" name="scope">' + opts(SCOPES, "project") + '</select></label><label class="rm-l">Category<select class="bk-in" name="category">' + opts(CATS, "purpose") + "</select></label>" +
          '<label class="rm-l">Source<select class="bk-in" name="source_type">' + opts(SRC, "creator") + '</select></label><input class="bk-in" name="source_label" maxlength="240" required value="Creator entry" aria-label="Where it came from">' +
          '<label class="pj-tog"><input type="checkbox" name="inferred"> Inferred (an interpretation, not a direct statement)</label><label class="pj-tog"><input type="checkbox" name="sensitive"> Sensitive</label><label class="pj-tog"><input type="checkbox" name="consent"> I explicitly consent to storing this sensitive memory privately</label>' +
          '<div class="rm-row"><button class="btn solid">Save memory →</button></div></form><div><div class="pj-eye">Saved memory</div>' + (list || '<p class="bk-note">Nothing is stored yet. Add only what you want Dream Board to remember about this project.</p>') + "</div></div>";
      }
      function healthInputs(p) {
        var c = cnt(p.id);
        return { importing: S.batches.filter(function (b) { return b.status === "uploading" || b.status === "processing"; }).length, visionInbox: c.visionInbox, notes: c.knowledge, words: c.words, versions: c.versions,
          daysSince: c.lastVersion ? Math.floor((Date.now() - new Date(c.lastVersion)) / 86400000) : null };
      }
      function healthView(p) {
        if (S.miss.prefs) return K.setupNotice("Creative Health", SQL);
        var on = S.prefs.enabled, obs = creativeHealth(healthInputs(p)).filter(function (o) { return S.prefs.dismissed_signal_ids.indexOf(o.id) < 0; });
        return '<label class="pj-tog" style="margin-bottom:10px"><input type="checkbox" data-a="health-on" data-id="' + p.id + '"' + (on ? " checked" : "") + "> Creative Health observations for this project</label>" +
          '<p class="bk-note">A gentle reading of your real activity — counts and dates from your own rows, deterministic rules, no AI, never a score, never a diagnosis, no comparison to anyone. You can turn it off.</p>' +
          (!on ? K.empty("Creative Health is paused. Turn it on whenever you’d like gentle observations.") :
            obs.length ? obs.map(function (o) { return '<article class="pj-obs"><div class="pj-eye" style="margin:0">Why you’re seeing this</div><h4>' + esc(o.title) + "</h4><p style=\"margin:0\">" + esc(o.detail) + "</p><small>" + esc(o.evidence) + '</small><div class="rm-row"><a class="btn small" href="' + o.go[1] + '">' + esc(o.go[0]) + '</a><button class="btn small" data-a="dismiss" data-id="' + p.id + '" data-o="' + o.id + '">Dismiss</button></div></article>'; }).join("") :
            K.empty("You dismissed the current observations. They return only if new activity creates a different signal."));
      }

      function paint() {
        var visible = S.projects.filter(function (p) { var a = st(p).status === "archived"; return S.archived ? a : !a; });
        el.innerHTML = K.scene("Dream Board OS · Build", "Projects", S.projects.length ? S.projects.length + " project" + (S.projects.length === 1 ? "" : "s") + " under your Passport, private by default. Each carries its own purpose, voice, memory and definition of done." : "A project is a container for real work. Dream Board begins empty on purpose — create the first one when you're ready.", "art-hill-sunrise.jpg",
          '<a class="btn" href="#/r/constellation">Constellation</a><a class="btn" href="#/tree">Money Tree</a><a class="btn" href="#/quantum">Quantum-ply</a>') +
          '<div class="bk-work one">' + (S.miss.settings ? K.setupNotice("Project details", SQL) : "") + ctxPanel() + createPanel() +
          K.panel(S.archived ? "Archived projects" : "Your projects", "Open a project for its details, Finishing Engine, memory and Creative Health.",
            '<div class="rm-row" style="margin-bottom:10px"><button class="btn small" data-a="archived">' + (S.archived ? "Show active" : "Show archived") + '</button></div><div class="pj-list">' + (visible.map(card).join("") || '<p class="bk-empty" style="margin:0">' + (S.archived ? "No archived projects." : "No projects yet. Create the first container for your real work above.") + "</p>") + "</div>") + "</div>";
      }
      async function repaintOpen() { if (S.open) await loadProjectLayer(S.open); paint(); }

      el.innerHTML = K.scene("Dream Board OS · Build", "Projects", "Opening your projects…", "art-hill-sunrise.jpg");
      await load();
      if (S.open && !S.projects.some(function (p) { return p.id === S.open; })) S.open = null;
      await repaintOpen();
      if (S.open) { var n0 = el.querySelector("#pj-" + S.open); if (n0) n0.scrollIntoView({ block: "start" }); }

      function proj(id) { return S.projects.filter(function (p) { return p.id === id; })[0]; }
      el.addEventListener("click", async function (e) {
        var k = e.target.closest("[data-kind]"); if (k) { var f = el.querySelector('[data-f="create"]'); var tv = f ? f.elements.title.value : ""; S.kind = k.dataset.kind; paint(); var f2 = el.querySelector('[data-f="create"]'); f2.elements.title.value = tv; var b2 = el.querySelector('[data-kind="' + S.kind + '"]'); if (b2) b2.focus(); return; }
        var tb = e.target.closest("[data-tab]"); if (tb) { S.tab = tb.dataset.tab; paint(); return; }
        var b = e.target.closest("[data-a]"); if (!b || b.tagName === "INPUT") return;
        var a = b.dataset.a, id = b.dataset.id, p = id && proj(id);
        if (a === "toggle") { S.open = S.open === id ? null : id; S.tab = "details"; S.editMem = null; await repaintOpen(); var n = el.querySelector("#pj-" + id); if (n && S.open) n.querySelector(".pj-sum").focus(); return; }
        if (a === "archived") { S.archived = !S.archived; S.open = null; paint(); return; }
        if (a === "ctx-clear") { await saveCtx([], null); paint(); return; }
        if (a === "primary") { var ids = S.ctx.project_ids.slice(); if (ids.indexOf(id) < 0) { if (ids.length >= MAX_ACTIVE) { K.toast("Up to " + MAX_ACTIVE + " projects can be in focus.", true); return; } ids.push(id); } await saveCtx(ids, id); K.toast("“" + p.title + "” is your primary project."); paint(); return; }
        if (a === "focus") { var ids2 = S.ctx.project_ids.slice(), i = ids2.indexOf(id), pr = S.ctx.primary_id; if (i >= 0) { ids2.splice(i, 1); if (pr === id) pr = ids2[0] || null; } else { if (ids2.length >= MAX_ACTIVE) { K.toast("Up to " + MAX_ACTIVE + " projects can be in focus.", true); return; } ids2.push(id); if (!pr) pr = id; } await saveCtx(ids2, pr); paint(); return; }
        if (a === "archive" || a === "restore") { if (await saveSettings(id, { status: a === "archive" ? "archived" : "active" })) { K.toast(a === "archive" ? "Archived. It is safe under “Show archived”." : "Restored."); S.open = null; paint(); } return; }
        if (a === "delete") {
          if (!confirm("Permanently delete “" + p.title + "”? Its settings and memory go with it; attached vault material and writing documents are kept and simply detached. This cannot be undone.")) return;
          try { await K.remove("dreamboard_projects", id); S.projects = S.projects.filter(function (x) { return x.id !== id; }); delete S.settings[id]; if (S.ctx.project_ids.indexOf(id) >= 0 || S.ctx.primary_id === id) await saveCtx(S.ctx.project_ids.filter(function (x) { return x !== id; }), S.ctx.primary_id === id ? null : S.ctx.primary_id); S.open = null; K.toast("The project was permanently deleted."); paint(); } catch (er) { K.toast("Could not delete: " + (er.message || er), true); }
          return;
        }
        if (a === "li-del") { var m = Object.assign({}, meta(p)); m[b.dataset.k] = (m[b.dataset.k] || []).filter(function (_, j) { return j !== +b.dataset.i; }); if (await saveSettings(id, { metadata: m })) paint(); return; }
        if (a === "ready") { if (!confirm("Mark “" + p.title + "” ready to publish? Every readiness rule passed — you can move it back at any time.")) return; if (await saveSettings(id, { status: "ready_to_publish" })) { K.toast("Marked ready to publish."); paint(); } return; }
        if (a === "mem-edit") { S.editMem = b.dataset.mid; paint(); return; }
        if (a === "mem-cancel") { S.editMem = null; paint(); return; }
        if (a === "mem-del") { if (!confirm("Delete this memory? This cannot be undone.")) return; try { await K.remove("dreamboard_project_memory", b.dataset.mid); S.memory = S.memory.filter(function (x) { return x.id !== b.dataset.mid; }); K.toast("Memory deleted."); paint(); } catch (er) { K.toast("Could not delete: " + (er.message || er), true); } return; }
        if (a === "dismiss") { await savePrefs(id, { dismissed_signal_ids: S.prefs.dismissed_signal_ids.concat([b.dataset.o]) }); paint(); return; }
      });
      el.addEventListener("change", async function (e) {
        var t = e.target;
        if (t.dataset.a === "health-on") { await savePrefs(t.dataset.id, { enabled: t.checked }); paint(); }
      });
      async function savePrefs(pid, patch) {
        var next = Object.assign({}, S.prefs, patch);
        try { await K.q(sb.from("dreamboard_creative_health_preferences").upsert({ owner_id: uid, project_id: pid, enabled: next.enabled, dismissed_signal_ids: next.dismissed_signal_ids, updated_at: new Date().toISOString() }, { onConflict: "owner_id,project_id" })); S.prefs = next; }
        catch (er) { K.toast("Creative Health preferences could not be saved: " + (er.message || er), true); }
      }
      el.addEventListener("submit", async function (e) {
        var f = e.target.closest("form[data-f]"); if (!f) return; e.preventDefault();
        var kind = f.dataset.f, id = f.dataset.id, p = id && proj(id), btn = f.querySelector("button:not([type=button])"); if (btn) btn.disabled = true;
        try {
          if (kind === "create") {
            var title = f.elements.title.value.trim().slice(0, 160); if (!title) return;
            var custom = S.kind === "custom" ? (f.elements.custom.value.trim().slice(0, 60)) : null; if (S.kind === "custom" && !custom) return;
            var row = await K.insert("dreamboard_projects", { title: title, kind: S.kind });
            S.projects.unshift(row);
            if (!S.miss.settings) await saveSettings(row.id, { status: "idea", custom_type_label: custom });
            S.open = row.id; S.tab = "details"; S.custom = "";
            K.toast("“" + title.slice(0, 60) + "” is now a real, private project.");
            await repaintOpen(); return;
          }
          if (kind === "details") {
            var nt = f.elements.title.value.trim().slice(0, 160);
            if (nt && nt !== p.title) { var up = await K.update("dreamboard_projects", id, { title: nt }); Object.assign(p, up); }
            var ok = await saveSettings(id, { description: f.elements.description.value, mission: f.elements.mission.value, intended_outcome: f.elements.intended_outcome.value, completion_definition: f.elements.completion_definition.value, ai_instructions: f.elements.ai_instructions.value, writing_voice: f.elements.writing_voice.value, status: f.elements.status.value, metadata: Object.assign({}, meta(p), { next_action: f.elements.next_action.value.trim() }) });
            if (ok) { K.toast("Project details saved."); if (f.elements.status.value === "archived") S.open = null; paint(); }
            return;
          }
          if (kind === "li-add") { var v = f.elements.v.value.trim(); if (!v) return; var m = Object.assign({}, meta(p)); m[f.dataset.k] = (m[f.dataset.k] || []).concat([v.slice(0, 400)]); if (await saveSettings(id, { metadata: m })) { paint(); var nf = el.querySelector('form[data-f="li-add"][data-k="' + f.dataset.k + '"] input'); if (nf) nf.focus(); } return; }
          if (kind === "meta") { var m2 = Object.assign({}, meta(p), { version_target: f.elements.version_target.value.trim(), book_id: f.elements.book_id.value || null }); if (await saveSettings(id, { metadata: m2 })) { K.toast("Saved."); await repaintOpen(); } return; }
          if (kind === "mem-add") {
            var content = f.elements.content.value.trim(), sl = f.elements.source_label.value.trim(), sens = f.elements.sensitive.checked;
            if (!content) return K.toast("Memory needs a clear description.", true);
            if (!sl) return K.toast("Tell Dream Board where this memory came from.", true);
            if (sens && !f.elements.consent.checked) return K.toast("Sensitive memory needs your explicit consent before it is stored.", true);
            var scope = f.elements.scope.value;
            var mrow = await K.insert("dreamboard_project_memory", { project_id: scope === "creator" ? null : id, scope: scope, category: f.elements.category.value, content: content, source_label: sl, source_type: f.elements.source_type.value, inferred: f.elements.inferred.checked, sensitive: sens, sensitive_consent_at: sens ? new Date().toISOString() : null });
            S.memory.unshift(mrow); K.toast("Memory saved with its source and scope."); paint(); return;
          }
          if (kind === "mem-edit") {
            var mid = f.dataset.mid, sc = f.elements.scope.value, txt = f.elements.content.value.trim(); if (!txt) return;
            var urow = await K.update("dreamboard_project_memory", mid, { content: txt, scope: sc, category: f.elements.category.value, project_id: sc === "creator" ? null : S.open, updated_at: new Date().toISOString() });
            S.memory = S.memory.map(function (x) { return x.id === mid ? urow : x; }); S.editMem = null; K.toast("Memory updated."); paint(); return;
          }
        } catch (er) { K.toast("That could not be saved: " + (er.message || er), true); }
        finally { if (btn && btn.isConnected) btn.disabled = false; }
      });
    }
  });
})();
