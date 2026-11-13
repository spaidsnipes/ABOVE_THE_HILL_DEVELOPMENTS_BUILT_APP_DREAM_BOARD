/* Dream Board OS · Constellation (ported from ~/dreamboard app/constellation.tsx). 2026-11-12.
 * Stars = the Passport's real projects, sized by the real material attached to each (Vision Vault ideas, Knowledge Vault
 * entries, writing documents, and passages of a Book Studio book the creator linked in Projects → Finishing Engine).
 * Lines = relationships the creator drew (dreamboard_project_links). Nothing is ever inferred or invented. */
(function () {
  "use strict";
  var K = window.DBKit, esc = K.esc, SQL = "supabase/dreamboard-os-build.sql";
  var RELS = ["related", "inspires", "depends_on", "part_of", "contrasts"];
  var GOLDEN = 2.399963229728653;
  var ICON = { book: "✦", research: "⌕", invention: "⚙", device: "▣", film: "▤", series: "▦", podcast: "◉", game: "◈", world: "◍", comic: "❏", music: "♪", art: "◐", business: "◆", nonprofit: "♥", course: "❖", archive: "▥", family: "❦", poetry: "❧", general: "✧", memoir: "✦", script: "▤" };

  K.css("constellation", [
    ".cn-wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start}",
    ".cn-sky{position:relative;border-radius:18px;overflow:hidden;border:1px solid rgba(217,181,108,.22);background:radial-gradient(120% 90% at 50% 10%,rgba(18,56,43,.85),rgba(4,6,5,.96) 70%);touch-action:none}",
    ".cn-sky svg{display:block;width:100%;height:clamp(340px,62vh,640px);cursor:grab;user-select:none}",
    ".cn-sky svg:active{cursor:grabbing}",
    ".cn-sky svg:focus-visible{outline:2px solid var(--gold-hi);outline-offset:-2px}",
    ".cn-dust{fill:rgba(244,234,211,.5)}",
    ".cn-edge{stroke:var(--gold);stroke-opacity:.55;stroke-width:1.4;fill:none}",
    ".cn-edge.hi{stroke-opacity:.95;stroke-width:2.2}",
    ".cn-elabel{fill:var(--gold-hi);font-size:10px;letter-spacing:.08em;text-anchor:middle;opacity:.85}",
    ".cn-star{cursor:pointer;outline:none}",
    ".cn-star .glow{fill:url(#cn-glow)}",
    ".cn-star .core{fill:#1f806d;stroke:rgba(244,234,211,.75);stroke-width:1.5;transition:stroke-width .2s}",
    ".cn-star.pri .core{fill:#d9b56c}",
    ".cn-star.sel .core,.cn-star.from .core,.cn-star:focus-visible .core{stroke:#f3d996;stroke-width:3.5}",
    ".cn-star text{fill:var(--cream);font-family:var(--serif);font-size:15px;text-anchor:middle;paint-order:stroke;stroke:rgba(4,6,5,.85);stroke-width:3px}",
    ".cn-star .ic{fill:#04120c;font-size:13px;font-family:var(--sans,system-ui);stroke:none}",
    ".cn-ctl{position:absolute;right:10px;top:10px;display:flex;gap:6px}",
    ".cn-ctl .btn{min-width:38px}",
    ".cn-hint{position:absolute;left:12px;bottom:10px;font-size:11px;color:var(--muted);max-width:calc(100% - 24px)}",
    ".cn-link{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:10px;background:rgba(4,8,6,.45);margin:6px 0;font-size:14px;overflow-wrap:anywhere}",
    ".cn-note{border-left:3px solid var(--gold);padding:8px 12px;margin-bottom:10px;background:rgba(217,181,108,.08);border-radius:8px;font-size:14px}",
    "@media (prefers-reduced-motion:no-preference){.cn-star .glow{animation:cn-tw 5s ease-in-out infinite alternate}}",
    "@keyframes cn-tw{from{opacity:.55}to{opacity:1}}",
    "@media (max-width:980px){.cn-wrap{grid-template-columns:minmax(0,1fr)}}"
  ].join("\n"));

  DBRoom.register("constellation", {
    mount: async function (el) {
      var sb = K.sb, uid = K.uid();
      var S = { projects: [], status: {}, books: {}, material: {}, links: [], ctx: { project_ids: [], primary_id: null }, miss: {}, sel: null, from: null, rel: "related", view: { x: 0, y: 0, k: 1 } };
      async function soft(pr, key) { try { return await K.q(pr); } catch (e) { if (K.missingTable(e)) { S.miss[key] = true; return []; } throw e; } }

      el.innerHTML = K.scene("Dream Board OS · Build", "Constellation", "Opening your sky…", "art-sunrise.jpg");
      var r = await Promise.all([
        K.q(sb.from("dreamboard_projects").select("id,title,kind").order("created_at", { ascending: true }).limit(300)),
        soft(sb.from("dreamboard_project_settings").select("project_id,status,custom_type_label,metadata"), "settings"),
        soft(sb.from("dreamboard_project_links").select("id,from_project_id,to_project_id,relationship"), "links"),
        soft(sb.from("dreamboard_active_context").select("project_ids,primary_id").limit(1), "ctx"),
        soft(sb.from("dreamboard_vision_entries").select("project_id").not("project_id", "is", null), "vision"),
        soft(sb.from("dreamboard_vault_entries").select("project_id").not("project_id", "is", null), "vault"),
        K.q(sb.from("dreamboard_writing_documents").select("project_id").not("project_id", "is", null))
      ]);
      var settings = {}; r[1].forEach(function (s) { settings[s.project_id] = s; });
      S.projects = r[0].filter(function (p) { return !settings[p.id] || settings[p.id].status !== "archived"; });
      S.links = r[2]; if (r[3][0]) S.ctx = { project_ids: r[3][0].project_ids || [], primary_id: r[3][0].primary_id };
      function m(id) { return S.material[id] || (S.material[id] = { vision: 0, knowledge: 0, documents: 0, passages: 0 }); }
      r[4].forEach(function (x) { m(x.project_id).vision++; });
      r[5].forEach(function (x) { m(x.project_id).knowledge++; });
      r[6].forEach(function (x) { m(x.project_id).documents++; });
      // Book passages count only through a link the creator made (Projects → Finishing Engine → "Manuscript in Book Studio").
      var bookOf = {}; S.projects.forEach(function (p) { var b = settings[p.id] && (settings[p.id].metadata || {}).book_id; if (b) bookOf[b] = (bookOf[b] || []).concat([p.id]); });
      var bids = Object.keys(bookOf);
      if (bids.length) {
        var ps = await soft(sb.from("dreamboard_book_passages").select("book_id").eq("speaker", "author").in("book_id", bids), "passages");
        ps.forEach(function (x) { (bookOf[x.book_id] || []).forEach(function (pid) { m(pid).passages++; }); });
      }
      function total(id) { var c = S.material[id]; return c ? c.vision + c.knowledge + c.documents + c.passages : 0; }
      function proj(id) { return S.projects.filter(function (p) { return p.id === id; })[0]; }
      function label(p) { return ICON[p.kind] || "✺"; }
      var pos = {};
      S.projects.forEach(function (p, i) { var rad = 70 * Math.sqrt(i + 0.5), a = i * GOLDEN; pos[p.id] = { x: Math.cos(a) * rad, y: Math.sin(a) * rad }; });
      function size(id) { return 12 + Math.min(26, Math.sqrt(total(id)) * 4); }
      function visibleLinks() { return S.links.filter(function (l) { return pos[l.from_project_id] && pos[l.to_project_id]; }); }

      // deterministic star dust (seeded by index, purely decorative)
      var dust = ""; for (var i = 0; i < 90; i++) { var a = i * 2.1, rr = 40 + ((i * 97) % 520); dust += '<circle class="cn-dust" cx="' + (Math.cos(a) * rr).toFixed(1) + '" cy="' + (Math.sin(a) * rr * 0.62).toFixed(1) + '" r="' + (0.5 + (i % 3) * 0.4) + '" opacity="' + (0.15 + (i % 5) * 0.08) + '"/>'; }

      function sky() {
        if (!S.projects.length) return '<div class="bk-empty">Your universe is waiting for its first world.<br><span class="bk-note">Create a project and it becomes a star here — sized by the material you bring into it.</span><br><br><a class="btn solid" href="#/r/projects">Open Projects</a></div>';
        var v = S.view, links = visibleLinks();
        var edges = links.map(function (l) { var a = pos[l.from_project_id], b = pos[l.to_project_id], hi = S.sel && (l.from_project_id === S.sel || l.to_project_id === S.sel);
          return '<line class="cn-edge' + (hi ? " hi" : "") + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>' + (hi ? '<text class="cn-elabel" x="' + ((a.x + b.x) / 2) + '" y="' + ((a.y + b.y) / 2 - 4) + '">' + esc(l.relationship.replace("_", " ")) + "</text>" : ""); }).join("");
        var stars = S.projects.map(function (p) { var q = pos[p.id], s = size(p.id), t = p.title.length > 22 ? p.title.slice(0, 21) + "…" : p.title;
          var cls = "cn-star" + (p.id === S.ctx.primary_id ? " pri" : "") + (p.id === S.sel ? " sel" : "") + (p.id === S.from ? " from" : "");
          return '<g class="' + cls + '" data-star="' + p.id + '" transform="translate(' + q.x + " " + q.y + ')" tabindex="0" role="button" aria-pressed="' + (p.id === S.sel) + '" aria-label="' + esc(p.title) + ", " + total(p.id) + ' pieces of material"><circle class="glow" r="' + (s * 2.2) + '"/><circle class="core" r="' + s + '"/><text class="ic" y="4">' + label(p) + '</text><text y="' + (s + 17) + '">' + esc(t) + "</text></g>"; }).join("");
        return '<div class="cn-sky"><svg viewBox="-480 -300 960 600" tabindex="0" role="application" aria-label="Constellation of your projects. Drag or use arrow keys to pan, scroll or plus and minus to zoom, Tab to move between stars, Enter to focus a star." data-sky="1"><defs><radialGradient id="cn-glow"><stop offset="0" stop-color="#f3d996" stop-opacity=".45"/><stop offset="1" stop-color="#f3d996" stop-opacity="0"/></radialGradient></defs>' +
          '<g data-cam transform="translate(' + v.x + " " + v.y + ") scale(" + v.k + ')">' + dust + edges + stars + "</g></svg>" +
          '<div class="cn-ctl"><button class="btn small" data-a="zin" aria-label="Zoom in">+</button><button class="btn small" data-a="zout" aria-label="Zoom out">−</button><button class="btn small" data-a="reset">Reset</button></div>' +
          '<div class="cn-hint">' + S.projects.length + " star" + (S.projects.length === 1 ? "" : "s") + " · " + links.length + " link" + (links.length === 1 ? "" : "s") + " you drew · drag / arrows pan · scroll / + − zoom</div></div>";
      }
      function side() {
        if (S.miss.links) return K.setupNotice("Constellation links", SQL);
        var note = S.from ? '<div class="cn-note">Connecting “' + esc((proj(S.from) || {}).title) + "” → choose a second star to link them as “" + esc(S.rel.replace("_", " ")) + '”. <button class="btn small" data-a="cancel">Cancel</button></div>' : "";
        var p = S.sel && proj(S.sel);
        if (!p) return K.panel("Real worlds, real relationships", "", note + '<p class="bk-help">' + (S.projects.length ? "Each star is one of your projects. Its size comes from what you attached: ideas, knowledge entries, writing documents, and passages of a Book Studio book you linked to it. Lines are only the relationships you drew. Select a star to focus it, make it primary, or connect it to another." : "Create your first project to light up the sky.") + '</p><a class="btn small" href="#/r/projects">Open Projects</a>');
        var c = S.material[p.id] || { vision: 0, knowledge: 0, documents: 0, passages: 0 }, st = settings[p.id];
        var mine = visibleLinks().filter(function (l) { return l.from_project_id === p.id || l.to_project_id === p.id; });
        var pri = S.ctx.primary_id === p.id;
        return K.panel(esc(p.title), esc((st && st.status ? st.status.replace(/_/g, " ") : "idea")) + " · " + total(p.id) + " pieces of material",
          note + '<p class="bk-note">' + c.vision + " idea" + (c.vision === 1 ? "" : "s") + " · " + c.knowledge + " knowledge entr" + (c.knowledge === 1 ? "y" : "ies") + " · " + c.documents + " writing document" + (c.documents === 1 ? "" : "s") + " · " + c.passages + " book passage" + (c.passages === 1 ? "" : "s") + "</p>" +
          '<div class="rm-row"><button class="btn small' + (pri ? " solid" : "") + '" data-a="primary"' + (pri ? " disabled" : "") + ">" + (pri ? "Primary project ✓" : "Make primary") + '</button><a class="btn small" href="#/r/projects/' + p.id + '">Open in Projects</a></div>' +
          '<div class="pj-eye" style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:14px 0 6px">Draw a link</div><div class="rm-row"><select class="bk-in" style="width:auto;flex:1" data-a="rel" aria-label="Relationship">' + RELS.map(function (x) { return '<option value="' + x + '"' + (x === S.rel ? " selected" : "") + ">" + x.replace("_", " ") + "</option>"; }).join("") + '</select><button class="btn small" data-a="connect"' + (S.from === p.id || S.projects.length < 2 ? " disabled" : "") + ">Connect to another star</button></div>" +
          '<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:14px 0 6px">Links</div>' +
          (mine.map(function (l) { var out = l.from_project_id === p.id, other = proj(out ? l.to_project_id : l.from_project_id);
            return '<div class="cn-link"><span>' + (out ? "" : esc(other ? other.title : "removed") + " ") + "<b>" + esc(l.relationship.replace("_", " ")) + "</b> " + (out ? "→ " + esc(other ? other.title : "removed") : "→ this") + '</span><button class="btn small" data-a="unlink" data-id="' + l.id + '">Remove</button></div>'; }).join("") || '<p class="bk-note">No links yet.</p>'));
      }
      function paint(focusStar) {
        el.innerHTML = K.scene("Dream Board OS · Build", "Constellation", "Every project is a world you can enter. Stars are your real projects, sized by the material each holds; relationships are only the ones you draw.", "art-sunrise.jpg", '<a class="btn" href="#/r/projects">Projects</a>') +
          '<div class="bk-work one" style="max-width:1400px"><div class="cn-wrap"><div>' + sky() + "</div><div>" + side() + "</div></div></div>";
        if (focusStar) { var n = el.querySelector('[data-star="' + focusStar + '"]'); if (n) n.focus(); }
      }
      function cam() { var g = el.querySelector("[data-cam]"); if (g) g.setAttribute("transform", "translate(" + S.view.x + " " + S.view.y + ") scale(" + S.view.k + ")"); }
      function zoom(f) { S.view.k = Math.min(3, Math.max(0.3, S.view.k * f)); cam(); }
      paint();

      async function choose(id) {
        if (S.from && S.from !== id) {
          var from = S.from; S.from = null;
          if (S.miss.links) return paint(id);
          try { var row = await K.insert("dreamboard_project_links", { from_project_id: from, to_project_id: id, relationship: S.rel }); S.links.unshift(row); K.toast("Projects linked in your constellation."); }
          catch (e) { K.toast(e.code === "23505" ? "Those projects already have this relationship." : "The link could not be saved: " + (e.message || e), true); }
          S.sel = id; return paint(id);
        }
        S.sel = S.sel === id ? null : id; paint(id);
      }
      el.addEventListener("click", async function (e) {
        if (drag && drag.moved) return;
        var st = e.target.closest("[data-star]"); if (st) return choose(st.dataset.star);
        var b = e.target.closest("[data-a]"); if (!b || b.tagName === "SELECT") return;
        var a = b.dataset.a;
        if (a === "zin") return zoom(1.2);
        if (a === "zout") return zoom(1 / 1.2);
        if (a === "reset") { S.view = { x: 0, y: 0, k: 1 }; return cam(); }
        if (a === "cancel") { S.from = null; return paint(); }
        if (a === "connect") { S.from = S.sel; K.toast("Now choose the second star."); return paint(S.sel); }
        if (a === "unlink") { if (!confirm("Remove this link? The projects themselves are not touched.")) return; try { await K.remove("dreamboard_project_links", b.dataset.id); S.links = S.links.filter(function (l) { return l.id !== b.dataset.id; }); paint(); } catch (er) { K.toast("Could not remove: " + (er.message || er), true); } return; }
        if (a === "primary") {
          if (S.miss.ctx) return K.toast("Active context needs its shelf first (" + SQL + ").", true);
          var ids = S.ctx.project_ids.slice(); if (ids.indexOf(S.sel) < 0) { if (ids.length >= 7) return K.toast("Up to 7 projects can be in focus — remove one in Projects first.", true); ids.push(S.sel); }
          try { await K.q(sb.from("dreamboard_active_context").upsert({ owner_id: uid, project_ids: ids, primary_id: S.sel, updated_at: new Date().toISOString() }, { onConflict: "owner_id" })); S.ctx = { project_ids: ids, primary_id: S.sel }; K.toast("Primary project set."); paint(S.sel); }
          catch (er) { K.toast("Could not save: " + (er.message || er), true); }
        }
      });
      el.addEventListener("change", function (e) { if (e.target.dataset.a === "rel") S.rel = e.target.value; });
      el.addEventListener("keydown", function (e) {
        var st = e.target.closest && e.target.closest("[data-star]");
        if (st && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(st.dataset.star); return; }
        if (!e.target.closest || !e.target.closest(".cn-sky svg")) return;
        var step = 40, k = e.key;
        if (k === "ArrowLeft") S.view.x += step; else if (k === "ArrowRight") S.view.x -= step; else if (k === "ArrowUp") S.view.y += step; else if (k === "ArrowDown") S.view.y -= step;
        else if (k === "+" || k === "=") return zoom(1.2); else if (k === "-" || k === "_") return zoom(1 / 1.2);
        else if (k === "Escape") { if (S.from) { S.from = null; paint(); } return; } else return;
        e.preventDefault(); cam();
      });
      var drag = null;
      el.addEventListener("pointerdown", function (e) { var svg = e.target.closest(".cn-sky svg"); if (!svg || e.button) return; drag = { sx: e.clientX, sy: e.clientY, ox: S.view.x, oy: S.view.y, moved: false, scale: 960 / svg.getBoundingClientRect().width }; });
      el.addEventListener("pointermove", function (e) { if (!drag) return; var dx = (e.clientX - drag.sx) * drag.scale, dy = (e.clientY - drag.sy) * drag.scale; if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true; if (drag.moved) { S.view.x = drag.ox + dx; S.view.y = drag.oy + dy; cam(); } });
      function end() { if (drag && drag.moved) setTimeout(function () { drag = null; }, 0); else drag = null; }
      el.addEventListener("pointerup", end); el.addEventListener("pointerleave", end); el.addEventListener("pointercancel", end);
      el.addEventListener("wheel", function (e) { if (!e.target.closest(".cn-sky svg")) return; e.preventDefault(); zoom(e.deltaY > 0 ? 0.9 : 1.1); }, { passive: false });
    }
  });
})();
