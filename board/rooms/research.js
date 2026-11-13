/* Dream Board OS · Research Workspace (ported from ~/dreamboard/app/research.tsx + lib/research.ts and
 * app/corrections-equations.tsx, 2026-11-12). Three tabs: Questions & Claims, Correction Ledger, Equation Lab.
 * Canon rule (Founder, Spiritual Awakening research): HYPOTHESIS IS NOT VERIFIED SCIENCE.
 *   - 13 evidence classes keep scripture (theological), measurement (established), hypothesis and interpretation apart.
 *   - Nothing is "established" or "verified" without a real source (enforced in the database too).
 *   - Equations read as Hypothesis unless the author marks them empirically tested AND names a source.
 * Tables: dreamboard_research_questions, dreamboard_claims, dreamboard_corrections (append-only), dreamboard_equations
 * (supabase/dreamboard-os-grow.sql). Spaidbot may challenge a claim; it is a labelled suggestion and is only copied
 * into your objections when you click. */
(function () {
  "use strict";
  var K = window.DBKit;
  var SQL = "supabase/dreamboard-os-grow.sql";
  var SPAIDBOT = "https://mission.abovethehilldev.online/api/spaidbot";
  // ordered most-established → least so the UI never nudges toward overclaiming
  var CLASSES = [
    ["established", "Established Evidence", "Measured or replicated, with a named source.", "#7cc7a1"],
    ["emerging", "Emerging / Preliminary", "Early studies or measurements; not yet settled.", "#9fd3a6"],
    ["hypothesis", "Hypothesis", "A proposed explanation that has not been tested. Not verified science.", "#e8b95a"],
    ["interpretation", "Interpretation", "Your reading of a text, an event or data.", "#7fb2e6"],
    ["personal_observation", "Personal Observation", "Something you noticed or experienced yourself.", "#a0c8f0"],
    ["testimony", "Testimony", "What someone else reports they experienced.", "#b7b7e8"],
    ["historical", "Historical Claim", "A claim about what happened in the past.", "#d8c27a"],
    ["philosophical", "Philosophical Argument", "Reasoned argument rather than measurement.", "#cfa5e0"],
    ["theological", "Theological / Scripture", "What scripture or theology teaches — held by faith, not by measurement.", "#f3d996"],
    ["fictional", "Fictional / Creative Concept", "Part of a story, world or creative idea.", "#e6a3c2"],
    ["analogy", "Analogy / Metaphor", "A comparison that illuminates, not a mechanism.", "#6fd0d6"],
    ["needs_verification", "Needs Verification", "Not yet checked. Every new claim starts here.", "#a99f8a"],
    ["rejected", "Rejected / Superseded", "Shown to be wrong or replaced.", "#e59a86"]
  ];
  var CLAIM_TYPES = [["factual", "Factual"], ["interpretive", "Interpretive"], ["predictive", "Predictive"], ["normative", "Normative"], ["definitional", "Definitional"], ["creative", "Creative"]];
  var CONFIDENCE = [["unstated", "Unstated"], ["very_low", "Very low"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"]];
  var VERIFICATION = [["unverified", "Unverified"], ["in_review", "In review"], ["verified", "Verified (with source)"], ["rejected", "Rejected"]];
  var Q_STATES = [["open", "Open"], ["investigating", "Investigating"], ["answered", "Answered"], ["parked", "Parked"]];
  var VALIDATION = [["unvalidated", "Unvalidated"], ["dimensions_checked", "Dimensions checked"], ["reviewed", "Reviewed"], ["empirically_tested", "Empirically tested (needs a source)"], ["rejected", "Rejected"]];
  function cls(v) { for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i][0] === v) return CLASSES[i]; return [v, v, "", "#a99f8a"]; }
  function lab(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v; }
  function opts(list, sel) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? " selected" : "") + ">" + K.esc(o[1]) + "</option>"; }).join(""); }
  function eqVerified(q) { return q.validation_status === "empirically_tested" && String(q.verified_source || "").trim(); }

  K.css("research", [
    ".rs-canon{border:1px solid rgba(232,185,90,.55);background:linear-gradient(180deg,rgba(232,185,90,.12),rgba(232,185,90,.04));border-radius:16px;padding:14px 16px}",
    ".rs-canon b{display:block;font-family:var(--serif);font-weight:500;font-size:22px;letter-spacing:.06em;color:var(--gold-hi)}",
    ".rs-canon p{margin:4px 0 0;color:var(--cream-dim);font-size:14px}",
    ".rs-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:18px;align-items:start}",
    "@media (max-width:900px){.rs-grid{grid-template-columns:minmax(0,1fr)}}",
    ".rs-list{display:grid;gap:10px}",
    ".rs-badge{display:inline-block;font-size:11px;letter-spacing:.04em;padding:3px 10px;border-radius:999px;background:var(--c);color:#1b1407;font-weight:600;white-space:nowrap}",
    ".rs-claim{border-left:3px solid var(--c,var(--gold))}",
    ".rs-claim .stmt{all:unset;cursor:pointer;display:grid;gap:6px;width:100%}",
    ".rs-claim .stmt p{margin:0;font-family:var(--serif);font-size:18px;line-height:1.45;color:var(--cream);word-break:break-word}",
    ".rs-claim .stmt:focus-visible{outline:2px solid var(--gold-hi);outline-offset:4px;border-radius:6px}",
    ".rs-detail{display:grid;gap:8px;margin-top:12px}",
    ".rs-2{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}",
    ".rs-detail textarea.bk-ta{min-height:80px;font-size:16px}",
    ".rs-mix{display:flex;flex-wrap:wrap;gap:6px}",
    ".rs-proj{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}",
    ".rs-proj select{width:auto;max-width:100%}",
    ".rs-diff{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:start}",
    "@media (max-width:620px){.rs-diff{grid-template-columns:minmax(0,1fr)}.rs-diff i{display:none}}",
    ".rs-diff small{font-size:10px;letter-spacing:.16em;color:var(--gold)}",
    ".rs-diff p{margin:2px 0 0;font-family:var(--serif);font-size:17px;color:var(--cream);white-space:pre-wrap;word-break:break-word}",
    ".rs-diff .old p{color:var(--cream-dim);text-decoration:line-through;text-decoration-color:rgba(229,154,134,.6)}",
    ".rs-diff i{color:var(--gold);font-style:normal;padding-top:16px}",
    ".rs-classhelp{font-size:12px;color:var(--muted);margin:0}",
    ".rs-ai{margin-top:8px;padding:10px 12px;border-radius:12px;background:rgba(159,199,232,.06);white-space:pre-wrap;font-size:14px;color:var(--cream-dim)}",
    ".rs-q{display:grid;gap:8px}",
    ".rs-q p{margin:0;font-family:var(--serif);font-size:18px;color:var(--cream);word-break:break-word}"
  ].join("\n"));

  DBRoom.register("research", {
    mount: async function (el) {
      var S = { tab: "claims", proj: "all", projects: [], questions: [], claims: [], corrections: [], equations: [], setup: false,
        open: null, openEq: null, editQ: null, cf: "", ai: {}, aiBusy: null, newClass: "needs_verification" };

      async function load() {
        try {
          var r = await Promise.all([
            K.q(K.sb.from("dreamboard_research_questions").select("*").order("updated_at", { ascending: false }).limit(300)),
            K.q(K.sb.from("dreamboard_claims").select("*").order("updated_at", { ascending: false }).limit(500)),
            K.q(K.sb.from("dreamboard_corrections").select("*").order("created_at", { ascending: false }).limit(300)),
            K.q(K.sb.from("dreamboard_equations").select("*").order("updated_at", { ascending: false }).limit(300))
          ]);
          S.questions = r[0]; S.claims = r[1].map(function (c) { c.sources = c.sources || []; return c; }); S.corrections = r[2]; S.equations = r[3];
        } catch (e) { if (K.missingTable(e)) S.setup = true; else K.toast("Could not open your research: " + (e.message || e), true); }
        try { S.projects = await K.q(K.sb.from("dreamboard_projects").select("id,title").order("updated_at", { ascending: false }).limit(200)); } catch (e) { S.projects = []; }
      }
      function inProj(r) { return S.proj === "all" ? true : S.proj === "none" ? !r.project_id : r.project_id === S.proj; }
      function newProj() { return S.proj === "all" || S.proj === "none" ? null : S.proj; }
      function projName(id) { var p = S.projects.find(function (x) { return x.id === id; }); return p ? p.title : ""; }

      // ── Questions & Claims ──
      function qHtml(q) {
        var e = K.esc;
        if (S.editQ === q.id) return '<article class="rm-item rs-q" data-id="' + q.id + '"><label class="rm-l" for="rq-t">Question</label><textarea id="rq-t" class="bk-ta" style="min-height:70px;font-size:16px" maxlength="600">' + e(q.question) + '</textarea><label class="rm-l" for="rq-n">Notes</label><textarea id="rq-n" class="bk-ta" style="min-height:80px;font-size:16px">' + e(q.notes) + '</textarea><div class="rm-row"><button class="btn small solid" data-a="q-save">Save</button><button class="btn small" data-a="q-cancel">Cancel</button></div></article>';
        var n = S.claims.filter(function (c) { return c.question_id === q.id; }).length;
        return '<article class="rm-item rs-q" data-id="' + q.id + '"><p>' + e(q.question) + "</p>" + (q.notes ? '<div class="rm-meta" style="white-space:pre-wrap">' + e(q.notes) + "</div>" : "") +
          '<div class="rm-meta">' + (n ? n + " linked claim" + (n === 1 ? "" : "s") + " · " : "") + (q.project_id ? e(projName(q.project_id)) + " · " : "") + K.fmtDay(q.updated_at) + "</div>" +
          '<div class="rm-row"><select class="bk-in" style="width:auto" data-a="q-status" aria-label="Question status">' + opts(Q_STATES, q.status) + '</select><button class="btn small" data-a="q-edit">Edit</button><button class="btn small" data-a="q-del">Delete</button></div></article>';
      }
      function claimHtml(c) {
        var e = K.esc, k = cls(c.evidence_class), open = S.open === c.id;
        var head = '<button class="stmt" data-a="c-toggle" aria-expanded="' + open + '"><span><span class="rs-badge" style="--c:' + k[3] + '">' + e(k[1]) + "</span>" +
          (c.verification_status === "verified" ? ' <span class="rs-badge" style="--c:#9fd3a6">Verified · sourced</span>' : "") + "</span><p>" + e(c.statement) + '</p><span class="rm-meta">' + e(lab(CLAIM_TYPES, c.claim_type)) + " · confidence " + e(lab(CONFIDENCE, c.confidence).toLowerCase()) + " · " + c.sources.length + " source" + (c.sources.length === 1 ? "" : "s") + (c.project_id ? " · " + e(projName(c.project_id)) : "") + "</span></button>";
        if (!open) return '<article class="rm-item rs-claim" style="--c:' + k[3] + '" data-id="' + c.id + '">' + head + "</article>";
        var qopts = '<option value="">No question</option>' + S.questions.map(function (q) { return '<option value="' + q.id + '"' + (q.id === c.question_id ? " selected" : "") + ">" + e(q.question.slice(0, 80)) + "</option>"; }).join("");
        var ai = S.ai[c.id] ? '<div class="rm-ai rs-ai"><div class="rm-meta">Spaidbot · Suggestion · not your words — a challenge to consider, never copied in without your click</div>' + e(S.ai[c.id]) + '<div class="rm-row" style="margin-top:8px"><button class="btn small" data-a="c-ai-use">Copy into my objections field</button><button class="btn small" data-a="c-ai-x">Dismiss</button></div></div>' : "";
        return '<article class="rm-item rs-claim" style="--c:' + k[3] + '" data-id="' + c.id + '">' + head + '<div class="rs-detail">' +
          '<label class="rm-l" for="cd-st">Exact wording</label><textarea id="cd-st" class="bk-ta" maxlength="2000">' + e(c.statement) + "</textarea>" +
          '<div class="rs-2"><label class="rm-l">Evidence class<select id="cd-ec" class="bk-in">' + opts(CLASSES, c.evidence_class) + '</select></label><label class="rm-l">Claim type<select id="cd-ct" class="bk-in">' + opts(CLAIM_TYPES, c.claim_type) + '</select></label><label class="rm-l">Confidence<select id="cd-cf" class="bk-in">' + opts(CONFIDENCE, c.confidence) + '</select></label><label class="rm-l">Verification<select id="cd-vs" class="bk-in">' + opts(VERIFICATION, c.verification_status) + "</select></label></div>" +
          '<p class="rs-classhelp" id="cd-help">' + e(k[2]) + "</p>" +
          '<label class="rm-l">Research question<select id="cd-q" class="bk-in">' + qopts + "</select></label>" +
          '<label class="rm-l" for="cd-src">Sources (one per line — real sources only; Dream Board never invents citations)</label><textarea id="cd-src" class="bk-ta">' + e(c.sources.join("\n")) + "</textarea>" +
          '<label class="rm-l" for="cd-sup">Supporting evidence</label><textarea id="cd-sup" class="bk-ta">' + e(c.supporting_evidence) + "</textarea>" +
          '<label class="rm-l" for="cd-obj">Objections</label><textarea id="cd-obj" class="bk-ta">' + e(c.objections) + "</textarea>" +
          '<label class="rm-l" for="cd-alt">Alternative explanations</label><textarea id="cd-alt" class="bk-ta">' + e(c.alternatives) + "</textarea>" +
          '<label class="rm-l" for="cd-un">Your notes</label><textarea id="cd-un" class="bk-ta">' + e(c.user_notes) + "</textarea>" +
          '<div class="rm-row"><button class="btn small solid" data-a="c-save">Save claim</button><button class="btn small" data-a="c-ai"' + (S.aiBusy === c.id ? " disabled" : "") + ">" + (S.aiBusy === c.id ? "Asking Spaidbot…" : "Ask Spaidbot to challenge it") + '</button><button class="btn small" data-a="c-del">Delete</button></div>' + ai + "</div></article>";
      }
      function claimsTab() {
        var qs = S.questions.filter(inProj), cs = S.claims.filter(inProj);
        var mix = {}; cs.forEach(function (c) { mix[c.evidence_class] = (mix[c.evidence_class] || 0) + 1; });
        var shown = cs.filter(function (c) { return !S.cf || c.evidence_class === S.cf; });
        var qPanel = K.panel("Research questions", "Good research starts with the honest question.",
          '<div class="rm-form"><label class="rm-l" for="rq-new">New question</label><textarea id="rq-new" class="bk-ta" style="min-height:80px;font-size:16px" maxlength="600" placeholder="What do you need to find out?"></textarea><div class="rm-row"><button class="btn solid" data-a="q-add">Add question</button></div></div>' +
          '<div class="rs-list" style="margin-top:12px">' + (qs.length ? qs.map(qHtml).join("") : '<p class="rm-meta">No questions yet.</p>') + "</div>");
        var help = cls(S.newClass)[2];
        var cPanel = K.panel("Claims · " + cs.length, "Every claim carries an explicit evidence class. Dream Board never upgrades a hypothesis into established fact on its own.",
          '<div class="rm-form"><label class="rm-l" for="rc-new">New claim (exact wording)</label><textarea id="rc-new" class="bk-ta" style="min-height:90px;font-size:16px" maxlength="2000" placeholder="State the claim precisely, in your own words."></textarea>' +
          '<label class="rm-l" for="rc-class">Evidence class</label><select id="rc-class" class="bk-in">' + opts(CLASSES.filter(function (k) { return k[0] !== "established"; }), S.newClass) + "</select>" +
          '<p class="rs-classhelp" id="rc-help">' + K.esc(help) + ' "Established" opens once the claim has a source.</p>' +
          '<div class="rm-row"><button class="btn solid" data-a="c-add">Record claim</button></div></div>' +
          (cs.length ? '<div class="rs-mix" style="margin:14px 0 6px"><button class="bk-chip" data-a="cf" data-v="" aria-pressed="' + !S.cf + '">All · ' + cs.length + "</button>" + CLASSES.filter(function (k) { return mix[k[0]]; }).map(function (k) { return '<button class="bk-chip" style="--c:' + k[3] + '" data-a="cf" data-v="' + k[0] + '" aria-pressed="' + (S.cf === k[0]) + '"><i></i>' + K.esc(k[1]) + " · " + mix[k[0]] + "</button>"; }).join("") + '</div><p class="rm-meta" style="margin:0 0 10px">This mix is a count of how you classified your own claims. A research project full of hypotheses is honest, not incomplete.</p>' : "") +
          '<div class="rs-list">' + (shown.length ? shown.map(claimHtml).join("") : '<p class="rm-meta">No claims yet. Record the first one and set its evidence class honestly.</p>') + "</div>");
        return '<div class="rs-grid">' + qPanel + cPanel + "</div>";
      }

      // ── Correction Ledger ──
      function correctionsTab() {
        var e = K.esc, list = S.corrections.filter(inProj);
        var form = K.panel("File a correction", "The ledger is permanent and append-only. Corrections are never overwritten, so the history of your thinking stays intact.",
          '<div class="rm-form"><label class="rm-l" for="cr-o">Original statement</label><textarea id="cr-o" class="bk-ta" style="min-height:80px;font-size:16px" maxlength="2000" placeholder="Exactly what was originally stated."></textarea>' +
          '<div class="rs-2"><label class="rm-l">What was wrong<textarea id="cr-i" class="bk-ta" style="min-height:70px;font-size:15px"></textarea></label><label class="rm-l">Revised statement<textarea id="cr-r" class="bk-ta" style="min-height:70px;font-size:15px"></textarea></label><label class="rm-l">Reason<textarea id="cr-re" class="bk-ta" style="min-height:70px;font-size:15px"></textarea></label><label class="rm-l">Evidence<textarea id="cr-e" class="bk-ta" style="min-height:70px;font-size:15px"></textarea></label></div>' +
          '<label class="rm-l" for="cr-l">Affected locations</label><input id="cr-l" class="bk-in" placeholder="Where the original appeared (chapters, claims, notes)">' +
          '<div class="rm-row"><button class="btn solid" data-a="cr-add">Record correction</button></div></div>');
        var items = list.length ? list.map(function (c) {
          return '<article class="rm-item" data-id="' + c.id + '"><div class="rs-diff"><div class="old"><small>ORIGINAL</small><p>' + e(c.original_statement) + '</p></div><i>→</i><div><small>REVISED</small><p>' + e(c.revised_statement || "(withdrawn)") + "</p></div></div>" +
            (c.issue ? '<p class="rm-meta" style="margin:8px 0 0"><b>What was wrong:</b> ' + e(c.issue) + "</p>" : "") + (c.reason ? '<p class="rm-meta" style="margin:4px 0 0"><b>Reason:</b> ' + e(c.reason) + "</p>" : "") + (c.evidence ? '<p class="rm-meta" style="margin:4px 0 0"><b>Evidence:</b> ' + e(c.evidence) + "</p>" : "") + (c.affected_locations ? '<p class="rm-meta" style="margin:4px 0 0"><b>Affected:</b> ' + e(c.affected_locations) + "</p>" : "") +
            '<div class="rm-row" style="margin-top:8px"><span class="rm-meta">' + K.fmtDay(c.created_at) + '</span><span class="spacer" style="flex:1"></span><label class="rm-l">Visibility <select class="bk-in" style="width:auto" data-a="cr-vis"><option value="private"' + (c.visibility === "private" ? " selected" : "") + '>Private</option><option value="published"' + (c.visibility === "published" ? " selected" : "") + ">In published research</option></select></label></div></article>";
        }).join("") : K.empty("No corrections yet. When your thinking changes, record it here — that record is a strength.");
        return '<div class="rs-grid">' + form + '<div class="rs-list">' + items + "</div></div>";
      }

      // ── Equation Lab ──
      function eqBadge(q) {
        if (q.validation_status === "rejected") return '<span class="rs-badge" style="--c:#e59a86">Rejected</span>';
        if (eqVerified(q)) return '<span class="rs-badge" style="--c:#7cc7a1">Verified · sourced</span>';
        return '<span class="rs-badge" style="--c:#e8b95a">Hypothesis</span>' + (q.validation_status !== "unvalidated" ? ' <span class="rm-meta">' + K.esc(lab(VALIDATION, q.validation_status)) + "</span>" : "");
      }
      function equationsTab() {
        var e = K.esc, list = S.equations.filter(inProj);
        var form = K.panel("New equation", "Calculable is not validated. An equation is labelled Hypothesis until you mark it empirically tested and name the source of that test.",
          '<div class="rm-form"><label class="rm-l" for="eq-n">Name</label><input id="eq-n" class="bk-in" maxlength="200" placeholder="What this equation represents"><label class="rm-l" for="eq-x">Expression</label><input id="eq-x" class="bk-in" placeholder="e.g. f = v / λ"><div class="rm-row"><button class="btn solid" data-a="eq-add">Add equation</button></div></div>');
        var items = list.length ? list.map(function (q) {
          var head = '<button class="stmt" data-a="eq-toggle" aria-expanded="' + (S.openEq === q.id) + '"><span>' + eqBadge(q) + "</span><p><b>" + e(q.name) + "</b>" + (q.expression ? " — <code>" + e(q.expression) + "</code>" : "") + "</p></button>";
          if (S.openEq !== q.id) return '<article class="rm-item rs-claim" style="--c:' + (eqVerified(q) ? "#7cc7a1" : "#e8b95a") + '" data-id="' + q.id + '">' + head + "</article>";
          return '<article class="rm-item rs-claim" style="--c:' + (eqVerified(q) ? "#7cc7a1" : "#e8b95a") + '" data-id="' + q.id + '">' + head + '<div class="rs-detail">' +
            '<label class="rm-l" for="ed-n">Name</label><input id="ed-n" class="bk-in" maxlength="200" value="' + e(q.name) + '">' +
            '<label class="rm-l" for="ed-x">Expression</label><input id="ed-x" class="bk-in" value="' + e(q.expression) + '">' +
            '<div class="rs-2"><label class="rm-l">Variables<textarea id="ed-v" class="bk-ta" placeholder="Each symbol and what it means">' + e(q.variables) + '</textarea></label><label class="rm-l">Units &amp; dimensions<textarea id="ed-u" class="bk-ta">' + e(q.units) + '</textarea></label><label class="rm-l">Assumptions<textarea id="ed-a" class="bk-ta">' + e(q.assumptions) + '</textarea></label><label class="rm-l">Limitations<textarea id="ed-l" class="bk-ta">' + e(q.limitations) + "</textarea></label></div>" +
            '<label class="rm-l">Validation status<select id="ed-s" class="bk-in">' + opts(VALIDATION, q.validation_status) + "</select></label>" +
            '<label class="rm-l" for="ed-src">Source of verification (the study, measurement or replication — required for "empirically tested")</label><textarea id="ed-src" class="bk-ta">' + e(q.verified_source || "") + "</textarea>" +
            '<label class="rm-l" for="ed-no">Notes</label><textarea id="ed-no" class="bk-ta">' + e(q.notes) + "</textarea>" +
            '<div class="rm-row"><button class="btn small solid" data-a="eq-save">Save equation</button><button class="btn small" data-a="eq-del">Delete</button></div></div></article>';
        }).join("") : K.empty("No equations yet. Add one, then record its variables, units and assumptions honestly.");
        return '<div class="rs-grid">' + form + '<div class="rs-list">' + items + "</div></div>";
      }

      function paint() {
        var head = K.scene("Research Workspace · private by default", "Separate what is known from what is not.",
          "Questions, claims with an explicit evidence class, a permanent Correction Ledger and an Equation Lab — so scripture, measurement, hypothesis and interpretation never blur together.",
          "art-hero-hill.jpg", '<a class="btn" href="#/r/knowledge">Knowledge Vault</a><a class="btn" href="#/book">Book Studio</a>');
        if (S.setup) { el.innerHTML = head + '<div class="bk-work one">' + K.setupNotice("Research Workspace", SQL) + "</div>"; return; }
        var tabs = '<div class="rm-tabs" role="tablist">' + [["claims", "Questions & Claims"], ["corrections", "Correction Ledger · " + S.corrections.length], ["equations", "Equation Lab · " + S.equations.length]].map(function (t) { return '<button class="btn small" role="tab" data-a="tab" data-v="' + t[0] + '" aria-pressed="' + (S.tab === t[0]) + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>";
        var proj = '<div class="rs-proj"><label class="rm-l" for="rs-p">Project</label><select id="rs-p" class="bk-in" data-a="proj"><option value="all"' + (S.proj === "all" ? " selected" : "") + '>All research</option><option value="none"' + (S.proj === "none" ? " selected" : "") + ">Not in a project</option>" + S.projects.map(function (p) { return '<option value="' + p.id + '"' + (S.proj === p.id ? " selected" : "") + ">" + K.esc(p.title) + "</option>"; }).join("") + '</select><span class="rm-meta">New items go into ' + (newProj() ? "this project" : "no project") + ".</span></div>";
        var canon = '<div class="rs-canon" role="note"><b>HYPOTHESIS IS NOT VERIFIED SCIENCE</b><p>Frequency, energy and spiritual-awakening ideas can be held with conviction and still be labelled honestly: scripture is <em>Theological</em>, a test result is <em>Established</em> only with a source, a proposed mechanism is a <em>Hypothesis</em>, and your reading of either is an <em>Interpretation</em>.</p></div>';
        el.innerHTML = head + '<div class="bk-work one">' + canon + "<div>" + tabs + proj + (S.tab === "claims" ? claimsTab() : S.tab === "corrections" ? correctionsTab() : equationsTab()) + "</div></div>";
      }
      function val(id) { var f = el.querySelector("#" + id); return f ? f.value : ""; }
      function friendly(e) {
        var m = String(e && (e.message || e) || "");
        if (/established_needs_source|verified_needs_source/.test(m)) return "Add at least one real source before marking a claim Established or Verified. Hypothesis is not verified science.";
        if (/tested_needs_source/.test(m)) return "Name the source of the empirical test before marking an equation empirically tested.";
        return m;
      }

      el.addEventListener("change", async function (ev) {
        var t = ev.target;
        if (t.id === "rs-p") { S.proj = t.value; paint(); return; }
        if (t.id === "rc-class") { S.newClass = t.value; var h = el.querySelector("#rc-help"); if (h) h.textContent = cls(t.value)[2] + ' "Established" opens once the claim has a source.'; return; }
        if (t.id === "cd-ec") { var h2 = el.querySelector("#cd-help"); if (h2) h2.textContent = cls(t.value)[2]; return; }
        var row = t.closest("[data-id]"); if (!row) return;
        var id = row.dataset.id;
        if (t.dataset.a === "q-status") {
          try { var u = await K.update("dreamboard_research_questions", id, { status: t.value, updated_at: new Date().toISOString() }); S.questions = S.questions.map(function (q) { return q.id === id ? u : q; }); K.toast("Status saved."); }
          catch (e) { K.toast("Could not save: " + friendly(e), true); }
        }
        if (t.dataset.a === "cr-vis") {
          try { await K.q(K.sb.from("dreamboard_corrections").update({ visibility: t.value }).eq("id", id)); S.corrections.forEach(function (c) { if (c.id === id) c.visibility = t.value; }); K.toast(t.value === "published" ? "Included in published research." : "Kept private."); }
          catch (e) { K.toast("Could not save: " + friendly(e), true); }
        }
      });

      el.addEventListener("click", async function (ev) {
        var b = ev.target.closest("[data-a]"); if (!b || !el.contains(b) || b.tagName === "SELECT") return;
        var a = b.dataset.a, row = b.closest("[data-id]"), id = row && row.dataset.id, now = new Date().toISOString();
        try {
          if (a === "tab") { S.tab = b.dataset.v; paint(); return; }
          if (a === "cf") { S.cf = b.dataset.v; paint(); return; }
          if (a === "q-add") {
            var qt = val("rq-new").trim(); if (!qt) return K.toast("Write the question first.", true);
            var q = await K.insert("dreamboard_research_questions", { question: qt.slice(0, 600), project_id: newProj() }); S.questions.unshift(q); paint(); K.toast("Question added."); return;
          }
          if (a === "q-edit") { S.editQ = id; paint(); return; }
          if (a === "q-cancel") { S.editQ = null; paint(); return; }
          if (a === "q-save") {
            var qt2 = val("rq-t").trim(); if (!qt2) return K.toast("A question cannot be empty.", true);
            var uq = await K.update("dreamboard_research_questions", id, { question: qt2.slice(0, 600), notes: val("rq-n"), updated_at: now });
            S.questions = S.questions.map(function (x) { return x.id === id ? uq : x; }); S.editQ = null; paint(); K.toast("Saved."); return;
          }
          if (a === "q-del") {
            if (!confirm("Delete this research question? Claims linked to it are kept.")) return;
            await K.remove("dreamboard_research_questions", id); S.questions = S.questions.filter(function (x) { return x.id !== id; });
            S.claims.forEach(function (c) { if (c.question_id === id) c.question_id = null; }); paint(); K.toast("Question deleted."); return;
          }
          if (a === "c-add") {
            var st = val("rc-new").trim(); if (!st) return K.toast("State the claim first.", true);
            var c = await K.insert("dreamboard_claims", { statement: st.slice(0, 2000), evidence_class: val("rc-class") || "needs_verification", project_id: newProj() });
            c.sources = c.sources || []; S.claims.unshift(c); S.open = c.id; paint(); K.toast("Claim recorded. Its evidence class is exactly what you set — nothing is upgraded automatically."); return;
          }
          if (a === "c-toggle") { S.open = S.open === id ? null : id; paint(); return; }
          if (a === "c-save") {
            var stmt = val("cd-st").trim(); if (!stmt) return K.toast("A claim needs its wording.", true);
            var patch = { statement: stmt.slice(0, 2000), evidence_class: val("cd-ec"), claim_type: val("cd-ct"), confidence: val("cd-cf"), verification_status: val("cd-vs"), question_id: val("cd-q") || null,
              sources: val("cd-src").split("\n").map(function (s) { return s.trim(); }).filter(Boolean), supporting_evidence: val("cd-sup"), objections: val("cd-obj"), alternatives: val("cd-alt"), user_notes: val("cd-un"), updated_at: now };
            if ((patch.evidence_class === "established" || patch.verification_status === "verified") && !patch.sources.length) return K.toast("Add at least one real source before marking a claim Established or Verified. Hypothesis is not verified science.", true);
            var uc = await K.update("dreamboard_claims", id, patch); uc.sources = uc.sources || [];
            S.claims = S.claims.map(function (x) { return x.id === id ? uc : x; }); paint(); K.toast("Claim saved."); return;
          }
          if (a === "c-del") {
            if (!confirm("Delete this claim? This cannot be undone.")) return;
            await K.remove("dreamboard_claims", id); S.claims = S.claims.filter(function (x) { return x.id !== id; }); S.open = null; paint(); K.toast("Claim deleted."); return;
          }
          if (a === "c-ai") {
            var cl = S.claims.find(function (x) { return x.id === id; }); if (!cl) return;
            S.aiBusy = id; paint();
            var prompt = "You are helping a researcher keep claims honest. Do not rewrite their claim and do not invent citations. " +
              "List 3-5 short, specific objections or alternative explanations they should consider, and say what kind of evidence would test the claim. " +
              "Keep scripture, measurement, hypothesis and interpretation clearly apart.\n\nClaim (" + cls(cl.evidence_class)[1] + "): " + cl.statement;
            try {
              var res = await fetch(SPAIDBOT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: prompt.slice(0, 4000) }], product: "ath" }) });
              var body = await res.json().catch(function () { return {}; });
              if (res.status === 503 || body.retry) throw new Error("Spaidbot is busy right now — try again in a moment.");
              if (!res.ok || !body.reply) throw new Error("Spaidbot answered " + res.status + ".");
              S.ai[id] = String(body.reply);
            } catch (e) { K.toast(e.message || String(e), true); }
            S.aiBusy = null; paint(); return;
          }
          if (a === "c-ai-use") { var f = el.querySelector("#cd-obj"); if (f) { f.value = (f.value ? f.value.trimEnd() + "\n\n" : "") + "[Spaidbot suggestion · not your words]\n" + S.ai[id]; f.focus(); } K.toast("Copied into the objections field. Edit it, then Save claim to keep it."); return; }
          if (a === "c-ai-x") { delete S.ai[id]; paint(); return; }
          if (a === "cr-add") {
            var o = val("cr-o").trim(); if (!o) return K.toast("Write the original statement first.", true);
            var label = (K.ctx.state && K.ctx.state.user && K.ctx.state.user.email) || "";
            var cr = await K.insert("dreamboard_corrections", { original_statement: o.slice(0, 2000), issue: val("cr-i").trim(), revised_statement: val("cr-r").trim(), reason: val("cr-re").trim(), evidence: val("cr-e").trim(), affected_locations: val("cr-l").trim(), author_label: label, project_id: newProj() });
            S.corrections.unshift(cr); paint(); K.toast("Correction recorded permanently. The original wording is preserved in the ledger."); return;
          }
          if (a === "eq-add") {
            var n = val("eq-n").trim(); if (!n) return K.toast("Name the equation first.", true);
            var eq = await K.insert("dreamboard_equations", { name: n.slice(0, 200), expression: val("eq-x").trim(), project_id: newProj() });
            S.equations.unshift(eq); S.openEq = eq.id; paint(); K.toast("Equation recorded as a hypothesis. Being calculable is not the same as being validated."); return;
          }
          if (a === "eq-toggle") { S.openEq = S.openEq === id ? null : id; paint(); return; }
          if (a === "eq-save") {
            var nm = val("ed-n").trim(); if (!nm) return K.toast("An equation needs a name.", true);
            var ep = { name: nm.slice(0, 200), expression: val("ed-x"), variables: val("ed-v"), units: val("ed-u"), assumptions: val("ed-a"), limitations: val("ed-l"), validation_status: val("ed-s"), verified_source: val("ed-src").trim(), notes: val("ed-no"), updated_at: now };
            if (ep.validation_status === "empirically_tested" && !ep.verified_source) return K.toast("Name the source of the empirical test before marking it empirically tested.", true);
            var ue = await K.update("dreamboard_equations", id, ep); S.equations = S.equations.map(function (x) { return x.id === id ? ue : x; }); paint(); K.toast(eqVerified(ue) ? "Saved as verified, with its source." : "Saved. It reads as a hypothesis until it is tested and sourced."); return;
          }
          if (a === "eq-del") {
            if (!confirm("Delete this equation? This cannot be undone.")) return;
            await K.remove("dreamboard_equations", id); S.equations = S.equations.filter(function (x) { return x.id !== id; }); S.openEq = null; paint(); K.toast("Equation deleted."); return;
          }
        } catch (e) { S.aiBusy = null; K.toast("Could not save: " + friendly(e), true); }
      });

      el.innerHTML = K.scene("Research Workspace", "Opening your research…", "", "art-hero-hill.jpg");
      await load();
      paint();
    }
  });
})();
