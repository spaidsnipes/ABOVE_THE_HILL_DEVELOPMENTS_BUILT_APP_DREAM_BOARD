/* Dream Board OS · Growth Rings (ported from ~/dreamboard/app/growth-rings.tsx + lib/growth-rings.ts, 2026-11-12)
 * A private wall of the practices that grew you. Progression over perfection: no streaks, no scores, no verdicts.
 * Table: dreamboard_growth_entries (existing, owner RLS; unique per Passport + day + category + practice).
 * The rings are drawn deterministically from the rows you recorded — nothing is inferred or predicted. */
(function () {
  "use strict";
  var K = window.DBKit;
  var CATS = ["spiritual", "physical", "mental", "financial", "creative", "relationships", "work"];
  var LABEL = { spiritual: "Spiritual", physical: "Physical", mental: "Mental", financial: "Financial", creative: "Creative", relationships: "Relationships", work: "Work" };
  var COLOR = { spiritual: "#f3d996", physical: "#7cc7a1", mental: "#7fb2e6", financial: "#d9b56c", creative: "#c98fd6", relationships: "#e88f6f", work: "#b9d36a" };
  var PRACTICES = {
    spiritual: ["Prayer", "Bible", "Church", "Worship", "Fasting", "Reflection", "Gratitude"],
    physical: ["Sleep", "Workout", "Steps", "Nutrition", "Water", "Recovery"],
    mental: ["Reading", "Learning", "Journaling", "Thinking", "Meditation"],
    financial: ["Budget", "Investments", "Trading", "Business", "Saving"],
    creative: ["Dreamboard", "Writing", "Music", "Studios", "Projects"],
    relationships: ["Family", "Friends", "Mentorship", "Serving"],
    work: ["Job", "Business", "Clients", "Sales", "Meetings", "Deep Work"]
  };
  var COLS = "id,occurred_on,category,practice,reflection,created_at";
  function localDay(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayDate(s) { return new Date(s + "T00:00:00"); }
  function daysBack(s) { return Math.round((dayDate(localDay()) - dayDate(s)) / 86400000); }

  K.css("growth", [
    ".gr-top{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px;align-items:start}",
    "@media (max-width:900px){.gr-top{grid-template-columns:minmax(0,1fr)}}",
    ".gr-rings{display:grid;place-items:center}",
    ".gr-rings svg{width:100%;max-width:440px;height:auto;display:block}",
    ".gr-legend{display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:center;margin-top:10px;font-size:12px;color:var(--cream-dim)}",
    ".gr-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}",
    ".gr-chips{display:flex;flex-wrap:wrap;gap:6px}",
    ".gr-chip{font-size:13px;padding:7px 12px;border-radius:999px;border:1px solid rgba(217,181,108,.3);background:rgba(4,8,6,.5);color:var(--cream-dim);cursor:pointer;min-height:36px}",
    ".gr-chip[aria-pressed=true]{background:var(--c,var(--gold));color:#1b1407;border-color:transparent}",
    ".gr-chip .ok{margin-right:4px}",
    ".gr-month{display:grid;grid-template-columns:14px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid rgba(217,181,108,.12)}",
    ".gr-month .mk{width:10px;height:10px;border-radius:50%;margin-top:7px;background:var(--gold);box-shadow:0 0 12px rgba(243,217,150,.5)}",
    ".gr-month h4{margin:0 0 6px;font-family:var(--serif);font-weight:500;font-size:20px;color:var(--gold-hi)}",
    ".gr-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start;padding:8px 10px;border-radius:12px;background:rgba(4,8,6,.4);border-left:3px solid var(--c,var(--gold));margin-bottom:6px}",
    ".gr-entry b{color:var(--cream);font-weight:500}",
    ".gr-entry p{margin:4px 0 0;font-family:var(--serif);font-size:16px;color:var(--cream-dim);white-space:pre-wrap;word-break:break-word}",
    ".gr-entry .rm-row{justify-content:flex-end}",
    ".gr-sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}",
    ".gr-sum article{padding:10px 12px;border-radius:12px;border:1px solid rgba(217,181,108,.18);background:rgba(4,8,6,.4)}",
    ".gr-sum b{display:block;font-family:var(--serif);font-size:28px;font-weight:500;color:var(--cream);line-height:1}",
    ".gr-sum span{font-size:12px;color:var(--muted)}",
    ".gr-principle p{font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--cream-dim);margin:0}",
    ".gr-edit{display:grid;gap:8px;grid-column:1/-1}"
  ].join("\n"));

  DBRoom.register("growth", {
    mount: async function (el) {
      var S = { rows: [], setup: false, cat: "spiritual", chosen: [], day: localDay(), editing: null, busy: false };

      async function load() {
        try { S.rows = await K.q(K.sb.from("dreamboard_growth_entries").select(COLS).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(1500)); }
        catch (e) { if (K.missingTable(e)) S.setup = true; else K.toast("Could not open your Growth Rings: " + (e.message || e), true); }
      }

      // Deterministic summary of the last 90 days (same rule as lib/growth-rings.ts).
      function summary() {
        var recent = S.rows.filter(function (r) { var d = daysBack(r.occurred_on); return d >= 0 && d < 90; });
        var counts = {};
        recent.forEach(function (r) { counts[r.practice] = (counts[r.practice] || 0) + 1; });
        var by = Object.keys(counts).map(function (p) { return { p: p, n: counts[p] }; }).sort(function (a, b) { return b.n - a.n || a.p.localeCompare(b.p); });
        return { total: recent.length, by: by };
      }
      function language(sm) {
        if (!sm.total) return "Your wall begins with one honest entry. There is no streak to protect and no missed day to repair.";
        var hi = sm.by.slice(0, 3).map(function (x) { return x.p.toLowerCase() + " " + x.n + (x.n === 1 ? " time" : " times"); });
        return "Over the last 90 days, you recorded " + sm.total + " act" + (sm.total === 1 ? "" : "s") + " of care" + (hi.length ? ": " + hi.join(", ") : "") + ". A quiet day does not erase what came before.";
      }

      // Rings: one ring per area of life (inner = spiritual). Each recorded act is a dot placed by its day
      // across the last 12 months (top = a year ago, going clockwise to today). Empty rings are just quiet.
      function ringsSvg() {
        var C = 220, R0 = 62, STEP = 21, html = "";
        var year = S.rows.filter(function (r) { var d = daysBack(r.occurred_on); return d >= 0 && d < 365; });
        CATS.forEach(function (c, i) {
          var r = R0 + i * STEP;
          html += '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" fill="none" stroke="' + COLOR[c] + '" stroke-opacity=".16" stroke-width="12"/>';
          year.filter(function (x) { return x.category === c; }).forEach(function (x) {
            var a = ((364 - daysBack(x.occurred_on)) / 365) * Math.PI * 2 - Math.PI / 2;
            html += '<circle cx="' + (C + r * Math.cos(a)).toFixed(1) + '" cy="' + (C + r * Math.sin(a)).toFixed(1) + '" r="4.2" fill="' + COLOR[c] + '"><title>' + K.esc(LABEL[c] + " · " + x.practice + " · " + K.fmtDay(x.occurred_on + "T00:00:00")) + "</title></circle>";
          });
        });
        // today marker
        html += '<line x1="' + C + '" y1="' + (C - R0 + 10) + '" x2="' + C + '" y2="' + (C - R0 - STEP * 6 - 12) + '" stroke="#f3d996" stroke-opacity=".5" stroke-dasharray="2 4"/>';
        html += '<text x="' + (C + 6) + '" y="' + (C - R0 - STEP * 6 - 14) + '" fill="#c9bfa8" font-size="11" font-family="Inter,system-ui">today · a year ago</text>';
        var sm = summary();
        html += '<text x="' + C + '" y="' + (C + 4) + '" text-anchor="middle" fill="#f4ead3" font-size="38" font-family="Cormorant Garamond,Georgia,serif">' + year.length + '</text>';
        html += '<text x="' + C + '" y="' + (C + 24) + '" text-anchor="middle" fill="#a99f8a" font-size="11" font-family="Inter,system-ui">acts in 12 months</text>';
        return '<svg viewBox="0 0 440 440" role="img" aria-label="Growth rings: ' + year.length + " recorded acts in the last 12 months, " + sm.total + ' in the last 90 days">' + html + "</svg>" +
          '<div class="gr-legend">' + CATS.map(function (c) { return "<span><i style=\"background:" + COLOR[c] + '"></i>' + LABEL[c] + "</span>"; }).join("") + "</div>";
      }

      function checkin() {
        var e = K.esc, today = {};
        S.rows.forEach(function (r) { if (r.occurred_on === S.day) today[r.category + ":" + r.practice] = 1; });
        var tabs = '<div class="rm-tabs" role="tablist">' + CATS.map(function (c) { return '<button class="btn small" role="tab" data-a="cat" data-v="' + c + '" aria-pressed="' + (S.cat === c) + '" aria-selected="' + (S.cat === c) + '">' + LABEL[c] + "</button>"; }).join("") + "</div>";
        var chips = '<div class="gr-chips">' + PRACTICES[S.cat].map(function (p) {
          var done = today[S.cat + ":" + p];
          return '<button class="gr-chip" style="--c:' + COLOR[S.cat] + '" data-a="pick" data-v="' + e(p) + '" aria-pressed="' + (S.chosen.indexOf(p) >= 0) + '">' + (done ? '<span class="ok" aria-label="Already on your wall for this day">✓</span>' : "") + e(p) + "</button>";
        }).join("") + "</div>";
        return K.panel("What belongs on your wall?", "Record what happened, in your own words. This is reflection, not a verdict.",
          '<div class="rm-form">' + tabs + chips +
          '<label class="rm-l" for="gr-own">Or name your own practice</label><input id="gr-own" class="bk-in" maxlength="80" placeholder="e.g. Walked with my son">' +
          '<label class="rm-l" for="gr-day">Day</label><input id="gr-day" type="date" class="bk-in" max="' + localDay() + '" value="' + S.day + '">' +
          '<label class="rm-l" for="gr-ref">Optional reflection</label><textarea id="gr-ref" class="bk-ta" style="min-height:96px" maxlength="2000" placeholder="What supported you? What would you like to carry forward?"></textarea>' +
          '<div class="rm-row"><button class="btn solid" data-a="add"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? "Saving…" : "Place on my wall") + "</button></div></div>");
      }

      function entryHtml(r) {
        var e = K.esc;
        if (S.editing === r.id) {
          return '<div class="gr-entry" style="--c:' + COLOR[r.category] + '" data-id="' + r.id + '"><div class="gr-edit">' +
            '<label class="rm-l" for="ge-d">Day</label><input id="ge-d" type="date" class="bk-in" max="' + localDay() + '" value="' + r.occurred_on + '">' +
            '<label class="rm-l" for="ge-c">Area</label><select id="ge-c" class="bk-in">' + CATS.map(function (c) { return '<option value="' + c + '"' + (c === r.category ? " selected" : "") + ">" + LABEL[c] + "</option>"; }).join("") + "</select>" +
            '<label class="rm-l" for="ge-p">Practice</label><input id="ge-p" class="bk-in" maxlength="80" value="' + e(r.practice) + '">' +
            '<label class="rm-l" for="ge-r">Reflection</label><textarea id="ge-r" class="bk-ta" style="min-height:90px" maxlength="2000">' + e(r.reflection || "") + "</textarea>" +
            '<div class="rm-row"><button class="btn small solid" data-a="save">Save</button><button class="btn small" data-a="cancel">Cancel</button></div></div></div>';
        }
        return '<div class="gr-entry" style="--c:' + COLOR[r.category] + '" data-id="' + r.id + '"><div><b>' + e(r.practice) + '</b> <span class="rm-meta">· ' + LABEL[r.category] + " · " + K.fmtDay(r.occurred_on + "T00:00:00") + "</span>" + (r.reflection ? "<p>" + e(r.reflection) + "</p>" : "") + '</div><div class="rm-row"><button class="btn small" data-a="edit">Edit</button><button class="btn small" data-a="del">Delete</button></div></div>';
      }

      function wall() {
        if (!S.rows.length) return K.empty("Your wall is ready for its first mark. Start with one true thing — not a perfect week.");
        var groups = [], cur = null;
        S.rows.forEach(function (r) {
          var m = dayDate(r.occurred_on).toLocaleDateString(undefined, { month: "long", year: "numeric" });
          if (!cur || cur.m !== m) { cur = { m: m, rows: [] }; groups.push(cur); }
          cur.rows.push(r);
        });
        return groups.map(function (g) { return '<div class="gr-month"><div class="mk"></div><div><h4>' + K.esc(g.m) + '</h4><div class="rm-meta" style="margin-bottom:6px">' + g.rows.length + " record" + (g.rows.length === 1 ? "" : "s") + " you chose to keep</div>" + g.rows.map(entryHtml).join("") + "</div></div>"; }).join("");
      }

      function paint() {
        var sm = summary();
        var head = K.scene("Growth Rings · private to your Passport", "How are you <em>growing</em>?",
          "A missed day is never a ruined journey. Your wall remembers the real acts of care, practice and renewed commitment you choose to place on it.",
          "art-orchard.jpg", '<a class="btn" href="https://thewow.online/academy" target="_blank" rel="noopener">WOW Academy · learning engines</a><a class="btn" href="#/today">Today\'s small step</a>');
        if (S.setup) { el.innerHTML = head + '<div class="bk-work one">' + K.setupNotice("Growth Rings", "supabase/dreamboard-growth-rings.sql") + "</div>"; return; }
        el.innerHTML = head + '<div class="bk-work one">' +
          '<div class="gr-top">' + checkin() + K.panel("Your rings", "Each dot is one act you recorded, placed by its day across the last 12 months. Drawn only from your rows — not a score.", '<div class="gr-rings">' + ringsSvg() + "</div>") + "</div>" +
          K.panel("90-day reflection", language(sm), sm.by.length ? '<div class="gr-sum">' + sm.by.slice(0, 8).map(function (x) { return "<article><b>" + x.n + "</b><span>" + K.esc(x.p) + "</span></article>"; }).join("") + "</div>" : '<p class="rm-meta">No records in the last 90 days — your next honest entry is enough to begin.</p>') +
          K.panel("Your progress wall", "Growth is measured in seasons. Edit or remove anything; it is yours.", wall()) +
          K.panel("Progression over perfection", "", '<div class="gr-principle"><p>Meaningful growth is rarely linear. Rest, interruptions, mistakes, illness, grief and changing seasons belong to a human life. Dream Board celebrates consistency, resilience, learning, recovery and renewed commitment; it never turns a missed day into a failure.</p><p class="rm-meta" style="margin-top:10px">Want to learn something new? The learning engines live in <a href="https://thewow.online/academy" target="_blank" rel="noopener">WOW Academy</a> — record what you practised here.</p></div>') +
          "</div>";
      }

      el.addEventListener("click", async function (ev) {
        var b = ev.target.closest("[data-a]"); if (!b || !el.contains(b)) return;
        var a = b.dataset.a, row = b.closest("[data-id]"), id = row && row.dataset.id;
        if (a === "cat") { S.cat = b.dataset.v; S.chosen = []; keepDraft(); paint(); restoreDraft(); return; }
        if (a === "pick") { var v = b.dataset.v, i = S.chosen.indexOf(v); if (i >= 0) S.chosen.splice(i, 1); else S.chosen.push(v); b.setAttribute("aria-pressed", String(i < 0)); return; }
        if (a === "add") {
          var own = el.querySelector("#gr-own").value.trim(), day = el.querySelector("#gr-day").value || localDay(), ref = el.querySelector("#gr-ref").value.trim();
          var list = S.chosen.slice(); if (own && list.indexOf(own) < 0) list.push(own.slice(0, 80));
          if (!list.length) { K.toast("Choose one or more practices, or name your own.", true); return; }
          if (day > localDay()) { K.toast("Growth Rings records what happened — choose today or an earlier day.", true); return; }
          S.busy = true; S.day = day; keepDraft(); paint(); restoreDraft();
          try {
            var rows = list.map(function (p) { return { owner_id: K.uid(), occurred_on: day, category: S.cat, practice: p, reflection: ref || null }; });
            var made = await K.q(K.sb.from("dreamboard_growth_entries").upsert(rows, { onConflict: "owner_id,occurred_on,category,practice", ignoreDuplicates: true }).select(COLS));
            var skipped = list.length - (made || []).length;
            S.chosen = []; draft = null;
            await load();
            K.toast((made || []).length ? "On your wall. Progression over perfection." + (skipped ? " (" + skipped + " was already there for that day.)" : "") : "Already on your wall for that day.");
          } catch (e) { K.toast("Could not save: " + (e.message || e), true); }
          S.busy = false; paint(); return;
        }
        if (a === "edit") { S.editing = id; paint(); var f = el.querySelector("#ge-p"); if (f) f.focus(); return; }
        if (a === "cancel") { S.editing = null; paint(); return; }
        if (a === "save") {
          var patch = { occurred_on: el.querySelector("#ge-d").value, category: el.querySelector("#ge-c").value, practice: el.querySelector("#ge-p").value.trim().slice(0, 80), reflection: el.querySelector("#ge-r").value.trim() || null };
          if (!patch.practice) { K.toast("Name the practice.", true); return; }
          if (!patch.occurred_on || patch.occurred_on > localDay()) { K.toast("Choose today or an earlier day.", true); return; }
          try { await K.update("dreamboard_growth_entries", id, patch); S.editing = null; await load(); paint(); K.toast("Updated."); }
          catch (e) { K.toast(e.code === "23505" ? "That practice is already on your wall for that day." : "Could not save: " + (e.message || e), true); }
          return;
        }
        if (a === "del") {
          if (!confirm("Remove this record from your wall? This cannot be undone.")) return;
          try { await K.remove("dreamboard_growth_entries", id); S.rows = S.rows.filter(function (r) { return r.id !== id; }); paint(); K.toast("Removed from your wall."); }
          catch (e) { K.toast("Could not remove: " + (e.message || e), true); }
        }
      });
      var draft = null;
      function keepDraft() { var o = el.querySelector("#gr-own"), r = el.querySelector("#gr-ref"), d = el.querySelector("#gr-day"); if (o) draft = { own: o.value, ref: r.value }; if (d && d.value) S.day = d.value; }
      function restoreDraft() { if (!draft) return; var o = el.querySelector("#gr-own"), r = el.querySelector("#gr-ref"); if (o) { o.value = draft.own; r.value = draft.ref; } }
      el.addEventListener("change", function (ev) { if (ev.target.id === "gr-day") { S.day = ev.target.value || localDay(); keepDraft(); paint(); restoreDraft(); } });

      el.innerHTML = K.scene("Growth Rings", "Opening your wall…", "", "art-orchard.jpg");
      await load();
      paint();
    }
  });
})();
