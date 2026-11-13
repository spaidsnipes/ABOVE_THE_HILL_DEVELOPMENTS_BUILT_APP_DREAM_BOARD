/* Dream Board OS · room kit (Above the Hill Developments, 2026-11-12)
 * Every room from the original Dream Board lives in board/rooms/<id>.js and registers itself with DBRoom.register.
 * app.js loads this kit + the room lazily on #/r/<id> and calls room.mount(el, ctx).
 * Rules for every room: real rows only (no fake data), Passport naming, owner-only RLS, the author's words lead
 * (AI suggests, never silently writes), honest setup notices, works at 390 / 834 / 1440. */
(function () {
  "use strict";
  var rooms = {};
  var ctx = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtDay(s) { if (!s) return ""; var d = new Date(s); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  function fmtN(n) { return Number(n || 0).toLocaleString(); }
  function words(s) { var m = String(s || "").match(/[A-Za-z0-9À-ɏ'’]+/g); return m ? m.length : 0; }
  function uid() { return ctx && ctx.user() ? ctx.user().id : null; }
  // PostgREST "relation does not exist" / schema-cache miss → the room shows an honest setup notice, never a crash.
  function missingTable(err) { var m = String((err && (err.message || err.code)) || ""); return /42P01|PGRST205|PGRST204|does not exist|schema cache/i.test(m + " " + (err && err.code)); }
  async function q(promise) { var r = await promise; if (r.error) throw r.error; return r.data; }
  var Kit = {
    esc: esc, fmtDay: fmtDay, fmtN: fmtN, words: words, uid: uid, missingTable: missingTable, q: q,
    get sb() { return ctx.sb; }, get ctx() { return ctx; },
    toast: function (m, bad) { ctx.toast(m, bad); },
    /** rows of an owner-only table (RLS already limits them to this Passport) */
    list: function (table, opts) {
      opts = opts || {};
      var b = ctx.sb.from(table).select(opts.select || "*");
      Object.keys(opts.eq || {}).forEach(function (k) { b = b.eq(k, opts.eq[k]); });
      if (opts.order) b = b.order(opts.order, { ascending: !!opts.ascending });
      if (opts.limit) b = b.limit(opts.limit);
      return q(b);
    },
    insert: function (table, row) { row = Object.assign({ owner_id: uid() }, row); return q(ctx.sb.from(table).insert(row).select().single()); },
    update: function (table, id, patch, key) { return q(ctx.sb.from(table).update(patch).eq(key || "id", id).select().single()); },
    remove: function (table, id, key) { return q(ctx.sb.from(table).delete().eq(key || "id", id)); },
    /** cinematic room header (uses the Book Studio scene classes; img is a board/ art file) */
    scene: function (kicker, title, lede, img, actions) {
      return '<section class="bk-scene room-scene"><div class="bk-plate"' + (img ? ' style="background-image:url(' + img + ')"' : "") + '></div><div class="bk-grain"></div><div class="bk-scene-in"><div class="bk-kicker">' + kicker + "</div><h1>" + title + '</h1><p class="lede">' + lede + "</p>" + (actions ? '<div class="bk-actions">' + actions + "</div>" : "") + "</div></section>";
    },
    panel: function (title, sub, inner, extraClass) { return '<div class="bk-panel ' + (extraClass || "") + '">' + (title ? "<h3>" + title + "</h3>" : "") + (sub ? '<p class="sub">' + sub + "</p>" : "") + inner + "</div>"; },
    setupNotice: function (what, sqlFile) {
      return '<div class="bk-panel"><h3>' + esc(what) + ' is getting its shelf</h3><p class="sub">This room\'s private table is not in your Passport database yet (' + esc(sqlFile) + '). Nothing is lost — it opens as soon as it is set up.</p></div>';
    },
    empty: function (text) { return '<div class="bk-panel bk-empty">' + text + "</div>"; },
    /** inject a room's own CSS once */
    css: function (id, text) { if (document.getElementById("room-css-" + id)) return; var s = document.createElement("style"); s.id = "room-css-" + id; s.textContent = text; document.head.appendChild(s); },
    /** lazy-load another board script once (e.g. book-engine.js for clustering) */
    script: function (src) { return new Promise(function (res, rej) { if (document.querySelector('script[data-src="' + src + '"]')) return res(); var el = document.createElement("script"); el.src = src; el.dataset.src = src; el.onload = res; el.onerror = function () { rej(new Error("Could not load " + src)); }; document.head.appendChild(el); }); },
    download: function (blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  };
  window.DBKit = Kit;
  window.DBRoom = {
    register: function (id, room) { rooms[id] = room; },
    get: function (id) { return rooms[id]; },
    setCtx: function (c) { ctx = c; }
  };
})();
