/* Dream Board OS · Creative Graph (ported from ~/dreamboard/app/creative-graph.tsx, 2026-11-12)
 * Real, stored nodes and relationships only (dreamboard_graph_nodes / dreamboard_graph_edges, owner RLS) — nothing invented.
 * Edge provenance (origin / confidence / evidence / confirmed_by_user) from dreamboard-graph-provenance.sql: suggested links
 * stay dashed until the author confirms them. Layout is a deterministic golden-angle spiral (no physics, no library). */
(function () {
  "use strict";
  var K = window.DBKit;
  var NODE_COLS = "id,node_type,label,description,vault_entry_id,project_id,created_at";
  var EDGE_BASE = "id,from_node_id,to_node_id,relationship";
  var EDGE_FULL = EDGE_BASE + ",origin,confidence,evidence,confirmed_by_user";
  var RELS = ["supports", "belongs_to", "inspires", "contradicts", "follows", "references"];
  var TYPES = ["source", "theme", "project", "chapter", "insight", "person", "place", "question"];
  var COLORS = { source: "#3fae94", theme: "#d9a548", project: "#6f8fd6", chapter: "#a785d6", insight: "#e07a52", person: "#4fb3c4", place: "#8fb04f", question: "#d65f92" };
  var CAP = 300, GOLDEN = 2.399963229728653;
  function rl(r) { return String(r || "").replace(/_/g, " "); }

  K.css("graph", [
    ".cg-wrap{display:grid;gap:18px;padding:18px clamp(12px,3vw,40px) 40px;grid-template-columns:minmax(0,1fr) 340px;align-items:start}",
    "@media (max-width:980px){.cg-wrap{grid-template-columns:minmax(0,1fr);padding:12px 16px 28px}}",
    ".cg-canvas{position:relative;height:clamp(360px,62vh,680px);border-radius:18px;overflow:hidden;border:1px solid rgba(217,181,108,.22);background:radial-gradient(70% 70% at 50% 45%,rgba(28,58,44,.55),rgba(4,8,6,.92))}",
    ".cg-canvas svg{width:100%;height:100%;display:block;touch-action:none;cursor:grab;user-select:none}",
    ".cg-canvas svg.drag{cursor:grabbing}",
    ".cg-canvas[data-connecting=true]{box-shadow:0 0 0 2px var(--gold-hi) inset}",
    ".cg-edge{stroke:rgba(243,217,150,.55)}.cg-edge.sug{stroke:#9fc7e8;stroke-dasharray:5 4}",
    ".cg-node{cursor:pointer}.cg-node:focus{outline:none}.cg-node:focus circle{stroke:#f3d996;stroke-width:3}",
    ".cg-nl{fill:#f4ead3;font-size:11px;text-anchor:middle;paint-order:stroke;stroke:rgba(4,8,6,.9);stroke-width:3px;pointer-events:none}",
    ".cg-el{fill:#f3d996;font-size:10px;text-anchor:middle;paint-order:stroke;stroke:rgba(4,8,6,.95);stroke-width:3px;pointer-events:none}",
    ".cg-zoom{position:absolute;right:10px;bottom:10px;display:flex;gap:6px}",
    ".cg-zoom .btn{min-width:40px}",
    ".cg-cap{position:absolute;left:12px;bottom:12px;right:150px;font-size:12px;color:var(--muted);margin:0}",
    ".cg-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;color:var(--cream-dim);font-family:var(--serif);font-size:19px}",
    ".cg-edges{display:grid;gap:8px;margin-top:10px}",
    ".cg-edges article{padding:10px;border-radius:12px;border:1px solid rgba(217,181,108,.18);background:rgba(4,8,6,.45);display:grid;gap:6px}",
    ".cg-edges small{color:var(--muted);font-size:12px;word-break:break-word}",
    ".cg-legend{display:flex;flex-wrap:wrap;gap:6px}",
    ".cg-side{display:grid;gap:14px}",
    ".cg-tools{padding:12px clamp(12px,3vw,40px) 0;display:grid;gap:8px}"
  ].join("\n"));

  DBRoom.register("graph", {
    mount: async function (el) {
      var S = { nodes: [], edges: [], entries: [], prov: true, setup: false, type: "all", rel: "all", sug: true, sel: null, from: null, linkAs: "supports", view: { x: 0, y: 0, k: 1 }, pos: new Map() };

      async function load() {
        try { S.nodes = await K.q(K.sb.from("dreamboard_graph_nodes").select(NODE_COLS).order("created_at", { ascending: false }).limit(700)); }
        catch (e) { if (K.missingTable(e)) { S.setup = true; return; } throw e; }
        var full = await K.sb.from("dreamboard_graph_edges").select(EDGE_FULL).limit(1200);
        if (full.error) {
          S.prov = false;
          var base = await K.sb.from("dreamboard_graph_edges").select(EDGE_BASE).limit(1200);
          if (base.error) { S.setup = true; return; }
          S.edges = base.data.map(function (e) { return Object.assign({ origin: "user", confidence: null, evidence: null, confirmed_by_user: true }, e); });
        } else S.edges = full.data;
        try {
          var have = new Set(S.nodes.map(function (n) { return n.vault_entry_id; }).filter(Boolean));
          var ents = await K.q(K.sb.from("dreamboard_vault_entries").select("id,title,content,project_id").neq("status", "archived").order("updated_at", { ascending: false }).limit(200));
          S.entries = ents.filter(function (e) { return !have.has(e.id); });
        } catch (e) { S.entries = []; }
      }
      function node(id) { for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === id) return S.nodes[i]; return null; }
      function visNodes() { return S.nodes.filter(function (n) { return S.type === "all" || n.node_type === S.type; }).slice(0, CAP); }
      function visEdges(ids) { return S.edges.filter(function (e) { return ids.has(e.from_node_id) && ids.has(e.to_node_id) && (S.rel === "all" || e.relationship === S.rel) && (S.sug || e.confirmed_by_user); }); }
      function layout(nodes) { S.pos = new Map(); nodes.forEach(function (n, i) { var r = 46 * Math.sqrt(i + 0.6), a = i * GOLDEN; S.pos.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r }); }); }

      function svgHtml() {
        var vn = visNodes(), ids = new Set(vn.map(function (n) { return n.id; })), ve = visEdges(ids), e = K.esc;
        layout(vn);
        if (!vn.length) return '<div class="cg-empty"><div>' + (S.nodes.length ? "No nodes of that type." : "Your first graph is waiting.<br><span style=\"font-size:15px;color:var(--muted)\">Add a note, journal entry or import to the Knowledge Vault — each becomes a private source node here. Or add a theme, person or question on the right.</span>") + "</div></div>";
        var edges = ve.map(function (ed) {
          var a = S.pos.get(ed.from_node_id), b = S.pos.get(ed.to_node_id); if (!a || !b) return "";
          var hi = S.sel && (ed.from_node_id === S.sel || ed.to_node_id === S.sel), sug = !ed.confirmed_by_user;
          return '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" class="cg-edge' + (sug ? " sug" : "") + '" stroke-width="' + (hi ? 2.4 : 1.2) + '" opacity="' + (S.sel && !hi ? 0.18 : 0.8) + '"/>' +
            (hi ? '<text class="cg-el" x="' + ((a.x + b.x) / 2).toFixed(1) + '" y="' + ((a.y + b.y) / 2 - 5).toFixed(1) + '">' + e(rl(ed.relationship)) + (sug ? " · suggested" : "") + "</text>" : "");
        }).join("");
        var nodes = vn.map(function (n) {
          var p = S.pos.get(n.id), on = n.id === S.sel, src = n.id === S.from, lab = n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label;
          return '<g class="cg-node" data-node="' + n.id + '" transform="translate(' + p.x.toFixed(1) + " " + p.y.toFixed(1) + ')" tabindex="0" role="button" aria-label="' + e(n.node_type + ": " + n.label) + '"><circle r="' + (on ? 15 : 11) + '" fill="' + (COLORS[n.node_type] || "#7d8f86") + '" stroke="' + (on || src ? "#f3d996" : "rgba(255,255,255,.6)") + '" stroke-width="' + (on || src ? 3 : 1.4) + '"/><text class="cg-nl" y="' + (on ? 30 : 25) + '">' + e(lab) + "</text></g>";
        }).join("");
        var v = S.view;
        return '<svg viewBox="-450 -300 900 600" role="application" aria-label="Creative graph. Drag to pan, scroll or use the buttons to zoom, tap a node to inspect it."><g id="cg-g" transform="translate(' + v.x + " " + v.y + ") scale(" + v.k + ')">' + edges + nodes + "</g></svg>" +
          (S.nodes.length > CAP ? '<p class="cg-cap">Showing the ' + CAP + " most recent of " + K.fmtN(S.nodes.length) + " nodes. Filters narrow the view.</p>" : "");
      }

      function sideHtml() {
        var e = K.esc, out = "";
        if (S.from) out += K.panel("Connecting", "", '<p class="bk-help" style="margin:0 0 8px">“' + e((node(S.from) || {}).label) + "” → tap a second node to create a “" + e(rl(S.linkAs)) + '” link.</p><button class="btn small" data-a="cancel-conn">Cancel connection</button>');
        var n = S.sel && node(S.sel);
        if (n) {
          var mine = S.edges.filter(function (ed) { return (ed.from_node_id === n.id || ed.to_node_id === n.id) && (S.sug || ed.confirmed_by_user); });
          out += K.panel(e(n.label), '<span style="text-transform:uppercase;letter-spacing:.14em;color:' + (COLORS[n.node_type] || "var(--gold)") + '">' + e(n.node_type) + " node</span> · " + K.fmtDay(n.created_at),
            (n.description ? '<p class="bk-help" style="white-space:pre-wrap;word-break:break-word">' + e(n.description) + "</p>" : "") +
            '<div class="rm-row">' + (n.vault_entry_id ? '<button class="btn small" data-a="open-src">Open in Knowledge Vault</button>' : "") + '<button class="btn small" data-a="center">Center</button><button class="btn small" data-a="del-node">Remove node</button></div>' +
            '<div class="rm-row" style="margin-top:10px"><label class="rm-l" for="cg-as">Link as</label><select id="cg-as" class="bk-in" style="width:auto">' + RELS.map(function (r) { return '<option value="' + r + '"' + (r === S.linkAs ? " selected" : "") + ">" + rl(r) + "</option>"; }).join("") + '</select><button class="btn small solid" data-a="connect"' + (S.from === n.id ? " disabled" : "") + ">Connect to another node</button></div>" +
            '<div class="cg-edges"><div class="rm-l">RELATIONSHIPS · ' + mine.length + "</div>" + (mine.length ? mine.map(function (ed) {
              var out2 = ed.from_node_id === n.id, other = node(out2 ? ed.to_node_id : ed.from_node_id), sug = !ed.confirmed_by_user;
              return '<article data-edge="' + ed.id + '"><b style="font-weight:500;word-break:break-word">' + (out2 ? e(rl(ed.relationship)) + " → " : "← " + e(rl(ed.relationship)) + " ") + e(other ? other.label : "removed node") + "</b><small>" +
                (sug ? "Suggested (" + e(rl(ed.origin)) + (typeof ed.confidence === "number" ? " · " + Math.round(ed.confidence * 100) + "%" : "") + ") — not yet confirmed" : "Confirmed · " + e(rl(ed.origin))) + (ed.evidence ? " · " + e(ed.evidence) : "") +
                '</small><div class="rm-row">' + (sug && S.prov ? '<button class="btn small" data-a="confirm">Confirm</button>' : "") + '<button class="btn small" data-a="del-edge">' + (sug ? "Reject" : "Remove") + "</button></div></article>";
            }).join("") : '<p class="bk-help">No relationships yet. Use “Connect to another node” to make the first one.</p>') + "</div>");
        } else {
          out += K.panel("Evidence before imagination", "", '<p class="bk-help">' + (S.nodes.length ? K.fmtN(S.nodes.length) + " node" + (S.nodes.length === 1 ? "" : "s") + " · " + K.fmtN(S.edges.length) + " relationship" + (S.edges.length === 1 ? "" : "s") + ", all stored under your Passport. Tap a node to inspect, connect or open its source. Drag to pan; scroll or use + / − to zoom." : "Each saved Knowledge Vault entry becomes a source node. Relationships appear only when you make them or confirm a suggestion — Dream Board never invents links between your ideas.") + '</p><div class="cg-legend">' + TYPES.map(function (t) { return '<span class="bk-chip" style="--c:' + COLORS[t] + ';cursor:default"><i></i>' + t + "</span>"; }).join("") + "</div>");
        }
        out += K.panel("Add a node", "Name a theme, person, place, question or insight in your own words.",
          '<div class="rm-form"><label class="rm-l" for="cg-nt">Type</label><select id="cg-nt" class="bk-in">' + TYPES.filter(function (t) { return t !== "source"; }).map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") + '</select><label class="rm-l" for="cg-nl">Label</label><input id="cg-nl" class="bk-in" maxlength="160" placeholder="e.g. Forgiveness"><label class="rm-l" for="cg-nd">Note (optional)</label><input id="cg-nd" class="bk-in" maxlength="360"><div class="rm-row"><span class="spacer"></span><button class="btn small solid" data-a="add-node">Add node</button></div></div>');
        if (S.entries.length) out += K.panel("Knowledge not yet in your graph", S.entries.length + " vault entr" + (S.entries.length === 1 ? "y has" : "ies have") + " no source node yet.",
          '<div class="rm-form">' + S.entries.slice(0, 8).map(function (en) { return '<div class="rm-row" data-entry="' + en.id + '"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + e(en.title) + '</span><button class="btn small" data-a="src">Add</button></div>'; }).join("") + (S.entries.length > 1 ? '<button class="btn small" data-a="src-all">Add all ' + S.entries.length + "</button>" : "") + "</div>");
        return out;
      }

      function paint() {
        var head = K.scene("Creative Graph · private to you", "See the connections inside the archive.",
          "Every node and relationship below is real, stored material — nothing is invented. Suggested links stay dashed until you confirm them.",
          "art-hero-hill.jpg", '<a class="btn" href="#/r/knowledge">Add source material</a><a class="btn" href="#/r/search">Search</a>');
        if (S.setup) { el.innerHTML = head + '<div class="bk-work one">' + K.setupNotice("Creative Graph", "supabase/dreamboard-creator-workspace.sql") + "</div>"; return; }
        var present = Array.from(new Set(S.nodes.map(function (n) { return n.node_type; })));
        var tools = '<div class="cg-tools"><div class="bk-chips" style="margin:0" role="group" aria-label="Filter nodes by type"><button class="bk-chip" data-type="all" aria-pressed="' + (S.type === "all") + '">All types</button>' + present.map(function (t) { return '<button class="bk-chip" style="--c:' + (COLORS[t] || "#7d8f86") + '" data-type="' + t + '" aria-pressed="' + (S.type === t) + '"><i></i>' + t + "</button>"; }).join("") + "</div>" +
          '<div class="rm-row"><label class="rm-l" for="cg-rel">Relationship</label><select id="cg-rel" class="bk-in" style="width:auto"><option value="all">All</option>' + RELS.map(function (r) { return '<option value="' + r + '"' + (S.rel === r ? " selected" : "") + ">" + rl(r) + "</option>"; }).join("") + '</select><label class="rm-l"><input type="checkbox" id="cg-sug"' + (S.sug ? " checked" : "") + "> Show suggestions</label>" + (S.prov ? "" : '<span class="rm-meta">Provenance columns not set up — all links count as yours.</span>') + "</div></div>";
        el.innerHTML = head + tools + '<div class="cg-wrap"><div class="cg-canvas" id="cg-c" data-connecting="' + !!S.from + '">' + svgHtml() + '<div class="cg-zoom"><button class="btn small" data-z="in" aria-label="Zoom in">+</button><button class="btn small" data-z="out" aria-label="Zoom out">−</button><button class="btn small" data-z="reset">Reset</button></div></div><div class="cg-side" id="cg-side">' + sideHtml() + "</div></div>";
      }
      function repaintGraph() { var c = el.querySelector("#cg-c"); if (!c) return paint(); c.dataset.connecting = !!S.from; var z = c.querySelector(".cg-zoom"); c.innerHTML = svgHtml(); c.appendChild(z); el.querySelector("#cg-side").innerHTML = sideHtml(); }
      function applyView() { var g = el.querySelector("#cg-g"); if (g) g.setAttribute("transform", "translate(" + S.view.x + " " + S.view.y + ") scale(" + S.view.k + ")"); }
      function svgScale() { var svg = el.querySelector("#cg-c svg"); if (!svg) return 1; var r = svg.getBoundingClientRect(); return Math.max(900 / r.width, 600 / r.height); }

      async function createEdge(from, to, rel) {
        if (from === to) return;
        var row = { owner_id: K.uid(), from_node_id: from, to_node_id: to, relationship: rel };
        if (S.prov) { row.origin = "user"; row.confirmed_by_user = true; }
        var r = await K.sb.from("dreamboard_graph_edges").insert(row).select(S.prov ? EDGE_FULL : EDGE_BASE).single();
        if (r.error) { K.toast(r.error.code === "23505" ? "Those two nodes already have this relationship." : "Could not save that connection: " + r.error.message, true); return; }
        S.edges.unshift(Object.assign({ origin: "user", confidence: null, evidence: null, confirmed_by_user: true }, r.data));
        K.toast("Connection saved to your private Creative Graph.");
      }
      async function addSource(en) {
        var n = await K.insert("dreamboard_graph_nodes", { vault_entry_id: en.id, node_type: "source", label: (en.title || "Untitled source").slice(0, 160), description: (en.content || "").slice(0, 360), project_id: en.project_id || null });
        S.nodes.unshift(n); S.entries = S.entries.filter(function (x) { return x.id !== en.id; });
      }

      // pan (pointer) + zoom (wheel / buttons); a press that barely moves is a tap on the node under it
      var drag = null;
      el.addEventListener("pointerdown", function (ev) { var svg = ev.target.closest("#cg-c svg"); if (!svg) return; drag = { x: ev.clientX, y: ev.clientY, ox: S.view.x, oy: S.view.y, s: svgScale(), moved: false, node: ev.target.closest("[data-node]") }; svg.setPointerCapture(ev.pointerId); });
      el.addEventListener("pointermove", function (ev) { if (!drag) return; var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return; drag.moved = true; var svg = el.querySelector("#cg-c svg"); if (svg) svg.classList.add("drag"); S.view.x = drag.ox + dx * drag.s; S.view.y = drag.oy + dy * drag.s; applyView(); });
      function endDrag() { if (!drag) return; var d = drag; drag = null; var svg = el.querySelector("#cg-c svg"); if (svg) svg.classList.remove("drag"); if (!d.moved && d.node) tapNode(d.node.dataset.node); else if (!d.moved && !d.node && S.sel && !S.from) { S.sel = null; repaintGraph(); } }
      el.addEventListener("pointerup", endDrag); el.addEventListener("pointercancel", function () { drag = null; });
      el.addEventListener("wheel", function (ev) { if (!ev.target.closest("#cg-c svg")) return; ev.preventDefault(); S.view.k = Math.min(3, Math.max(0.3, S.view.k * (ev.deltaY > 0 ? 0.9 : 1.1))); applyView(); }, { passive: false });
      el.addEventListener("keydown", function (ev) { var g = ev.target.closest && ev.target.closest("[data-node]"); if (g && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); tapNode(g.dataset.node); } });

      async function tapNode(id) {
        if (S.from && S.from !== id) { var f = S.from; S.from = null; await createEdge(f, id, S.linkAs); S.sel = id; repaintGraph(); return; }
        S.sel = S.sel === id ? null : id; repaintGraph();
      }

      el.addEventListener("change", function (ev) {
        if (ev.target.id === "cg-rel") { S.rel = ev.target.value; repaintGraph(); }
        else if (ev.target.id === "cg-sug") { S.sug = ev.target.checked; repaintGraph(); }
        else if (ev.target.id === "cg-as") S.linkAs = ev.target.value;
      });
      el.addEventListener("click", async function (ev) {
        var t = ev.target.closest("[data-type]"); if (t) { S.type = t.dataset.type; S.sel = null; paint(); return; }
        var z = ev.target.closest("[data-z]"); if (z) { if (z.dataset.z === "reset") S.view = { x: 0, y: 0, k: 1 }; else S.view.k = Math.min(3, Math.max(0.3, S.view.k * (z.dataset.z === "in" ? 1.25 : 0.8))); applyView(); return; }
        var b = ev.target.closest("button[data-a]"); if (!b) return;
        var a = b.dataset.a, n = S.sel && node(S.sel);
        try {
          if (a === "cancel-conn") { S.from = null; repaintGraph(); }
          else if (a === "connect" && n) { S.linkAs = el.querySelector("#cg-as").value; S.from = n.id; repaintGraph(); K.toast("Now tap the node to connect to."); }
          else if (a === "center" && n) { var p = S.pos.get(n.id); if (p) { S.view.x = -p.x * S.view.k; S.view.y = -p.y * S.view.k; applyView(); } }
          else if (a === "open-src" && n) { try { sessionStorage.setItem("dbos-focus", JSON.stringify({ room: "knowledge", id: n.vault_entry_id })); } catch (e) {} location.hash = "#/r/knowledge"; }
          else if (a === "del-node" && n) {
            if (!confirm("Remove the node “" + n.label + "” and its relationships from your graph?" + (n.vault_entry_id ? " The Knowledge Vault entry itself stays." : ""))) return;
            await K.remove("dreamboard_graph_nodes", n.id);
            S.nodes = S.nodes.filter(function (x) { return x.id !== n.id; }); S.edges = S.edges.filter(function (ed) { return ed.from_node_id !== n.id && ed.to_node_id !== n.id; }); S.sel = null;
            if (n.vault_entry_id) S.entries.unshift({ id: n.vault_entry_id, title: n.label, content: n.description, project_id: n.project_id });
            paint(); K.toast("Node removed.");
          }
          else if (a === "confirm") { var id = b.closest("[data-edge]").dataset.edge; await K.update("dreamboard_graph_edges", id, { confirmed_by_user: true }); S.edges.forEach(function (ed) { if (ed.id === id) ed.confirmed_by_user = true; }); repaintGraph(); K.toast("Suggestion confirmed as a real relationship."); }
          else if (a === "del-edge") { var eid = b.closest("[data-edge]").dataset.edge, ed0 = S.edges.filter(function (x) { return x.id === eid; })[0]; if (!confirm(ed0 && !ed0.confirmed_by_user ? "Reject and remove this suggested link?" : "Remove this relationship?")) return; await K.remove("dreamboard_graph_edges", eid); S.edges = S.edges.filter(function (x) { return x.id !== eid; }); repaintGraph(); K.toast("The connection was removed."); }
          else if (a === "add-node") {
            var lab = el.querySelector("#cg-nl").value.trim().slice(0, 160); if (!lab) { el.querySelector("#cg-nl").focus(); return; }
            var nn = await K.insert("dreamboard_graph_nodes", { node_type: el.querySelector("#cg-nt").value, label: lab, description: el.querySelector("#cg-nd").value.trim().slice(0, 360) });
            S.nodes.unshift(nn); S.sel = nn.id; S.type = "all"; paint(); K.toast("Node added.");
          }
          else if (a === "src") { var en = S.entries.filter(function (x) { return x.id === b.closest("[data-entry]").dataset.entry; })[0]; if (en) { await addSource(en); paint(); K.toast("Source node added."); } }
          else if (a === "src-all") { b.disabled = true; var list = S.entries.slice(), c = 0; for (var i = 0; i < list.length; i++) { await addSource(list[i]); c++; } paint(); K.toast(c + " source nodes added."); }
        } catch (e) { K.toast("That did not save: " + (e.message || e), true); }
      });

      try { await load(); } catch (e) { K.toast("Could not open your graph: " + (e.message || e), true); }
      paint();
    }
  });
})();
