/* Dream Board · Golden inventions (Above the Hill Developments, 2026-11-12)
 * Static client app. WOW Passport (Supabase auth) sign-in, real rows only,
 * every table owner-only under RLS. Tier comes from dreamboard_my_access().
 * Frameworks credited to Myron Golden, summarized in ATH's own words. */
(function () {
  "use strict";
  var cfg = window.DB_CONFIG || {};
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "dreamboard-passport" }
  });

  try { var th = localStorage.getItem("dreamboard-theme"); if (th) document.documentElement.dataset.theme = th; if (localStorage.getItem("dreamboard-reduce-motion") === "1") document.documentElement.dataset.motion = "reduce"; } catch (e) { /* storage blocked */ }
  var state = { user: null, access: null, trees: [], items: [], cards: [], steps: [], plans: [], weeks: [], beliefs: [], loaded: false };
  var $app = document.getElementById("app");
  var STEPS = [
    ["quantify", "Quantify", "Inspect and measure. Write the baseline number down. A goal with no number is only a wish."],
    ["qualify", "Qualify", "Improve the inputs. Manage systems, not motion, and raise the standard."],
    ["simplify", "Simplify", "Find the 20% of activity that makes 80% of the result. Keep one small weekly habit."],
    ["amplify", "Amplify", "Make noise about the solution that is already proven."],
    ["magnify", "Magnify", "Grow the reach with content and/or ads, steadily, in the right rooms. Relationship before pitch."],
    ["multiply", "Multiply", "Momentum: more volume, shorter gaps between offers, referral loops, delegation and automation."]
  ];
  var LANES = [
    ["fruit", "Fruit", "provision for others — it carries its own seed", ["", "void", "virtue", "vision"]],
    ["shoot", "Shoot", "connection, conversion and consensus content", ["", "connection", "conversion", "consensus"]],
    ["roots", "Roots", "the unseen work: study and obsession over other people's problems", [""]],
    ["taproot", "Taproot", "what the market wants", [""]]
  ];
  var KIND_LABEL = { connection: "Connection", conversion: "Conversion", consensus: "Consensus (proof)", "void": "Past void", virtue: "Present virtue", vision: "Future vision" };

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function localDay(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function weekStart(d) { d = new Date(d || new Date()); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return localDay(d); }
  function fmtDate(s) { var d = new Date(s); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function num(n) { var x = Number(n); return Number.isInteger(x) ? x.toLocaleString() : x.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
  var toastTimer;
  function toast(msg, bad) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false; t.style.borderColor = bad ? "rgba(229,154,134,0.7)" : "";
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
  }
  function friendly(err) {
    var m = (err && (err.message || err.error_description)) || String(err);
    if (/DREAMBOARD_TREE_LIMIT/.test(m)) return m.replace(/^.*DREAMBOARD_TREE_LIMIT:\s*/, "");
    return m;
  }
  async function run(q) { var r = await q; if (r.error) throw r.error; return r.data; }
  function route() { var h = location.hash.replace(/^#\/?/, ""); var p = h.split("/"); return { name: p[0] || "home", id: p[1] || null }; }
  function treeStage(treeId) {
    var its = state.items.filter(function (i) { return i.tree_id === treeId && i.done_at; });
    var has = function (l) { return its.some(function (i) { return i.lane === l; }); };
    if (has("fruit")) return "fruiting";
    if (has("shoot")) return "young";
    if (has("roots") || has("taproot")) return "sprout";
    return "seed";
  }
  var STAGE_LABEL = { seed: "Seed", sprout: "Sprout", young: "Young tree", fruiting: "Bearing fruit" };

  // Gold line-art tree, drawn from the real stage (no invented growth).
  function treeSVG(stage, size) {
    size = size || 140;
    var g = "url(#gg)";
    var defs = '<defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0bf"/><stop offset="1" stop-color="#c8963f"/></linearGradient><radialGradient id="fr"><stop offset="0" stop-color="#fff4cf"/><stop offset="1" stop-color="#d9a441"/></radialGradient></defs>';
    var ground = '<path d="M10 150 Q80 140 150 150" stroke="#d9b56c" stroke-opacity=".5" fill="none"/>';
    var body = "";
    if (stage === "seed") {
      body = '<ellipse cx="80" cy="146" rx="7" ry="9" fill="url(#fr)"/><path d="M80 155 q-6 8 -14 10 M80 155 q5 9 12 11" stroke="' + g + '" stroke-width="1.5" fill="none"/>';
    } else if (stage === "sprout") {
      body = '<path d="M80 150 C80 130 80 118 80 104" stroke="#8fd08a" stroke-width="3" fill="none"/><path d="M80 118 C66 110 60 100 62 92 C74 96 80 106 80 118Z M80 110 C94 100 102 96 106 88 C96 86 84 96 80 110Z" fill="#7cc77a"/><path d="M80 152 q-10 10 -24 12 M80 152 q9 10 22 12" stroke="' + g + '" stroke-width="1.5" fill="none"/>';
    } else {
      var big = stage === "fruiting";
      body = '<path d="M76 150 C78 120 74 100 80 80 C84 100 82 120 84 150Z" fill="' + g + '"/>' +
        '<path d="M80 96 C66 84 50 80 38 66 M80 90 C94 78 110 74 122 60 M80 84 C76 66 70 52 66 38 M80 84 C86 64 92 50 98 36 M60 76 C50 62 46 50 46 40 M100 72 C110 60 116 50 118 40" stroke="' + g + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        '<g fill="none" stroke="' + g + '" stroke-width="1.2" opacity=".85"><circle cx="80" cy="56" r="' + (big ? 44 : 36) + '"/><circle cx="52" cy="62" r="' + (big ? 26 : 20) + '"/><circle cx="108" cy="60" r="' + (big ? 26 : 20) + '"/></g>' +
        '<path d="M80 152 q-14 10 -34 12 M80 152 q13 10 32 12 M80 152 q0 10 -2 14" stroke="' + g + '" stroke-width="1.5" fill="none"/>' +
        (big ? '<g fill="url(#fr)"><circle cx="56" cy="58" r="5"/><circle cx="104" cy="52" r="5"/><circle cx="80" cy="34" r="5"/><circle cx="66" cy="80" r="4.5"/><circle cx="98" cy="78" r="4.5"/></g>' : "");
    }
    return '<svg viewBox="0 0 160 170" width="' + size + '" height="' + Math.round(size * 1.06) + '" aria-hidden="true">' + defs + ground + body + "</svg>";
  }

  // ---------- data ----------
  async function loadAll() {
    var uid = state.user.id;
    var res = await Promise.all([
      sb.rpc("dreamboard_my_access"),
      sb.from("dreamboard_money_trees").select("*").order("created_at"),
      sb.from("dreamboard_tree_items").select("*").order("created_at"),
      sb.from("dreamboard_board_cards").select("*").order("created_at"),
      sb.from("dreamboard_daily_steps").select("*").order("day", { ascending: false }).limit(60),
      sb.from("dreamboard_quantum_plans").select("*").order("created_at"),
      sb.from("dreamboard_quantum_weeks").select("*").order("week_start"),
      sb.from("dreamboard_belief_entries").select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    var bad = res.find(function (r) { return r.error; });
    if (bad) throw bad.error;
    state.access = res[0].data; state.trees = res[1].data; state.items = res[2].data; state.cards = res[3].data;
    state.steps = res[4].data; state.plans = res[5].data; state.weeks = res[6].data; state.beliefs = res[7].data;
    state.loaded = true; void uid;
  }

  // ---------- shell ----------
  var NAV = [["home", "Home", "◈"], ["rooms", "All rooms", "▦"], ["book", "Book Studio", "❧"], ["tree", "Money Tree", "✦"], ["orchard", "Orchard", "❦"], ["quantum", "Quantum-ply", "△"], ["belief", "Belief Chain", "◎"], ["today", "Today", "•"]];
  function shell(inner, current) {
    var tier = state.access && state.access.tier;
    var nav = NAV.filter(function (n) { return n[0] !== "orchard" && n[0] !== "quantum"; }).map(function (n) { return '<a href="#/' + n[0] + '"' + (n[0] === current ? ' aria-current="page"' : "") + ">" + n[1] + "</a>"; }).join("");
    var tabs = NAV.filter(function (n) { return n[0] !== "orchard" && n[0] !== "quantum" && n[0] !== "belief"; }).map(function (n) {
      return '<a href="#/' + n[0] + '"' + (n[0] === current ? ' aria-current="page"' : "") + '><span class="g" aria-hidden="true">' + n[2] + "</span>" + n[1].replace("Money ", "").replace(" Chain", "").replace("Quantum-ply", "Ply").replace("Book Studio", "Book").replace("All rooms", "Rooms") + "</a>";
    }).join("");
    return '<header class="topbar"><a class="brand" href="#/home"><b>DREAM BOARD</b><span>by Above the Hill Developments</span></a>' +
      (state.user ? '<nav class="nav" aria-label="Dream Board">' + nav + '</nav><div class="who">' + (tier ? '<span class="tier" title="Your WOW Passport tier">' + esc(tier) + "</span>" : "") +
        '<span class="email">' + esc(state.user.email || "") + '</span><button class="btn small" id="signout">Sign out</button></div>' : '<div class="spacer"></div>') +
      "</header>" + inner +
      '<footer class="foot"><span>Money Tree, Quantum-ply and the belief chain are frameworks taught by Myron Golden, summarized here in our own words.</span><span class="spacer"></span><span>Your board is private to your WOW Passport. Nothing here is invented.</span></footer>' +
      (state.user ? '<nav class="tabbar" aria-label="Dream Board tabs">' + tabs + "</nav>" : "");
  }

  // ---------- views ----------
  function viewSignedOut() {
    return shell('<section class="hero" style="min-height:360px"><div class="plate" style="background-image:url(art-hero-hill.jpg)"></div>' +
      '<div><h1>Write the vision. Make it plain.</h1><p>One WOW Passport opens your board, your Money Trees, your Quantum-ply plan and your belief journal on phone, iPad and desktop.</p></div></section>' +
      '<div class="wrap"><div class="auth glass pad"><h3>Sign in with your Passport</h3><p class="note" style="text-align:center;margin:0">One login for every Above the Hill app.</p>' +
      '<div class="tabs"><button class="btn small" data-mode="password" aria-pressed="true">Password</button><button class="btn small" data-mode="link">Email me a link</button><button class="btn small" data-mode="create">New Passport</button></div>' +
      '<form id="authform"><div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="email" required></div>' +
      '<div class="field" id="pwf"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" minlength="6"></div>' +
      '<button class="btn solid" style="width:100%" id="authgo">Sign in</button><p id="authmsg" class="note" role="status" style="text-align:center"></p></form></div>' +
      '<div class="inventions">' +
      inv("The Money Tree", "Taproot, roots, shoot and fruit lanes for each goal: what the market wants, the unseen work, the content that attracts, and the provision it brings others.") +
      inv("Quantum-ply", "Write a baseline number, climb six steps (quantify, qualify, simplify, amplify, magnify, multiply) and log one real number each week.") +
      inv("Belief Chain journal", "Facts, focus, belief, feeling, function. Catch worry in the chain and replace it with joyful anticipation.") +
      inv("Orchard", "Every Money Tree you plant, drawn by how far it has really grown. One tree at a time.") +
      inv("Start before ready", "One small step a day. Press I started. The seeds you collect are the days you actually began.") +
      "</div></div>", "");
  }
  function inv(t, p) { return '<div class="glass pad"><h3>' + t + "</h3><p>" + p + "</p></div>"; }

  function zoneCol(zone, title, hint) {
    var cards = state.cards.filter(function (c) { return c.zone === zone; });
    return '<section class="glass pad col" aria-labelledby="z-' + zone + '"><h3 id="z-' + zone + '">' + title + '</h3><p class="zone-hint">' + hint + "</p>" +
      (cards.length ? cards.map(function (c) {
        return '<div class="card' + (c.done_at ? " done" : "") + '"><button class="check" data-act="card-done" data-id="' + c.id + '" aria-pressed="' + (!!c.done_at) + '" aria-label="Mark done">' + (c.done_at ? "✓" : "") + '</button><div class="body">' + esc(c.body) + '</div><button class="icon-btn" data-act="card-del" data-id="' + c.id + '" aria-label="Remove card">✕</button></div>';
      }).join("") : '<div class="empty">Nothing here yet. Write the first one.</div>') +
      '<form class="add" data-act="card-add" data-zone="' + zone + '"><input name="body" maxlength="500" placeholder="Add to ' + title.toLowerCase() + '" aria-label="Add a card to ' + title + '" required><button class="btn small" aria-label="Add">Add</button></form></section>';
  }

  function todayRow() { var d = localDay(); return state.steps.find(function (s) { return s.day === d; }); }
  function seedsRow(n) {
    var out = []; var byDay = {}; state.steps.forEach(function (s) { byDay[s.day] = s; });
    for (var i = n - 1; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var k = localDay(d); var s = byDay[k];
      out.push('<span class="' + (s && s.started_at ? "on" : s ? "miss" : "") + '" title="' + k + (s && s.started_at ? " — started" : s ? " — planned, not started" : "") + '"></span>'); }
    return '<div class="seeds" aria-label="Last ' + n + ' days">' + out.join("") + "</div>";
  }

  function viewHome() {
    var t = todayRow();
    var orchard = state.trees.slice(0, 5).map(function (tr) { return treeSVG(treeStage(tr.id), 64); }).join("");
    var side = '<div class="side"><section class="glass pad"><h3>Today\'s step</h3>' +
      (t ? '<div class="row" style="margin-top:10px;align-items:flex-start"><button class="check" data-act="step-start" aria-pressed="' + (!!t.started_at) + '" aria-label="I started">' + (t.started_at ? "✓" : "") + '</button><div class="today-step">' + esc(t.step) + "</div></div>"
        : '<p class="note" style="text-align:center">Start before you\'re ready.</p><a class="btn small" style="width:100%" href="#/today">Name today\'s one step</a>') +
      seedsRow(14) + '</section><section class="glass pad"><h3>Orchard</h3>' +
      (state.trees.length ? '<a class="orchard-mini" href="#/orchard" aria-label="Open the Orchard">' + orchard + '</a><p class="note" style="text-align:center;margin:4px 0 0">' + state.trees.length + " tree" + (state.trees.length === 1 ? "" : "s") + " planted</p>"
        : '<p class="note" style="text-align:center">No Money Tree planted yet.</p><a class="btn small" style="width:100%" href="#/tree">Plant your first tree</a>') + "</section></div>";
    return shell('<section class="hero"><div class="plate" style="background-image:url(art-hero-hill.jpg)"></div><div><h1>Write the vision. Make it plain.</h1></div></section>' +
      '<div class="wrap"><div class="grid-home">' +
      zoneCol("dream", "Dream", "images, words, prayers, ambitions") +
      zoneCol("plain", "Make it plain", "one clear statement or plan") +
      zoneCol("prove", "Do / Prove", "next actions and evidence") + side + "</div></div>", "home");
  }

  function viewTree(id) {
    var lim = state.access && state.access.treeLimit;
    var canPlant = lim == null || state.trees.length < lim;
    var tree = state.trees.find(function (t) { return t.id === id; }) || state.trees[0];
    var plant = '<form class="glass pad" data-act="tree-add" style="margin-top:14px"><h3 style="text-align:left">Plant a Money Tree</h3><p class="note">Name one goal. You will fill its four lanes below.</p>' +
      '<div class="row"><input class="free" name="title" maxlength="120" placeholder="Goal, e.g. My coaching offer" aria-label="Goal name" required style="flex:1 1 240px"><button class="btn solid"' + (canPlant ? "" : " disabled") + ">Plant</button></div>" +
      (canPlant ? "" : '<p class="note" style="margin-top:8px">Your <b>' + esc(state.access.tier) + "</b> Passport plants " + lim + " tree. A Dream Board or Passport plan opens the full Orchard.</p>") + "</form>";
    if (!tree) return shell('<div class="wrap"><h2 class="title">The Money Tree</h2><p class="sub">Four systems for each goal. Down comes before up: the roots grow before the shoot reaches the light.</p>' + plant + callsCard("roots") + "</div>", "tree");
    var picks = state.trees.map(function (t) { return '<a class="btn small"' + (t.id === tree.id ? ' style="background:rgba(217,181,108,0.2)"' : "") + ' href="#/tree/' + t.id + '">' + esc(t.title) + "</a>"; }).join("");
    var lanes = LANES.map(function (L) {
      var its = state.items.filter(function (i) { return i.tree_id === tree.id && i.lane === L[0]; });
      var extra = L[0] === "taproot" ? '<div class="field" style="grid-column:1/-1;margin:0"><label for="bc">Their single biggest challenge</label><textarea id="bc" class="free" rows="2" maxlength="600" data-act="tree-challenge" data-id="' + tree.id + '" placeholder="Ask your people: what is your single biggest challenge with this? Write what they say.">' + esc(tree.biggest_challenge) + "</textarea></div>" : "";
      var kindSel = L[3].length > 1 ? '<select class="free" name="kind" aria-label="Kind">' + L[3].map(function (k) { return '<option value="' + k + '">' + (k ? KIND_LABEL[k] : "Kind (optional)") + "</option>"; }).join("") + "</select>" : "";
      return '<section class="glass lane ' + L[0] + '"><div><h3 class="lane-name">' + L[1] + '</h3><p class="lane-desc">' + L[2] + "</p></div>" +
        '<div class="lane-cards">' + (its.length ? its.map(function (i) {
          return '<div class="card' + (i.done_at ? " done" : "") + '"><button class="check" data-act="item-done" data-id="' + i.id + '" aria-pressed="' + (!!i.done_at) + '" aria-label="Mark done">' + (i.done_at ? "✓" : "") + '</button><div class="body">' + esc(i.body) + (i.kind ? '<br><span class="chip">' + KIND_LABEL[i.kind] + "</span>" : "") + '</div><button class="icon-btn" data-act="item-del" data-id="' + i.id + '" aria-label="Remove">✕</button></div>';
        }).join("") : '<div class="empty">No ' + L[1].toLowerCase() + " cards yet.</div>") + "</div>" + extra +
        '<form class="lane-add" data-act="item-add" data-lane="' + L[0] + '" data-tree="' + tree.id + '"><input class="free" name="body" maxlength="400" placeholder="Add a ' + L[1].toLowerCase() + ' card" aria-label="Add a ' + L[1] + ' card" required>' + kindSel + '<button class="btn small">Add</button></form></section>';
    }).join("");
    var stage = treeStage(tree.id);
    return shell('<div class="wrap"><h2 class="title">The Money Tree</h2><p class="sub">Taproot: what the market wants. Roots: the unseen work. Shoot: content that connects, converts and proves. Fruit: the provision, and it is for others.</p>' +
      '<div class="tree-pick">' + picks + (canPlant ? '<a class="btn small" href="#/orchard">+ Plant another</a>' : "") + "</div>" +
      '<div class="tree-stage"><div class="plate" style="background-image:url(art-money-tree.jpg)"></div>' +
      '<div class="tree-head"><div><div class="lbl">Goal</div><input class="free" style="font-family:var(--serif);font-size:24px;color:var(--gold-hi)" data-act="tree-title" data-id="' + tree.id + '" value="' + esc(tree.title) + '" maxlength="120" aria-label="Goal name"></div>' +
      '<div><div class="lbl">Grown so far</div><div class="row"><span class="stat" style="font-size:24px">' + STAGE_LABEL[stage] + '</span><span class="spacer"></span><button class="btn small" data-act="tree-del" data-id="' + tree.id + '">Remove tree</button></div><p class="note" style="margin:4px 0 0">Stage comes from the cards you have checked off, lane by lane.</p></div></div>' +
      callsCard("roots") + '<div class="lanes">' + lanes + "</div></div>" + (canPlant ? plant : "") + "</div>", "tree");
  }

  function viewOrchard() {
    var lim = state.access && state.access.treeLimit;
    var canPlant = lim == null || state.trees.length < lim;
    var trees = state.trees.map(function (t) {
      var st = treeStage(t.id), sizes = { seed: 90, sprout: 110, young: 150, fruiting: 180 };
      var done = state.items.filter(function (i) { return i.tree_id === t.id && i.done_at; }).length;
      var all = state.items.filter(function (i) { return i.tree_id === t.id; }).length;
      return '<a class="otree" href="#/tree/' + t.id + '">' + treeSVG(st, sizes[st]) + '<div class="tag"><b>' + esc(t.title) + "</b><span>" + STAGE_LABEL[st] + " · " + done + " of " + all + " cards done</span></div></a>";
    }).join("");
    return shell('<div class="wrap" style="margin-top:20px"><div class="orchard"><div class="plate" style="background-image:url(art-orchard.jpg)"></div>' +
      '<div class="orchard-top"><h2 class="title" style="margin-top:0">Orchard</h2><p>One tree at a time.</p>' +
      '<form class="row" data-act="tree-add" style="justify-content:center"><input class="free" name="title" maxlength="120" placeholder="Name a new goal" aria-label="New goal" required style="max-width:280px"' + (canPlant ? "" : " disabled") + '><button class="btn solid"' + (canPlant ? "" : " disabled") + ">Plant a new tree</button></form>" +
      (canPlant ? "" : '<p class="note" style="font-family:var(--sans);font-style:normal;font-size:14px">Your ' + esc(state.access.tier) + " Passport plants " + lim + " tree. A Dream Board or Passport plan opens the full Orchard.</p>") +
      '</div><div class="orchard-field">' + (trees || '<p class="empty" style="background:rgba(4,6,5,0.6)">Your orchard is open ground. Plant the first tree above.</p>') + "</div></div></div>", "orchard");
  }

  function planChart(plan, weeks) {
    if (!weeks.length) return '<div class="empty" style="height:220px;display:grid;place-items:center">No weeks logged yet. Your first real number will draw the line.</div>';
    var W = window.innerWidth < 760 ? 340 : 640, H = window.innerWidth < 760 ? 200 : 220, P = 30;
    var vals = weeks.map(function (w) { return Number(w.value); }).concat([Number(plan.baseline)]).concat(plan.target != null ? [Number(plan.target)] : []);
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals); if (mx === mn) { mx += 1; mn -= 1; }
    var x = function (i) { return weeks.length === 1 ? W / 2 : P + i * (W - 2 * P) / (weeks.length - 1); };
    var y = function (v) { return H - P - (v - mn) * (H - 2 * P) / (mx - mn); };
    var pts = weeks.map(function (w, i) { return x(i).toFixed(1) + "," + y(Number(w.value)).toFixed(1); }).join(" ");
    var grid = ""; for (var g = 0; g < 5; g++) { var gy = P + g * (H - 2 * P) / 4; grid += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + gy + '" y2="' + gy + '" stroke="rgba(217,181,108,0.18)"/>'; }
    var base = '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(Number(plan.baseline)) + '" y2="' + y(Number(plan.baseline)) + '" stroke="#a99f8a" stroke-dasharray="5 5"/><text x="' + (W - P) + '" y="' + (y(Number(plan.baseline)) - 6) + '" fill="#c9bfa8" font-size="13" text-anchor="end">baseline ' + num(plan.baseline) + "</text>";
    var tgt = plan.target != null ? '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(Number(plan.target)) + '" y2="' + y(Number(plan.target)) + '" stroke="#f3d996" stroke-opacity=".5" stroke-dasharray="2 6"/><text x="' + P + '" y="' + (y(Number(plan.target)) - 6) + '" fill="#f3d996" font-size="13">target ' + num(plan.target) + "</text>" : "";
    var dots = weeks.map(function (w, i) { return '<circle cx="' + x(i) + '" cy="' + y(Number(w.value)) + '" r="4.5" fill="#f3d996"><title>' + w.week_start + ": " + num(w.value) + "</title></circle>"; }).join("");
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Weekly ' + esc(plan.metric_name) + '">' + grid + base + tgt + '<polyline points="' + pts + '" fill="none" stroke="#d9b56c" stroke-width="2.5" style="filter:drop-shadow(0 0 6px rgba(243,217,150,.6))"/>' + dots + "</svg>";
  }

  function viewQuantum(id) {
    var plan = state.plans.find(function (p) { return p.id === id; }) || state.plans[0];
    var treeOpts = '<option value="">No tree</option>' + state.trees.map(function (t) { return '<option value="' + t.id + '">' + esc(t.title) + "</option>"; }).join("");
    var create = '<form data-act="plan-add"><div class="field"><label for="mn">Metric name</label><input id="mn" name="metric" maxlength="80" placeholder="e.g. Leads per month" required></div>' +
      '<div class="row" style="align-items:flex-start"><div class="field" style="flex:1"><label for="mb">Starting value</label><input id="mb" name="baseline" type="number" step="any" inputmode="decimal" required></div>' +
      '<div class="field" style="flex:1"><label for="mt">Target (optional)</label><input id="mt" name="target" type="number" step="any" inputmode="decimal"></div></div>' +
      '<div class="row" style="align-items:flex-start"><div class="field" style="flex:1"><label for="mu">Unit (optional)</label><input id="mu" name="unit" maxlength="24" placeholder="leads, $, sales"></div>' +
      '<div class="field" style="flex:1"><label for="mtr">Money Tree</label><select id="mtr" name="tree" class="free">' + treeOpts + "</select></div></div>" +
      '<button class="btn solid" style="width:100%">Set baseline</button></form>';
    var stairs = STEPS.map(function (s, i) {
      var on = plan && plan.current_step === s[0];
      return '<button class="step" style="left:' + (4 + i * 13.5) + "%;bottom:" + (6 + i * 15) + '%" data-act="plan-step" data-step="' + s[0] + '" aria-pressed="' + !!on + '"' + (plan ? "" : " disabled") + ">" + s[1] + "</button>";
    }).join("");
    var head = '<div class="tree-pick">' + state.plans.map(function (p) { return '<a class="btn small"' + (plan && p.id === plan.id ? ' style="background:rgba(217,181,108,0.2)"' : "") + ' href="#/quantum/' + p.id + '">' + esc(p.metric_name) + "</a>"; }).join("") + "</div>";
    var left, tracker = "";
    if (plan) {
      var weeks = state.weeks.filter(function (w) { return w.plan_id === plan.id; });
      var last = weeks[weeks.length - 1];
      var change = last ? Number(last.value) - Number(plan.baseline) : null;
      var cur = STEPS.find(function (s) { return s[0] === plan.current_step; });
      var notes = plan.step_notes || {};
      left = '<div class="glass pad"><div class="lbl">Baseline</div><div class="stat">' + num(plan.baseline) + ' <span class="note">' + esc(plan.unit) + "</span></div>" +
        '<p class="note" style="margin:4px 0 12px">' + esc(plan.metric_name) + " · set " + fmtDate(plan.created_at) + (plan.target != null ? " · target " + num(plan.target) : "") + "</p>" +
        (last ? '<div class="lbl">Latest week</div><div class="stat">' + num(last.value) + '</div><p class="note">' + (change >= 0 ? "+" : "") + num(change) + " vs baseline · week of " + last.week_start + "</p>" : '<p class="note">No week logged yet.</p>') +
        '<div class="step-detail"><div class="lbl">Step: ' + cur[1] + '</div><p style="margin:4px 0 8px;color:var(--cream-dim)">' + cur[2] + '</p><textarea class="free" rows="3" maxlength="800" data-act="plan-note" data-id="' + plan.id + '" data-step="' + cur[0] + '" placeholder="What will you do on this step?">' + esc(notes[cur[0]] || "") + "</textarea></div>" +
        '<details style="margin-top:10px"><summary class="note" style="cursor:pointer">Start another metric</summary><div style="margin-top:10px">' + create + "</div></details></div>";
      tracker = '<section class="glass pad tracker"><h3 style="text-align:left">Weekly tracker</h3><div class="tracker-grid"><div>' + planChart(plan, weeks) +
        (weeks.length ? '<table class="weeks"><thead><tr><th>Week of</th><th>' + esc(plan.metric_name) + "</th><th>Note</th></tr></thead><tbody>" + weeks.slice().reverse().slice(0, 8).map(function (w) { return "<tr><td>" + w.week_start + "</td><td>" + num(w.value) + "</td><td>" + esc(w.note) + "</td></tr>"; }).join("") + "</tbody></table>" : "") +
        '</div><form data-act="week-add" data-id="' + plan.id + '"><div class="field"><label for="wv">This week (' + weekStart() + ')</label><input id="wv" name="value" type="number" step="any" inputmode="decimal" required></div><div class="field"><label for="wn">Note</label><input id="wn" name="note" maxlength="400" placeholder="What moved it?"></div><button class="btn solid" style="width:100%">Log this week</button><p class="note">Logging again this week replaces this week\'s number.</p>' +
        '<button type="button" class="btn small" data-act="plan-del" data-id="' + plan.id + '" style="margin-top:10px">Remove this metric</button></form></div></section>';
    } else {
      left = '<div class="glass pad"><h3 style="text-align:left">Baseline</h3><p class="note">Quantify first: one number you can measure today.</p>' + create + "</div>";
    }
    return shell('<div class="wrap"><h2 class="title" style="text-align:center">Quantum-ply</h2><p class="sub" style="margin:0 auto 14px;text-align:center">Baseline → quantify, qualify, simplify, amplify, magnify, multiply → one real number each week.</p>' + head +
      '<div class="ply"><div class="plate" style="background-image:url(art-hill-sunrise.jpg)"></div><div class="ply-grid">' + left + '<div class="stairs" aria-label="The six steps">' + stairs + "</div></div></div>" + tracker + "</div>", "quantum");
  }

  var draft = {};
  function toneToggle(key, a, b) {
    return '<div class="toggle" role="group" aria-label="' + a + " or " + b + '"><button type="button" data-act="tone" data-k="' + key + '" data-v="' + a + '" aria-pressed="' + (draft[key] === a) + '">' + a + '</button><button type="button" class="neg" data-act="tone" data-k="' + key + '" data-v="' + b + '" aria-pressed="' + (draft[key] === b) + '">' + b + "</button></div>";
  }
  function viewBelief() {
    var rows = [
      ["facts", "Facts", null, "What actually happened? Only what a camera would see."],
      ["focus", "Focus", ["focus_tone", "positive", "negative"], "Which part of the facts are you looking at?"],
      ["belief", "Belief", ["belief_tone", "faith", "doubt"], "What does that focus make you believe will happen?"],
      ["feeling", "Feeling", ["feeling_tone", "anticipation", "anxiety"], "How does that belief feel in your body?"],
      ["function_text", "Function", ["function_tone", "power", "powerlessness"], "How are you acting because of it?"]
    ].map(function (r) {
      return '<div class="ring-row"><div class="ring" aria-hidden="true"></div><div><div class="lbl">' + r[1] + "</div>" + (r[2] ? toneToggle(r[2][0], r[2][1], r[2][2]) : "") +
        '<textarea class="free" rows="2" maxlength="800" data-draft="' + r[0] + '" placeholder="' + r[3] + '" aria-label="' + r[1] + '">' + esc(draft[r[0]] || "") + "</textarea></div></div>";
    }).join("");
    var since = Date.now() - 30 * 864e5;
    var recent = state.beliefs.filter(function (b) { return new Date(b.created_at).getTime() >= since; });
    var ant = recent.filter(function (b) { return b.feeling_tone === "anticipation"; }).length, anx = recent.filter(function (b) { return b.feeling_tone === "anxiety"; }).length;
    var list = state.beliefs.slice(0, 12).map(function (b) {
      var p = function (v, neg) { return v ? '<span class="pill' + (neg ? " neg" : "") + '">' + v + "</span>" : ""; };
      return '<div class="entry"><div class="when">' + new Date(b.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + "</div>" +
        p(b.focus_tone, b.focus_tone === "negative") + p(b.belief_tone, b.belief_tone === "doubt") + p(b.feeling_tone, b.feeling_tone === "anxiety") + p(b.function_tone, b.function_tone === "powerlessness") +
        (b.replacement ? '<div class="rep">' + esc(b.replacement) + "</div>" : '<div class="note">' + esc((b.facts || "").slice(0, 120)) + "</div>") +
        '<button class="icon-btn" data-act="belief-del" data-id="' + b.id + '" aria-label="Delete entry" style="float:right;margin-top:-28px">✕</button></div>';
    }).join("");
    return shell('<div class="wrap"><h2 class="title">The Belief Chain</h2><p class="sub">Facts → focus → belief → feeling → function. Worry spends today\'s energy on a future you don\'t want. Find the link that turned, then replace the thought.</p>' +
      '<div class="belief-grid"><section class="glass pad">' + rows + '</section><section><div class="sunrise-card"><div class="art" style="background-image:url(art-sunrise.jpg)"><h3>Thought replacement</h3></div>' +
      '<textarea class="free" rows="4" maxlength="1200" data-draft="replacement" placeholder="Swap the anxious picture for the outcome you expect, and write it as if you are already walking toward it." aria-label="Thought replacement">' + esc(draft.replacement || "") + "</textarea></div>" +
      '<button class="btn solid" data-act="belief-save" style="width:100%;margin-top:12px">Save to journal</button><p class="note">Saved privately to your Passport. Nothing is analysed by AI.</p></section>' +
      '<section class="glass pad"><h3 style="text-align:left">Journal</h3><p class="note">Last 30 days: ' + recent.length + " entr" + (recent.length === 1 ? "y" : "ies") + (recent.length ? " · anticipation " + ant + " · anxiety " + anx : "") + "</p>" + (list || '<div class="empty">Your first entry will appear here.</div>') + "</section></div></div>", "belief");
  }

  function viewToday() {
    var t = todayRow();
    var started = state.steps.filter(function (s) { return s.started_at; }).length;
    var treeOpts = '<option value="">No tree</option>' + state.trees.map(function (tr) { return '<option value="' + tr.id + '"' + (t && t.tree_id === tr.id ? " selected" : "") + ">" + esc(tr.title) + "</option>"; }).join("");
    return shell('<section class="hero" style="min-height:220px"><div class="plate" style="background-image:url(art-hero-hill.jpg)"></div><div><div class="seed-glow" aria-hidden="true"></div><h1>Start before you\'re ready</h1><p>Small things multiplied make big dividends. The assignment prepares you.</p></div></section>' +
      '<div class="wrap"><div class="daily glass pad"><form data-act="step-save"><div class="field"><label for="ts">Today\'s one small step</label><textarea id="ts" class="free" rows="2" maxlength="280" required style="font-family:var(--hand);font-size:24px" placeholder="One thing you can begin in the next hour">' + esc(t ? t.step : "") + "</textarea></div>" +
      '<div class="field"><label for="tt">For which Money Tree</label><select id="tt" class="free" name="tree">' + treeOpts + '</select></div><button class="btn small">' + (t ? "Update step" : "Save step") + "</button></form>" +
      '<button class="btn started-btn' + (t && t.started_at ? " is-on" : "") + '" data-act="step-start"' + (t ? "" : " disabled") + ">" + (t && t.started_at ? "Started ✓" : "I started") + "</button>" +
      '<p class="note">' + (t && t.started_at ? "Started at " + new Date(t.started_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : t ? "Press it the moment you begin, not when you finish." : "Name the step first.") + "</p>" +
      seedsRow(28) + '<p class="note" style="margin-top:8px">' + started + " day" + (started === 1 ? "" : "s") + " started so far (gold seeds). Dim seeds were planned but not started.</p></div>" + callsCard("today") + "</div>", "today");
  }

  // ---------- render ----------
  async function render() {
    if (!state.user) { $app.innerHTML = viewSignedOut(); bindAuth(); return; }
    if (!state.loaded) {
      $app.innerHTML = shell('<p class="loading">Opening your board…</p>', "");
      try { await loadAll(); } catch (e) { $app.innerHTML = shell('<div class="wrap"><p class="err" style="margin-top:40px">Could not load your board: ' + esc(friendly(e)) + '</p><button class="btn" onclick="location.reload()">Try again</button></div>', ""); return; }
    }
    var r = route();
    if (r.name === "book") return mountBook();
    if (r.name === "r") return mountRoom(r.id);
    if (r.name === "rooms") { $app.innerHTML = viewRooms(); return; }
    var v = { home: viewHome, tree: viewTree, orchard: viewOrchard, quantum: viewQuantum, belief: viewBelief, today: viewToday }[r.name] || viewHome;
    var y = window.scrollY;
    $app.innerHTML = v(r.id);
    if (render.keepScroll) window.scrollTo(0, y); render.keepScroll = false;
  }
  // ---------- Dream Board OS: every room from the original Dream Board, in one place (Founder 2026-11-12: "no split brain") ----------
  // kind: room = board/rooms/<id>.js (#/r/<id>) · native = already a Dream Board view · dock = the ONE WOW dock room · link = opens WOW
  var ROOMS = [
    ["Create", [
      ["vision", "Vision Vault", "Catch every idea and grow it from inbox to project.", "room"],
      ["book", "Book Studio", "Organize decades of writing into chapters — never ghostwritten.", "native", "#/book"],
      ["writing", "Writing Studio", "Draft chapters and documents with focus mode, versions and compare.", "room"],
      ["voice", "Voice Guardian", "Keep samples of your real voice so every draft stays yours.", "room"]]],
    ["Know", [
      ["knowledge", "Knowledge Vault", "Notes, journals and imports — searchable, with Organize My Notes.", "room"],
      ["graph", "Creative Graph", "See how your ideas, sources and projects connect.", "room"],
      ["research", "Research Workspace", "Evidence by class, the Correction Ledger and the Equation Lab.", "room"],
      ["search", "Universal Search", "One search across every room.", "room"]]],
    ["Build", [
      ["projects", "Projects", "Project templates, focus, memory and the Finishing Engine.", "room"],
      ["constellation", "Constellation", "Your projects as stars, sized by real material.", "room"],
      ["tree", "Money Tree · Orchard", "Taproot, roots, shoot and fruit for every goal.", "native", "#/tree"],
      ["quantum", "Quantum-ply", "Quantify → Multiply, week by week.", "native", "#/quantum"]]],
    ["Grow", [
      ["today", "Today", "One small step, started before you're ready.", "native", "#/today"],
      ["belief", "Belief Chain", "Facts → focus → belief → feeling → function.", "native", "#/belief"],
      ["growth", "Growth Rings", "A private wall of the practices that grew you.", "room"],
      ["legacy", "Time Machine · Legacy", "On This Day, how your work evolved, and what you finished.", "room"],
      ["academy", "WOW Academy", "ATH learning engines: lessons, worlds and practice.", "link", "https://thewow.online/academy"]]],
    ["Publish", [
      ["reader", "Reader", "Read your manuscript the way a reader will.", "room"],
      ["audiobook", "Audiobook Studio", "Record and keep narrations, chapter by chapter.", "room"],
      ["publishing", "Publishing", "EPUB, Word and Markdown from your book.", "room"]]],
    ["Together", [
      ["companion", "Companion · Spaidbot", "30 personas and 30 skills, through Spaidbot. It suggests; you write.", "room"],
      ["collaboration", "Collaboration", "Invite a reader, editor or co-writer — only when you choose.", "room"],
      ["lounge", "Lounge", "The one WOW Lounge, from the WOW dock.", "dock", "lounge"],
      ["radio", "Radio · Music · TV", "Keep the music playing while you write.", "dock", "radio"],
      ["shop", "Shop", "The WOW Marketplace.", "link", "https://thewow.online/marketplace"]]],
    ["You", [
      ["settings", "Passport & Settings", "Display name, Dawn Paper or Midnight Garden, reduce motion, wisdom mode.", "room"]]]
  ];
  function roomById(id) { var f = null; ROOMS.forEach(function (g) { g[1].forEach(function (r) { if (r[0] === id) f = r; }); }); return f; }
  function viewRooms() {
    var groups = ROOMS.map(function (g) {
      return '<section class="os-group"><h2 class="os-h">' + g[0] + '</h2><div class="os-grid">' + g[1].map(function (r, i) {
        var href = r[3] === "room" ? "#/r/" + r[0] : r[3] === "native" ? r[4] : r[3] === "link" ? r[4] : "#/rooms";
        var attrs = r[3] === "dock" ? ' data-wow-dock="' + r[4] + '" role="button"' : r[3] === "link" ? ' target="_blank" rel="noopener"' : "";
        return '<a class="os-card" style="--i:' + i + '" href="' + href + '"' + attrs + '><b>' + r[1] + "</b><span>" + r[2] + '</span><i class="os-kind">' + ({ room: "room", native: "room", dock: "WOW dock", link: "opens WOW" })[r[3]] + "</i></a>";
      }).join("") + "</div></section>";
    }).join("");
    return shell('<section class="hero" style="min-height:300px"><div class="plate" style="background-image:url(art-book-studio.jpg)"></div><div><div class="kicker">Dream Board OS</div><h1>Every room. One board.</h1><p>Everything from the original Dream Board — vaults, studios, graph, research, publishing, Passport — now lives here, on your one WOW Passport.</p></div></section>' +
      '<div class="wrap os">' + groups + '<p class="note" style="margin:20px 0 0">Lounge, Radio, Music and TV are the one WOW dock (the button at the bottom left), so there is never a second Lounge. Drive import arrives through Book Studio and the Knowledge Vault importers.</p></div>', "rooms");
  }
  var roomsLoading = {};
  async function mountRoom(id) {
    var meta = roomById(id);
    if (!meta || meta[3] !== "room") { location.hash = "#/rooms"; return; }
    $app.innerHTML = shell('<p class="loading">Opening ' + esc(meta[1]) + "…</p>", "rooms");
    try {
      if (!window.DBKit) await Promise.all([loadOnce("link", { rel: "stylesheet", href: "book.css?v=" + BOOK_V }), loadOnce("link", { rel: "stylesheet", href: "rooms/rooms.css?v=" + BOOK_V }), loadOnce("script", { src: "rooms/kit.js?v=" + BOOK_V })]);
      if (!window.DBRoom.get(id)) { if (!roomsLoading[id]) roomsLoading[id] = loadOnce("script", { src: "rooms/" + id + ".js?v=" + BOOK_V }); await roomsLoading[id]; }
    } catch (e) { roomsLoading[id] = null; $app.innerHTML = shell('<div class="wrap"><p class="err" style="margin-top:40px">' + esc(e.message) + '</p><a class="btn" href="#/rooms">All rooms</a></div>', "rooms"); return; }
    window.DBRoom.setCtx({ sb: sb, user: function () { return state.user; }, access: function () { return state.access; }, shell: shell, esc: esc, toast: toast, state: state });
    $app.innerHTML = shell('<div class="room" id="room-' + id + '"></div>', "rooms");
    var el = document.getElementById("room-" + id);
    try { await window.DBRoom.get(id).mount(el, window.DBRoom); }
    catch (e) { el.innerHTML = '<div class="wrap"><p class="err" style="margin-top:40px">' + esc(meta[1]) + " could not open: " + esc(e.message || e) + "</p></div>"; }
  }

  // ---------- Today's calls (Founder order 2026-11-12): King + Queen only ----------
  // Read-only counts + next leads from the ATHOS Call Desk. The office checks the signed Passport token, the server
  // Founder grant and a 6-digit authenticator step-up (aal2) on every read; nothing is cached or stored here.
  var CALLS_URL = "https://mission.abovethehilldev.online/api/dreamboard/calls";
  var calls = { status: "idle", data: null, msg: "", at: 0 };
  function isFounder() { return !!(state.access && state.access.tier === "founder"); }
  async function loadCalls(force) {
    if (!isFounder() || calls.status === "loading") return;
    if (!force && calls.at && Date.now() - calls.at < 60000) return;
    calls.status = "loading"; paintCalls();
    try {
      var aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      var lvl = aal && aal.data;
      if (!lvl || lvl.currentLevel !== "aal2") { calls.status = lvl && lvl.nextLevel === "aal2" ? "need-code" : "no-factor"; return paintCalls(); }
      var sess = (await sb.auth.getSession()).data.session;
      var r = await fetch(CALLS_URL, { headers: { authorization: "Bearer " + sess.access_token }, cache: "no-store" });
      var b = await r.json().catch(function () { return {}; });
      if (r.status === 403 && b.error === "STEP_UP_REQUIRED") { calls.status = "need-code"; return paintCalls(); }
      if (!r.ok) { calls.status = "error"; calls.msg = b.error === "FOUNDER_GRANT_REQUIRED" ? "This Passport has no Founder grant in the office." : "The office answered " + r.status + (b.error ? " (" + b.error + ")" : "") + "."; return paintCalls(); }
      calls.data = b; calls.status = "ok"; calls.at = Date.now();
    } catch (e) { calls.status = "error"; calls.msg = "Could not reach the office: " + (e.message || e); }
    paintCalls();
  }
  function callsInner(where) {
    var title = where === "roots" ? "Roots · today's dials" : "Today's calls";
    var head = '<div class="row" style="align-items:baseline"><h3 style="text-align:left;margin:0">' + title + '</h3><span class="spacer"></span><span class="tier" title="Only King and Queen see this">Founders only</span></div>';
    if (calls.status === "need-code") return head + '<p class="note" style="text-align:left">Your office protects the Call Desk with your authenticator. Enter the 6-digit code once to show today\'s calls here.</p><form class="row" data-act="calls-unlock"><input class="free" id="cc" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="123456" aria-label="6-digit authenticator code" style="max-width:160px" required><button class="btn small solid">Show my calls</button></form>';
    if (calls.status === "no-factor") return head + '<p class="note" style="text-align:left">This Passport has no authenticator yet, so the office will not share the Call Desk here. Set it up from the Founders office sign-in, then come back.</p>';
    if (calls.status === "error") return head + '<p class="err" style="text-align:left">' + esc(calls.msg) + '</p><button class="btn small" data-act="calls-load">Try again</button>';
    if (calls.status !== "ok" || !calls.data) return head + '<p class="note" style="text-align:left">Reading your Call Desk…</p>';
    var d = calls.data, t = d.today || {}, p = d.pipeline || {}, by = t.byFounder || {};
    var stat = function (n, l) { return '<div><span class="stat" style="font-size:30px">' + num(n || 0) + '</span><div class="lbl">' + l + "</div></div>"; };
    var who = Object.keys(by).map(function (k) { return esc(k) + " " + by[k]; }).join(" · ");
    return head + '<div class="calls-grid">' + stat(t.calls, "calls made today") + stat(t.leads, "leads touched") + stat(p.callbacksDue, "call-backs due") + stat(p.notCalled, "never called") + stat(p.interested, "interested") + stat(p.won, "won") + "</div>" +
      (who ? '<p class="note" style="text-align:left;margin:6px 0 0">Today: ' + who + "</p>" : "") +
      '<h3 style="text-align:left;font-size:17px;margin:14px 0 6px">Next up</h3>' +
      ((d.nextUp || []).length ? '<ol class="calls-next">' + d.nextUp.map(function (x) {
        return "<li><b>" + (x.leadNo ? "#" + x.leadNo + " " : "") + esc(x.name) + "</b>" + (x.city ? " · " + esc(x.city) : "") + '<div class="note">' + esc([x.due ? "Due " + x.due : "", x.next, x.status, x.last ? "last: " + x.last : ""].filter(Boolean).join(" · ")) + "</div></li>";
      }).join("") + "</ol>" : '<p class="note" style="text-align:left">Nobody is waiting. Every lead is called, won or closed out.</p>') +
      '<div class="row" style="margin-top:10px"><a class="btn small solid" href="' + esc(d.desk) + '" target="_blank" rel="noopener">Open the Call Desk</a><button class="btn small" data-act="calls-load">Refresh</button><span class="note">Read-only · ' + esc(d.day || "") + " CT</span></div>";
  }
  function callsCard(where) {
    if (!isFounder()) return "";
    setTimeout(function () { loadCalls(false); }, 0);
    return '<section class="glass pad calls-card" id="calls-card" data-where="' + where + '" aria-live="polite" style="margin-top:16px">' + callsInner(where) + "</section>";
  }
  function paintCalls() { var el = document.getElementById("calls-card"); if (el) el.innerHTML = callsInner(el.dataset.where); }
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest('[data-act="calls-load"]')) loadCalls(true); });
  document.addEventListener("submit", async function (e) {
    var f = e.target; if (f.dataset.act !== "calls-unlock") return;
    e.preventDefault(); e.stopImmediatePropagation();
    var code = (document.getElementById("cc").value || "").trim();
    try {
      var fl = await sb.auth.mfa.listFactors();
      var totp = ((fl.data && fl.data.totp) || []).find(function (x) { return x.status === "verified"; });
      if (!totp) { calls.status = "no-factor"; return paintCalls(); }
      var v = await sb.auth.mfa.challengeAndVerify({ factorId: totp.id, code: code });
      if (v.error) { toast(v.error.message || "That code did not work.", true); return; }
      calls.at = 0; await loadCalls(true);
    } catch (err) { toast(friendly(err), true); }
  }, true);

  // Book Studio is loaded only when it is opened (it is the heaviest room: engine + worker + IndexedDB).
  var BOOK_V = "1112c", bookLoading = null;
  function loadOnce(tag, attrs) {
    return new Promise(function (res, rej) { var el = document.createElement(tag); Object.keys(attrs).forEach(function (k) { el[k] = attrs[k]; }); el.onload = res; el.onerror = function () { rej(new Error("Could not load " + (attrs.src || attrs.href))); }; document.head.appendChild(el); });
  }
  async function mountBook() {
    if (!window.DBBook) {
      if (!bookLoading) bookLoading = Promise.all([loadOnce("link", { rel: "stylesheet", href: "book.css?v=" + BOOK_V }), loadOnce("script", { src: "book-engine.js?v=" + BOOK_V })])
        .then(function () { return loadOnce("script", { src: "book.js?v=" + BOOK_V }); });
      $app.innerHTML = shell('<p class="loading">Opening Book Studio…</p>', "book");
      try { await bookLoading; } catch (e) { bookLoading = null; $app.innerHTML = shell('<div class="wrap"><p class="err" style="margin-top:40px">' + esc(e.message) + '</p><button class="btn" onclick="location.reload()">Try again</button></div>', "book"); return; }
    }
    window.DBBook.mount($app, { sb: sb, user: function () { return state.user; }, access: function () { return state.access; }, shell: shell, esc: esc, toast: toast });
  }
  async function refresh() { render.keepScroll = true; await loadAll(); await render(); }

  // ---------- auth ----------
  var authMode = "password";
  function bindAuth() {
    var form = document.getElementById("authform"); if (!form) return;
    document.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        authMode = b.dataset.mode;
        document.querySelectorAll("[data-mode]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); x.style.background = x === b ? "rgba(217,181,108,0.2)" : ""; });
        document.getElementById("pwf").hidden = authMode === "link";
        document.getElementById("pw").autocomplete = authMode === "create" ? "new-password" : "current-password";
        document.getElementById("authgo").textContent = { password: "Sign in", link: "Email me a sign-in link", create: "Create my Passport" }[authMode];
      });
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = document.getElementById("authmsg"), email = document.getElementById("em").value.trim(), pw = document.getElementById("pw").value;
      msg.className = "note"; msg.textContent = "Working…";
      var redirect = location.origin + location.pathname;
      try {
        if (authMode === "password") { await run(sb.auth.signInWithPassword({ email: email, password: pw })); msg.textContent = ""; }
        else if (authMode === "link") { await run(sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect, shouldCreateUser: false } })); msg.className = "okmsg"; msg.textContent = "Check your email for the sign-in link."; }
        else { await run(sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: redirect } })); msg.className = "okmsg"; msg.textContent = "Passport created. Confirm it from your email, then sign in."; }
      } catch (err) { msg.className = "err"; msg.textContent = friendly(err); }
    });
  }

  // ---------- actions ----------
  var saveTimers = {};
  function debounce(key, fn) { clearTimeout(saveTimers[key]); saveTimers[key] = setTimeout(fn, 700); }

  document.addEventListener("click", async function (e) {
    var el = e.target.closest("[data-act]"); if (!el || el.tagName === "FORM") return;
    var act = el.dataset.act, id = el.dataset.id;
    if (el.id === "signout") return;
    try {
      if (act === "card-done") { var c = state.cards.find(function (x) { return x.id === id; }); await run(sb.from("dreamboard_board_cards").update({ done_at: c.done_at ? null : new Date().toISOString() }).eq("id", id)); }
      else if (act === "card-del") { if (!confirm("Remove this card?")) return; await run(sb.from("dreamboard_board_cards").delete().eq("id", id)); }
      else if (act === "item-done") { var it = state.items.find(function (x) { return x.id === id; }); await run(sb.from("dreamboard_tree_items").update({ done_at: it.done_at ? null : new Date().toISOString() }).eq("id", id)); }
      else if (act === "item-del") { if (!confirm("Remove this card?")) return; await run(sb.from("dreamboard_tree_items").delete().eq("id", id)); }
      else if (act === "tree-del") { if (!confirm("Remove this Money Tree and all of its cards? This cannot be undone.")) return; await run(sb.from("dreamboard_money_trees").delete().eq("id", id)); location.hash = "#/orchard"; }
      else if (act === "plan-step") { var r = route(); var p = state.plans.find(function (x) { return x.id === r.id; }) || state.plans[0]; await run(sb.from("dreamboard_quantum_plans").update({ current_step: el.dataset.step, updated_at: new Date().toISOString() }).eq("id", p.id)); }
      else if (act === "plan-del") { if (!confirm("Remove this metric and its weekly log? This cannot be undone.")) return; await run(sb.from("dreamboard_quantum_plans").delete().eq("id", id)); location.hash = "#/quantum"; }
      else if (act === "step-start") { var t = todayRow(); if (!t) return; await run(sb.from("dreamboard_daily_steps").update({ started_at: t.started_at ? null : new Date().toISOString() }).eq("id", t.id)); if (!t.started_at) toast("Started. That is the whole secret."); }
      else if (act === "tone") { draft[el.dataset.k] = draft[el.dataset.k] === el.dataset.v ? null : el.dataset.v; render.keepScroll = true; return render(); }
      else if (act === "belief-save") {
        var row = { owner_id: state.user.id };
        ["facts", "focus", "belief", "feeling", "function_text", "replacement"].forEach(function (k) { row[k] = (draft[k] || "").trim(); });
        ["focus_tone", "belief_tone", "feeling_tone", "function_tone"].forEach(function (k) { row[k] = draft[k] || null; });
        if (!row.facts && !row.replacement) return toast("Write the facts or a thought replacement first.", true);
        await run(sb.from("dreamboard_belief_entries").insert(row)); draft = {}; toast("Saved to your journal.");
      }
      else if (act === "belief-del") { if (!confirm("Delete this journal entry? This cannot be undone.")) return; await run(sb.from("dreamboard_belief_entries").delete().eq("id", id)); }
      else return;
      await refresh();
    } catch (err) { toast(friendly(err), true); }
  });

  document.addEventListener("submit", async function (e) {
    var f = e.target; var act = f.dataset.act; if (!act) return; e.preventDefault();
    var fd = new FormData(f), uid = state.user.id;
    try {
      if (act === "card-add") { await run(sb.from("dreamboard_board_cards").insert({ owner_id: uid, zone: f.dataset.zone, body: fd.get("body").trim() })); }
      else if (act === "tree-add") { var ins = await run(sb.from("dreamboard_money_trees").insert({ owner_id: uid, title: fd.get("title").trim() }).select("id").single()); await loadAll(); location.hash = "#/tree/" + ins.id; toast("Planted. Start with the taproot."); return; }
      else if (act === "item-add") { await run(sb.from("dreamboard_tree_items").insert({ owner_id: uid, tree_id: f.dataset.tree, lane: f.dataset.lane, kind: fd.get("kind") || "", body: fd.get("body").trim() })); }
      else if (act === "plan-add") {
        var tv = fd.get("target");
        var p = await run(sb.from("dreamboard_quantum_plans").insert({ owner_id: uid, metric_name: fd.get("metric").trim(), baseline: Number(fd.get("baseline")), target: tv === "" ? null : Number(tv), unit: (fd.get("unit") || "").trim(), tree_id: fd.get("tree") || null }).select("id").single());
        await loadAll(); location.hash = "#/quantum/" + p.id; toast("Baseline set. That is Quantify."); return;
      }
      else if (act === "week-add") { await run(sb.from("dreamboard_quantum_weeks").upsert({ owner_id: uid, plan_id: f.dataset.id, week_start: weekStart(), value: Number(fd.get("value")), note: (fd.get("note") || "").trim() }, { onConflict: "plan_id,week_start" })); toast("Week logged."); }
      else if (act === "step-save") {
        var step = document.getElementById("ts").value.trim(); if (!step) return;
        var t = todayRow();
        if (t) await run(sb.from("dreamboard_daily_steps").update({ step: step, tree_id: fd.get("tree") || null }).eq("id", t.id));
        else await run(sb.from("dreamboard_daily_steps").insert({ owner_id: uid, day: localDay(), step: step, tree_id: fd.get("tree") || null }));
      }
      await refresh();
    } catch (err) { toast(friendly(err), true); }
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.dataset.draft) { draft[el.dataset.draft] = el.value; return; }
    var act = el.dataset.act, id = el.dataset.id;
    if (act === "tree-title" && el.value.trim()) debounce("tt" + id, function () { sb.from("dreamboard_money_trees").update({ title: el.value.trim(), updated_at: new Date().toISOString() }).eq("id", id).then(function (r) { if (r.error) toast(friendly(r.error), true); else { var t = state.trees.find(function (x) { return x.id === id; }); if (t) t.title = el.value.trim(); } }); });
    if (act === "tree-challenge") debounce("tc" + id, function () { sb.from("dreamboard_money_trees").update({ biggest_challenge: el.value, updated_at: new Date().toISOString() }).eq("id", id).then(function (r) { if (r.error) toast(friendly(r.error), true); else { var t = state.trees.find(function (x) { return x.id === id; }); if (t) t.biggest_challenge = el.value; toast("Saved."); } }); });
    if (act === "plan-note") debounce("pn" + id, function () {
      var p = state.plans.find(function (x) { return x.id === id; }); var notes = Object.assign({}, p.step_notes || {}); notes[el.dataset.step] = el.value;
      sb.from("dreamboard_quantum_plans").update({ step_notes: notes, updated_at: new Date().toISOString() }).eq("id", id).then(function (r) { if (r.error) toast(friendly(r.error), true); else { p.step_notes = notes; toast("Saved."); } });
    });
  });

  document.addEventListener("click", async function (e) { if (e.target.id === "signout") { await sb.auth.signOut(); } });
  window.addEventListener("hashchange", function () { render(); window.scrollTo(0, 0); });

  // Gold dust
  (function () {
    var d = document.getElementById("dust"); if (!d) return;
    for (var i = 0; i < 26; i++) { var p = document.createElement("i"); p.style.left = (Math.random() * 100) + "%"; p.style.top = (60 + Math.random() * 60) + "%"; p.style.animationDuration = (14 + Math.random() * 18) + "s"; p.style.animationDelay = (-Math.random() * 30) + "s"; p.style.setProperty("--dx", (Math.random() * 80 - 40) + "px"); d.appendChild(p); }
  })();

  sb.auth.onAuthStateChange(function (_ev, session) {
    var u = session ? session.user : null;
    if ((u && u.id) !== (state.user && state.user.id)) { state.user = u; state.loaded = false; render(); }
  });
  sb.auth.getSession().then(function (r) { state.user = r.data.session ? r.data.session.user : null; render(); });
})();
