/* Dream Board OS · Passport & Settings (ported from ~/dreamboard/app/passport.tsx + supabase/dreamboard-appearance.sql, 2026-11-12).
 * Your Passport row in dreamboard_profiles (RLS: id = your user id): display name, wisdom mode, creator season.
 * Biography + disciplines appear only when supabase/dreamboard-passport-foundation.sql has added those columns.
 * Appearance — Dawn Paper or Midnight Garden, plus Reduce Motion — applies at once and is kept on this device in
 * localStorage (dreamboard-theme = "dawn" | "", dreamboard-reduce-motion = "1"); app.js applies it before first paint.
 * The profile's theme column only accepts the four dark palettes and has no reduce-motion column, so appearance is not
 * written to the profile (said plainly in the room). Tier is read-only from dreamboard_my_access(). */
(function () {
  "use strict";
  var K = window.DBKit;
  var SEASONS = [["planting", "Planting"], ["growing", "Growing"], ["building", "Building"], ["blooming", "Blooming"], ["harvest", "Harvest"], ["stewardship", "Stewardship"], ["new-seeds", "New seeds"]];

  K.css("settings",
    ".st-themes { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }" +
    ".st-theme { all: unset; box-sizing: border-box; cursor: pointer; display: grid; gap: 8px; padding: 12px; border-radius: 16px; border: 1px solid rgba(217,181,108,0.25); }" +
    ".st-theme:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }" +
    ".st-theme[aria-checked=true] { border-color: var(--gold-hi); box-shadow: 0 0 0 1px var(--gold-hi), 0 0 24px rgba(243,217,150,0.18); }" +
    ".st-swatch { height: 92px; border-radius: 10px; position: relative; overflow: hidden; }" +
    ".st-swatch.dawn { background: linear-gradient(160deg, #fbf6ea, #efe3c8); border: 1px solid #e0d1ac; }" +
    ".st-swatch.midnight { background: linear-gradient(160deg, #12382b, #040605); border: 1px solid rgba(217,181,108,0.3); }" +
    ".st-swatch i { position: absolute; left: 12px; right: 40%; height: 8px; border-radius: 4px; }" +
    ".st-swatch.dawn i:nth-child(1) { top: 16px; background: #8a6418; } .st-swatch.dawn i:nth-child(2) { top: 34px; right: 25%; background: #2c3a30; opacity: .5; } .st-swatch.dawn i:nth-child(3) { top: 54px; right: 55%; background: #1f5b43; }" +
    ".st-swatch.midnight i:nth-child(1) { top: 16px; background: #f3d996; } .st-swatch.midnight i:nth-child(2) { top: 34px; right: 25%; background: #f4ead3; opacity: .5; } .st-swatch.midnight i:nth-child(3) { top: 54px; right: 55%; background: #d9b56c; }" +
    ".st-theme b { font-family: var(--serif); font-weight: 500; font-size: 20px; color: var(--gold-hi); }" +
    ".st-theme span { font-size: 13px; color: var(--cream-dim); }" +
    ".st-switch { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 12px 0; border-top: 1px solid rgba(217,181,108,0.14); }" +
    ".st-switch:first-of-type { border-top: 0; }" +
    ".st-switch b { display: block; color: var(--cream); font-weight: 500; } .st-switch small { color: var(--muted); font-size: 12px; }" +
    ".st-switch input { width: 22px; height: 22px; accent-color: var(--gold); flex: 0 0 auto; }" +
    ".st-tier { display: inline-block; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; padding: 4px 14px; border-radius: 999px; border: 1px solid var(--gold-dim); color: var(--gold-hi); }" +
    ".st-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 14px; font-size: 14px; margin: 12px 0; }" +
    ".st-kv dt { color: var(--muted); } .st-kv dd { margin: 0; color: var(--cream); overflow-wrap: anywhere; }" +
    "@media (min-width: 821px) { .room .bk-work.st-work { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }"
  );

  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* storage blocked: applies for this visit only */ } }
  function applyAppearance(theme, reduce) {
    var root = document.documentElement;
    if (theme === "dawn") root.dataset.theme = "dawn"; else delete root.dataset.theme;
    if (reduce) root.dataset.motion = "reduce"; else delete root.dataset.motion;
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", theme === "dawn" ? "#f7f1e3" : "#040605");
  }

  var S = null;

  function render(el) {
    var u = K.ctx.user() || {}, access = K.ctx.access() || {};
    var p = S.profile || {};
    var identity = S.hasIdentity ?
      '<label class="rm-l" for="st-bio">Biography</label><textarea id="st-bio" class="bk-ta" style="min-height:110px;font-family:var(--sans);font-size:15px" maxlength="2000" placeholder="A few honest sentences about you and the work you make.">' + K.esc(p.bio || "") + "</textarea>" +
      '<label class="rm-l" for="st-disc">Disciplines</label><input id="st-disc" class="bk-in" maxlength="400" placeholder="writer, teacher, founder — separate with commas" value="' + K.esc((p.disciplines || []).join(", ")) + '">'
      : '<p class="note" style="margin:10px 0">Biography and disciplines open once your Passport database has the identity fields (supabase/dreamboard-passport-foundation.sql). Nothing is lost meanwhile.</p>';
    el.innerHTML = K.scene("Dream Board · Passport &amp; Settings", "Your one WOW Passport.",
      "The name people will know, how your board looks and moves, and the lens the Companion uses. Private to your Passport until you choose to share.",
      "art-sunrise.jpg", '<a class="btn" href="#/rooms">All rooms</a>') +
      '<div class="bk-work two st-work">' +
      K.panel("Passport", "Read-only here: your tier comes from your WOW Passport plan.",
        '<dl class="st-kv"><dt>Signed in as</dt><dd>' + K.esc(u.email || "") + "</dd><dt>Tier</dt><dd>" + (access.tier ? '<span class="st-tier">' + K.esc(access.tier) + "</span>" : '<span class="note">Not reported yet</span>') + "</dd>" +
        (access.treeLimit != null ? "<dt>Money Trees</dt><dd>" + K.esc(access.treeLimit) + "</dd>" : "") + "<dt>Passport since</dt><dd>" + K.esc(K.fmtDay(u.created_at)) + "</dd></dl>" +
        '<div class="rm-row"><button class="btn" type="button" data-st-act="signout">Sign out on this device</button><a class="btn small" href="https://thewow.online" target="_blank" rel="noopener">WOW World</a></div>') +
      K.panel("Appearance", "Applies instantly and is remembered on this device.",
        '<div class="st-themes" role="radiogroup" aria-label="Theme">' +
        '<button type="button" class="st-theme" role="radio" data-st-theme="dawn" aria-checked="' + (S.theme === "dawn") + '"><span class="st-swatch dawn"><i></i><i></i><i></i></span><b>Dawn Paper</b><span>Light cream, emerald and gold — for daylight and long reading.</span></button>' +
        '<button type="button" class="st-theme" role="radio" data-st-theme="" aria-checked="' + (S.theme !== "dawn") + '"><span class="st-swatch midnight"><i></i><i></i><i></i></span><b>Midnight Garden</b><span>The cinematic dark board — gold on emerald night.</span></button></div>' +
        '<label class="st-switch" style="margin-top:12px"><span><b>Reduce motion</b><small>Stops gold dust, slow push-ins, light leaks and card rises.</small></span><input type="checkbox" data-st="motion"' + (S.reduce ? " checked" : "") + "></label>" +
        '<p class="note" style="margin:6px 0 0">Kept on this device. Your Passport profile\'s theme field only holds the four dark palettes and has no motion setting yet, so these are not written to your profile.</p>') +
      "</div>" +
      '<div class="bk-work one">' +
      (S.profile === null ? K.setupNotice("Your Passport profile", "supabase/dreamboard-core-schema.sql") :
        K.panel("Creator identity", S.profile.__new ? "You have no Passport profile row yet — saving creates it." : "Saved privately to your Passport.",
          '<div class="rm-form"><label class="rm-l" for="st-name">Display name</label><input id="st-name" class="bk-in" maxlength="80" placeholder="The name people will know" value="' + K.esc(p.display_name || "") + '">' + identity +
          '<label class="rm-l" for="st-season">Creator season</label><select id="st-season" class="bk-in">' + SEASONS.map(function (s) { return '<option value="' + s[0] + '"' + ((p.creator_season || "planting") === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select>" +
          '<label class="st-switch"><span><b>Wisdom mode</b><small>The Companion frames reflection around purpose, long-term impact and the people affected. It never claims authority or decides for you.</small></span><input type="checkbox" id="st-wisdom"' + (p.wisdom_mode ? " checked" : "") + "></label>" +
          '<div class="rm-row"><button class="btn solid" type="button" data-st-act="save"' + (S.saving ? " disabled" : "") + ">" + (S.saving ? "Saving…" : "Save to my Passport") + '</button><span class="note">' + (p.updated_at && !p.__new ? "Last saved " + K.esc(K.fmtDay(p.updated_at)) : "") + "</span></div></div>")) +
      "</div>";
  }

  DBRoom.register("settings", {
    mount: async function (el) {
      S = { profile: null, hasIdentity: false, theme: lsGet("dreamboard-theme") === "dawn" ? "dawn" : "", reduce: lsGet("dreamboard-reduce-motion") === "1", saving: false };
      el.innerHTML = '<p class="loading">Opening your Passport…</p>';
      var uid = K.uid();
      var r = await K.sb.from("dreamboard_profiles").select("id,display_name,avatar_url,theme,wisdom_mode,creator_season,created_at,updated_at,bio,disciplines").eq("id", uid).maybeSingle();
      if (r.error && /bio|disciplines/.test(r.error.message || "")) {
        r = await K.sb.from("dreamboard_profiles").select("id,display_name,avatar_url,theme,wisdom_mode,creator_season,created_at,updated_at").eq("id", uid).maybeSingle();
      } else if (!r.error) S.hasIdentity = true;
      if (r.error) { if (K.missingTable(r.error)) S.profile = null; else throw r.error; }
      else S.profile = r.data || { __new: true, wisdom_mode: false, creator_season: "planting" };
      render(el);

      el.addEventListener("click", async function (e) {
        var b = e.target.closest("button"); if (!b || !el.contains(b)) return;
        if (b.dataset.stTheme !== undefined) {
          S.theme = b.dataset.stTheme === "dawn" ? "dawn" : "";
          lsSet("dreamboard-theme", S.theme); applyAppearance(S.theme, S.reduce); render(el);
          K.toast(S.theme === "dawn" ? "Dawn Paper is on." : "Midnight Garden is on.");
        } else if (b.dataset.stAct === "signout") {
          if (!window.confirm("Sign out of Dream Board on this device?")) return;
          await K.sb.auth.signOut(); location.hash = "#/home";
        } else if (b.dataset.stAct === "save") {
          var name = (el.querySelector("#st-name").value || "").trim();
          var patch = { display_name: name ? name.slice(0, 80) : null, creator_season: el.querySelector("#st-season").value, wisdom_mode: el.querySelector("#st-wisdom").checked, updated_at: new Date().toISOString() };
          if (S.hasIdentity) {
            patch.bio = (el.querySelector("#st-bio").value || "").slice(0, 2000);
            patch.disciplines = (el.querySelector("#st-disc").value || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12);
          }
          S.saving = true; render(el);
          try {
            var q = S.profile.__new ? K.sb.from("dreamboard_profiles").insert(Object.assign({ id: uid }, patch)) : K.sb.from("dreamboard_profiles").update(patch).eq("id", uid);
            var saved = await K.q(q.select().single());
            S.profile = saved; K.toast("Saved privately to your Passport.");
          } catch (err) { K.toast("Your Passport could not save: " + err.message, true); Object.assign(S.profile, patch); }
          S.saving = false; render(el);
        }
      });
      el.addEventListener("change", function (e) {
        if (e.target.dataset.st === "motion") { S.reduce = e.target.checked; lsSet("dreamboard-reduce-motion", S.reduce ? "1" : ""); applyAppearance(S.theme, S.reduce); K.toast(S.reduce ? "Motion reduced." : "Motion restored."); }
      });
    }
  });
})();
