/* Dream Board OS · Vision Vault (ported from ~/dreamboard/app/vision-vault.tsx, 2026-11-12)
 * The creator's own emerging material: ideas, dreams, goals, sparks. Private by default.
 * Lifecycle: inbox → developing / incubating → ready_for_project → archived (restore brings it back to the inbox).
 * Table: dreamboard_vision_entries (supabase/dreamboard-os-know.sql). "Make it a project" inserts into dreamboard_projects. */
(function () {
  "use strict";
  var K = window.DBKit;
  var STATUSES = [["inbox", "Inbox"], ["developing", "Developing"], ["incubating", "Incubating"], ["ready_for_project", "Ready for a project"], ["archived", "Archived"]];
  // Media captures (image / file) need upload storage this room does not have yet, so only words-based capture kinds are offered.
  var CAPTURES = [["text", "Idea"], ["quick_capture", "Quick capture"], ["link", "Link"], ["sketch", "Sketch (in words)"], ["voice", "Voice note (typed)"]];
  var KINDS = [["general", "General creative project"], ["book", "Book"], ["research", "Research project"], ["invention", "Invention"], ["device", "Device concept"], ["film", "Film"], ["series", "Television series"], ["podcast", "Podcast"], ["game", "Game"], ["world", "Virtual world"], ["comic", "Comic"], ["music", "Music project"], ["art", "Visual art project"], ["business", "Business"], ["nonprofit", "Nonprofit"], ["course", "Course"], ["archive", "Personal archive"], ["family", "Family legacy"], ["poetry", "Poetry collection"]];
  var COLS = "id,title,content,capture_type,status,tags,project_id,created_at,updated_at,archived_at";
  var SPAIDBOT = "https://mission.abovethehilldev.online/api/spaidbot";

  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return String(v || "").replace(/_/g, " "); }
  function deriveTitle(c) { return (String(c).trim().split(/\n|\.|!|\?/)[0].slice(0, 58).trim()) || "Untitled idea"; }
  function opts(list, sel) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? " selected" : "") + ">" + o[1] + "</option>"; }).join(""); }

  K.css("vision", [
    ".vv-cap textarea{min-height:110px}",
    ".vv-filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}",
    ".vv-item{position:relative;display:grid;gap:8px;border-left:3px solid var(--c,var(--gold))}",
    ".vv-item[data-st=developing]{--c:#7cc7a1}.vv-item[data-st=incubating]{--c:#c98fd6}.vv-item[data-st=ready_for_project]{--c:#f3d996}.vv-item[data-st=archived]{--c:#6d6656;opacity:.85}",
    ".vv-item p.body{margin:0;white-space:pre-wrap;word-break:break-word;color:var(--cream);font-family:var(--serif);font-size:17px;line-height:1.5}",
    ".vv-item .rm-row select{max-width:100%}",
    ".vv-badge{display:inline-block;font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid rgba(217,181,108,.35);color:var(--gold-hi)}",
    ".vv-proj{display:grid;gap:8px;padding:10px;border-radius:12px;border:1px dashed rgba(217,181,108,.4)}",
    ".vv-focus{box-shadow:0 0 0 2px var(--gold-hi),0 0 26px rgba(243,217,150,.25)}",
    ".vv-ai{margin-top:4px;padding:10px 12px;border-radius:12px;background:rgba(159,199,232,.06);white-space:pre-wrap;font-size:14px;color:var(--cream-dim)}",
    ".vv-list{display:grid;gap:12px}"
  ].join("\n"));

  DBRoom.register("vision", {
    mount: async function (el) {
      var S = { rows: [], projects: {}, f: "all", q: "", editing: null, projFor: null, ai: {}, aiBusy: null, setup: false, focus: null };
      try { var fx = JSON.parse(sessionStorage.getItem("dbos-focus") || "null"); if (fx && fx.room === "vision") { S.focus = fx.id; sessionStorage.removeItem("dbos-focus"); } } catch (e) {}

      async function load() {
        try {
          S.rows = await K.q(K.sb.from("dreamboard_vision_entries").select(COLS).order("updated_at", { ascending: false }).limit(500));
          var pids = S.rows.map(function (r) { return r.project_id; }).filter(Boolean);
          if (pids.length) { var ps = await K.q(K.sb.from("dreamboard_projects").select("id,title").in("id", pids)); S.projects = {}; ps.forEach(function (p) { S.projects[p.id] = p.title; }); }
        } catch (e) { if (K.missingTable(e)) S.setup = true; else K.toast("Could not open your Vision Vault: " + (e.message || e), true); }
      }

      function visible() {
        var q = S.q.toLowerCase();
        return S.rows.filter(function (r) { return S.f === "all" ? r.status !== "archived" : r.status === S.f; })
          .filter(function (r) { return !q || (r.title + " " + r.content + " " + (r.tags || []).join(" ")).toLowerCase().indexOf(q) >= 0; });
      }
      function count(st) { return S.rows.filter(function (r) { return st === "all" ? r.status !== "archived" : r.status === st; }).length; }

      function itemHtml(r, i) {
        var e = K.esc;
        if (S.editing === r.id) {
          return '<article class="rm-item vv-item" data-id="' + r.id + '" data-st="' + r.status + '"><label class="rm-l" for="vv-et">Title</label><input id="vv-et" class="bk-in" maxlength="240" value="' + e(r.title) + '"><label class="rm-l" for="vv-ec">Your words</label><textarea id="vv-ec" class="bk-ta">' + e(r.content) + '</textarea><div class="rm-row"><button class="btn small solid" data-a="save">Save</button><button class="btn small" data-a="cancel">Cancel</button></div></article>';
        }
        var proj = r.project_id ? '<span class="vv-badge">Project · ' + e(S.projects[r.project_id] || "linked") + "</span>" : "";
        var tools = '<label class="rm-l">Status <select class="bk-in" data-a="status" aria-label="Status">' + opts(STATUSES, r.status) + "</select></label>" +
          '<button class="btn small" data-a="edit">Edit</button>' +
          (r.status === "archived" ? '<button class="btn small" data-a="restore">Restore</button><button class="btn small" data-a="delete">Delete</button>' : '<button class="btn small" data-a="archive">Archive</button>') +
          (r.project_id ? '<a class="btn small" href="#/r/projects">Open projects</a>' : (r.status !== "archived" ? '<button class="btn small' + (r.status === "ready_for_project" ? " solid" : "") + '" data-a="proj">Make it a project</button>' : "")) +
          (r.status !== "archived" ? '<button class="btn small" data-a="ai"' + (S.aiBusy === r.id ? " disabled" : "") + ">" + (S.aiBusy === r.id ? "Asking Spaidbot…" : "Questions to grow it") + "</button>" : "");
        var projForm = S.projFor === r.id ? '<div class="vv-proj"><b style="color:var(--gold-hi);font-family:var(--serif);font-weight:500">Start a project from this idea</b><label class="rm-l" for="vv-pt">Project title</label><input id="vv-pt" class="bk-in" maxlength="160" value="' + e(r.title.slice(0, 160)) + '"><label class="rm-l" for="vv-pk">Project type</label><select id="vv-pk" class="bk-in">' + opts(KINDS, "general") + '</select><p class="rm-meta" style="margin:0">Your idea\'s words become the project\'s vision. The idea stays here, linked to the project.</p><div class="rm-row"><button class="btn small solid" data-a="proj-go">Create project</button><button class="btn small" data-a="proj-x">Cancel</button></div></div>' : "";
        var ai = S.ai[r.id] ? '<div class="rm-ai vv-ai"><div class="rm-meta">Spaidbot · questions only — nothing is added to your idea</div>' + e(S.ai[r.id]) + '<div class="rm-row" style="margin-top:8px"><button class="btn small" data-a="ai-x">Dismiss</button></div></div>' : "";
        return '<article class="rm-item vv-item' + (S.focus === r.id ? " vv-focus" : "") + '" style="--i:' + i + '" data-id="' + r.id + '" data-st="' + r.status + '" id="vv-' + r.id + '">' +
          '<div class="rm-meta">' + e(label(CAPTURES, r.capture_type)) + " · " + K.fmtDay(r.created_at) + ' · <span class="vv-badge">' + e(label(STATUSES, r.status)) + "</span> " + proj + "</div>" +
          "<h4>" + e(r.title) + "</h4>" + (r.content && r.content !== r.title ? '<p class="body">' + e(r.content) + "</p>" : "") +
          '<div class="rm-row">' + tools + "</div>" + projForm + ai + "</article>";
      }

      function paint() {
        var active = count("all");
        var head = K.scene("Vision Vault · private by default", "Catch it before it fades.",
          active ? K.fmtN(active) + " idea" + (active === 1 ? "" : "s") + " in motion. Nothing here is shared unless you choose to share it." : "Ideas, dreams, goals and sparks live here — separate from your research in the Knowledge Vault.",
          "art-hill-sunrise.jpg", '<a class="btn" href="#/r/knowledge">Knowledge Vault</a><a class="btn" href="#/tree">Money Tree</a>');
        if (S.setup) { el.innerHTML = head + '<div class="bk-work one">' + K.setupNotice("Vision Vault", "supabase/dreamboard-os-know.sql") + "</div>"; return; }
        var cap = K.panel("Capture an idea", "Your words, exactly as you write them. Ctrl/⌘ + Enter keeps it.",
          '<div class="rm-form vv-cap"><label class="rm-l" for="vv-new">The idea</label><textarea id="vv-new" class="bk-ta" placeholder="A dream, a goal, an observation, an unfinished thought…"></textarea>' +
          '<div class="rm-row"><label class="rm-l" for="vv-kind">Kind</label><select id="vv-kind" class="bk-in" style="width:auto">' + opts(CAPTURES, "text") + '</select><span class="spacer"></span><button class="btn solid" data-a="add">Keep this idea</button></div></div>');
        var filt = '<div class="vv-filters" role="group" aria-label="Filter by status"><button class="bk-chip" data-f="all" aria-pressed="' + (S.f === "all") + '">All active · ' + count("all") + "</button>" +
          STATUSES.map(function (s) { return '<button class="bk-chip" data-f="' + s[0] + '" aria-pressed="' + (S.f === s[0]) + '">' + s[1] + " · " + count(s[0]) + "</button>"; }).join("") + "</div>" +
          '<div class="bk-filter"><input type="search" id="vv-q" placeholder="Search your ideas, dreams and goals" value="' + K.esc(S.q) + '" aria-label="Search ideas"></div>';
        var v = visible();
        var list = v.length ? '<div class="vv-list">' + v.map(itemHtml).join("") + "</div>" :
          '<div class="bk-empty" style="padding:22px 8px">' + (S.q || S.f !== "all" ? "Nothing matched that view. Your ideas remain safe in the vault." : "Your Vision Vault is ready. Capture the first idea above — it stays private to your Passport.") + "</div>";
        el.innerHTML = head + '<div class="bk-work one">' + cap + K.panel("Your ideas", "Move each idea along: inbox → developing or incubating → ready for a project. Archive what can rest; restore it any time.", filt + '<div id="vv-list">' + list + "</div>") + "</div>";
        if (S.focus) { var f = document.getElementById("vv-" + S.focus); if (f) f.scrollIntoView({ block: "center" }); S.focus = null; }
      }
      function paintList() { var box = el.querySelector("#vv-list"); if (!box) return paint(); var v = visible(); box.innerHTML = v.length ? '<div class="vv-list">' + v.map(itemHtml).join("") + "</div>" : '<div class="bk-empty" style="padding:22px 8px">Nothing matched that view. Your ideas remain safe in the vault.</div>'; }

      function row(id) { for (var i = 0; i < S.rows.length; i++) if (S.rows[i].id === id) return S.rows[i]; return null; }
      async function patch(id, p) {
        var now = new Date().toISOString(); p.updated_at = now;
        if (p.status) p.archived_at = p.status === "archived" ? now : null;
        try { var saved = await K.q(K.sb.from("dreamboard_vision_entries").update(p).eq("id", id).select(COLS).single()); S.rows = S.rows.map(function (r) { return r.id === id ? saved : r; }); return true; }
        catch (e) { K.toast("That change could not be saved: " + (e.message || e), true); return false; }
      }
      async function add() {
        var ta = el.querySelector("#vv-new"); var clean = ta.value.trim(); if (!clean) { ta.focus(); return; }
        var kind = el.querySelector("#vv-kind").value;
        try {
          var r = await K.q(K.sb.from("dreamboard_vision_entries").insert({ owner_id: K.uid(), title: deriveTitle(clean), content: clean, capture_type: kind, source_type: kind === "quick_capture" ? "quick_capture" : kind === "voice" ? "voice" : "manual" }).select(COLS).single());
          S.rows.unshift(r); S.f = S.f === "archived" ? "all" : S.f; paint(); K.toast("Captured to your private Vision Vault.");
        } catch (e) { K.toast(K.missingTable(e) ? "The Vision Vault table is not set up yet." : "Could not keep that idea: " + (e.message || e), true); }
      }
      async function makeProject(r) {
        var title = (el.querySelector("#vv-pt").value || "").trim().slice(0, 160) || r.title.slice(0, 160);
        var kind = el.querySelector("#vv-pk").value;
        try {
          var p = await K.insert("dreamboard_projects", { title: title, kind: kind, vision: r.content || r.title, stage: "seed", progress: 0 });
          S.projects[p.id] = p.title; S.projFor = null;
          await patch(r.id, { project_id: p.id, status: "ready_for_project" });
          paint(); K.toast("“" + p.title + "” is now a project. Find it in Projects.");
        } catch (e) { K.toast("Could not create the project: " + (e.message || e), true); }
      }
      async function askSpaidbot(r) {
        S.aiBusy = r.id; paintList();
        var prompt = "A creator captured this idea in their own words. Do NOT rewrite it or write prose for them. Reply with 3 to 5 short questions that would help them develop it, one per line.\n\nIdea: " + r.title + "\n" + (r.content || "");
        try {
          var res = await fetch(SPAIDBOT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: prompt.slice(0, 4000) }], product: "ath" }) });
          var b = await res.json().catch(function () { return {}; });
          if (res.status === 503 || b.retry) throw new Error("Spaidbot is busy right now — try again in a moment.");
          if (!res.ok || !b.reply) throw new Error("Spaidbot answered " + res.status + ".");
          S.ai[r.id] = String(b.reply).trim();
        } catch (e) { K.toast(e.message || String(e), true); }
        S.aiBusy = null; paintList();
      }

      el.addEventListener("input", function (ev) { if (ev.target.id === "vv-q") { S.q = ev.target.value; paintList(); } });
      el.addEventListener("keydown", function (ev) { if (ev.target.id === "vv-new" && (ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); add(); } });
      el.addEventListener("change", async function (ev) {
        if (ev.target.dataset.a !== "status") return;
        var id = ev.target.closest("[data-id]").dataset.id;
        if (await patch(id, { status: ev.target.value })) { paint(); K.toast("Moved to " + label(STATUSES, ev.target.value) + "."); }
      });
      el.addEventListener("click", async function (ev) {
        var f = ev.target.closest("[data-f]"); if (f) { S.f = f.dataset.f; paint(); return; }
        var b = ev.target.closest("button[data-a]"); if (!b) return;
        var a = b.dataset.a; if (a === "add") return add();
        var host = b.closest("[data-id]"); var r = host && row(host.dataset.id); if (!r) return;
        if (a === "edit") { S.editing = r.id; paintList(); var t = el.querySelector("#vv-et"); if (t) t.focus(); }
        else if (a === "cancel") { S.editing = null; paintList(); }
        else if (a === "save") { var title = el.querySelector("#vv-et").value.trim().slice(0, 240) || "Untitled idea"; if (await patch(r.id, { title: title, content: el.querySelector("#vv-ec").value })) { S.editing = null; paintList(); K.toast("Saved."); } }
        else if (a === "archive") { if (await patch(r.id, { status: "archived" })) { paint(); K.toast("Archived. Restore it any time from the Archived filter."); } }
        else if (a === "restore") { if (await patch(r.id, { status: "inbox" })) { paint(); K.toast("Restored to your inbox."); } }
        else if (a === "delete") {
          if (!confirm("Permanently delete “" + r.title + "”? This cannot be undone.")) return;
          try { await K.remove("dreamboard_vision_entries", r.id); S.rows = S.rows.filter(function (x) { return x.id !== r.id; }); paint(); K.toast("The idea was permanently deleted."); }
          catch (e) { K.toast("Could not delete that idea: " + (e.message || e), true); }
        }
        else if (a === "proj") { S.projFor = r.id; paintList(); }
        else if (a === "proj-x") { S.projFor = null; paintList(); }
        else if (a === "proj-go") { b.disabled = true; await makeProject(r); }
        else if (a === "ai") askSpaidbot(r);
        else if (a === "ai-x") { delete S.ai[r.id]; paintList(); }
      });

      await load();
      paint();
    }
  });
})();
