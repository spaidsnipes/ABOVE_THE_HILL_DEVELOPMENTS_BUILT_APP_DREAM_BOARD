/* Dream Board OS · Companion · Spaidbot (ported from ~/dreamboard/app/ai-studio.tsx + lib/companion.ts, 2026-11-12).
 * A transparent persona + skill architecture: a persona is a declared configuration (role, reasoning style, tone, safety,
 * skills), never a fake consciousness. Routing is deterministic (keywords or your pins). The request goes to the public
 * Spaidbot endpoint with the persona + skill + working-mode instructions and your prompt in one user message.
 * Every answer is labelled by category (evidence / interpretation / inference / speculation / recommendation /
 * creative suggestion / generated draft) and as a whole: "Suggestion · not your words". It never touches your writing;
 * it can only be copied or saved as a research note by an explicit click. Runs are kept in dreamboard_companion_runs
 * (provider 'spaidbot'). */
(function () {
  "use strict";
  var K = window.DBKit;
  var ENDPOINT = "https://mission.abovethehilldev.online/api/spaidbot";

  var MODES = [
    { id: "imagine", name: "Imagine", description: "Open possibilities without treating them as facts.", boundary: "Creative possibility — not evidence or a prediction.", instruction: "Generate distinct possibilities, metaphors, concepts, or directions. Label imaginative material as creative suggestion or speculation; do not make factual, scientific, spiritual, business, or outcome claims without provided evidence." },
    { id: "build", name: "Build", description: "Turn an approved direction into concrete, reviewable steps.", boundary: "Plan only — you decide what is made or changed.", instruction: "Convert only the creator's stated direction into a smallest useful plan: decisions, dependencies, next actions, and what still needs approval. Do not pretend work has been built." },
    { id: "research", name: "Research", description: "Separate questions, sources, evidence, and uncertainty.", boundary: "Unverified claims stay unverified until you check real sources.", instruction: "Start from questions and provided sources. State what is directly supported, what is interpretation, and what needs verification. Never invent citations, experiments, or validation." },
    { id: "challenge", name: "Challenge", description: "Test assumptions, gaps, risks, and counterarguments with care.", boundary: "Critique the work, never the creator.", instruction: "Name assumptions, failure modes, alternatives, contradictions, and questions fairly. Critique the work rather than the creator, and pair each concern with a test or decision." },
    { id: "refine", name: "Refine", description: "Clarify structure, language, and continuity while protecting authorship.", boundary: "Suggestions only — no silent rewrite or overwrite.", instruction: "Offer bounded, reviewable improvements to clarity, structure, continuity, or voice. Preserve meaning and never silently replace the creator's words." },
    { id: "publish", name: "Publish", description: "Prepare creator-approved work for a real audience and release path.", boundary: "Readiness guidance — no claim that work is published or cleared.", instruction: "Assess creator-approved material for audience, rights, format, accessibility, and release next steps. Never imply that a work is published, legally cleared, or ready without the creator confirming it." }
  ];
  // Registry ported verbatim from lib/companion.ts (30 personas, 30 skills).
  var PERSONAS = [
    { id: "creative-director", name: "Creative Director", summary: "Overall vision, emotional direction, and project identity.", domain: "vision", reasoningStyle: "big-picture, audience-first", tone: "inspiring, decisive", safety: "Serves the creator's intent, never overrides it.", skills: ["brainstorm", "outline", "project-audit"], keywords: /vision|direction|identity|audience|overall|theme/i },
    { id: "vision-translator", name: "Vision Translator", summary: "Turns a felt or scattered vision into clear language, choices, and a first faithful next step.", domain: "vision translation", reasoningStyle: "clarifying, pattern-aware", tone: "grounded, encouraging", safety: "Reflects the creator's words back without claiming to know their calling or future.", skills: ["summarize", "outline", "task-plan"], keywords: /make it plain|put this into words|what am i trying to say|clarify my vision|scattered ideas/i },
    { id: "imagination-architect", name: "Imagination Architect", summary: "Expands bold, unusual ideas into coherent worlds and systems.", domain: "imagination", reasoningStyle: "expansive, combinatorial", tone: "playful, generative", safety: "Distinguishes creative invention from factual claims; never flattens bold ideas.", skills: ["brainstorm", "expand", "world-rule-build"], keywords: /imagine|what if|wild|invent|speculative|dream|concept/i },
    { id: "worldbuilding-master", name: "Worldbuilding Master", summary: "Geography, cultures, histories, technologies, factions, lore.", domain: "worldbuilding", reasoningStyle: "systemic, continuity-aware", tone: "immersive", safety: "Keeps fiction labeled as fiction.", skills: ["world-rule-build", "world-rule-check", "timeline-build"], keywords: /world|culture|lore|faction|geography|ecology/i },
    { id: "story-architect", name: "Story Architect", summary: "Plot, character arcs, themes, pacing, scenes, conflict.", domain: "story", reasoningStyle: "narrative structure", tone: "engaged", safety: "Suggests structure; never rewrites the manuscript unbidden.", skills: ["outline", "character-track", "scene-draft"], keywords: /plot|character|arc|pacing|scene|conflict|story/i },
    { id: "voice-guardian", name: "Voice Guardian", summary: "Learns and protects the creator's own voice.", domain: "voice", reasoningStyle: "close reading", tone: "faithful", safety: "Never claims perfect imitation; preserves raw language on request.", skills: ["rewrite-in-voice", "edit", "compare"], keywords: /voice|tone|sound like|style|authentic|my words/i },
    { id: "research-director", name: "Research Director", summary: "Plans questions, evidence needs, and verification workflows.", domain: "research", reasoningStyle: "methodical", tone: "rigorous", safety: "Separates known from assumed.", skills: ["hypothesis-design", "source-map", "interview-question-build"], keywords: /research plan|evidence|verify|methodology|study/i },
    { id: "scientific-researcher", name: "Scientific Researcher", summary: "Separates evidence tiers; checks methods, units, reproducibility.", domain: "science", reasoningStyle: "empirical, skeptical", tone: "precise", safety: "Never fabricates validation; flags speculation.", skills: ["equation-review", "unit-check", "experiment-plan"], keywords: /science|hypothesis|experiment|data|reproducib|units|variable/i },
    { id: "historical-researcher", name: "Historical Researcher", summary: "Timelines, source comparison, disputed accounts, anachronisms.", domain: "history", reasoningStyle: "source-critical", tone: "careful", safety: "Warns about anachronism and disputed sources.", skills: ["timeline-build", "compare", "source-map"], keywords: /history|historical|primary source|era|ancient/i },
    { id: "theological-researcher", name: "Biblical & Theological Researcher", summary: "Context, translation, interpretation, doctrinal differences.", domain: "theology", reasoningStyle: "interpretive, comparative", tone: "respectful", safety: "Presents no interpretation as uncontested; claims no divine authority.", skills: ["compare", "source-map", "classify"], keywords: /biblical|theolog|scripture|doctrine|passage|translation/i },
    { id: "philosophical-analyst", name: "Philosophical Analyst", summary: "Arguments, assumptions, counterarguments, definitions.", domain: "philosophy", reasoningStyle: "logical", tone: "measured", safety: "Names assumptions and counterarguments.", skills: ["compare", "contradiction-detect", "classify"], keywords: /philosoph|argument|assumption|logic|worldview|premise/i },
    { id: "investigative-researcher", name: "Investigative Researcher", summary: "Tracks claims, evidence, contradictions, source reliability.", domain: "investigation", reasoningStyle: "evidence-tracing", tone: "neutral", safety: "Respects privacy and legal boundaries.", skills: ["fact-check", "contradiction-detect", "source-map"], keywords: /investigat|reliab|records|allegation/i },
    { id: "invention-architect", name: "Invention Architect", summary: "Problems, needs, components, constraints, experiments, prototypes.", domain: "invention", reasoningStyle: "problem-first", tone: "practical", safety: "Never claims a device works without testing.", skills: ["experiment-plan", "task-plan", "project-audit"], keywords: /invent|device|prototype|component|mechanism|patent/i },
    { id: "systems-engineer", name: "Systems Engineer", summary: "Components, interfaces, dependencies, specs, failure modes.", domain: "engineering", reasoningStyle: "decompositional", tone: "exacting", safety: "Surfaces failure modes and constraints.", skills: ["task-plan", "compare", "project-audit"], keywords: /system|architecture|interface|dependency|spec|failure mode/i },
    { id: "product-strategist", name: "Product Strategist", summary: "Users, positioning, features, MVP scope, roadmaps.", domain: "product", reasoningStyle: "prioritization", tone: "focused", safety: "Labels assumptions and risks.", skills: ["outline", "task-plan", "compare"], keywords: /product|mvp|feature|roadmap|positioning|user need/i },
    { id: "business-builder", name: "Business Builder", summary: "Models, operations, pricing, customer journeys, growth.", domain: "business", reasoningStyle: "operational", tone: "grounded", safety: "Clearly labels financial assumptions.", skills: ["task-plan", "project-audit", "compare"], keywords: /business|revenue|pricing|operations|customer|growth|hire/i },
    { id: "game-director", name: "Game Director", summary: "Loops, mechanics, progression, economies, production scope.", domain: "games", reasoningStyle: "systems + player experience", tone: "energetic", safety: "Separates design intent from playtested fact.", skills: ["world-rule-build", "outline", "task-plan"], keywords: /game|gameplay|mechanic|level|progression|player|economy/i },
    { id: "film-tv-producer", name: "Film & TV Producer", summary: "Scripts, treatments, episodes, schedules, pitches.", domain: "film", reasoningStyle: "production-aware", tone: "cinematic", safety: "Labels budget and schedule as estimates.", skills: ["outline", "scene-draft", "task-plan"], keywords: /film|movie|television|episode|treatment|screenplay/i },
    { id: "podcast-producer", name: "Podcast Producer", summary: "Episodes, segments, questions, show flow, publishing.", domain: "podcast", reasoningStyle: "audience flow", tone: "conversational", safety: "Respects guest consent and rights.", skills: ["interview-question-build", "outline", "publish-preparation"], keywords: /podcast|episode|segment|host|show notes/i },
    { id: "music-creative", name: "Music Creative", summary: "Concepts, arrangement, recording, release strategy.", domain: "music", reasoningStyle: "aesthetic", tone: "expressive", safety: "Respects copyright and sampling limits.", skills: ["brainstorm", "task-plan", "publish-preparation"], keywords: /music|song|arrangement|album|track|lyric/i },
    { id: "editor", name: "Editor", summary: "Developmental, structural, line, and copy editing modes.", domain: "editing", reasoningStyle: "close, specific", tone: "constructive", safety: "Never silently rewrites a whole work.", skills: ["edit", "rewrite-in-voice", "contradiction-detect"], keywords: /edit|revise|tighten|proofread|line edit|copy edit/i },
    { id: "critic-red-team", name: "Critic & Red Team", summary: "Weak reasoning, contradictions, gaps, risks, plot holes.", domain: "critique", reasoningStyle: "adversarial but fair", tone: "honest, not dismissive", safety: "Critiques the work, not the person.", skills: ["contradiction-detect", "fact-check", "project-audit"], keywords: /critique|red team|weakness|risk|plot hole|flaw|challenge/i },
    { id: "continuity-keeper", name: "Continuity Keeper", summary: "Tracks names, dates, rules, versions, and contradictions.", domain: "continuity", reasoningStyle: "ledger-like", tone: "meticulous", safety: "Flags contradictions without inventing resolutions.", skills: ["world-rule-check", "character-track", "contradiction-detect"], keywords: /continuity|consistency|canon|version|track names/i },
    { id: "archivist", name: "Archivist", summary: "Preserves originals, versions, metadata, and provenance.", domain: "archive", reasoningStyle: "preservation-first", tone: "careful", safety: "Never alters originals.", skills: ["classify", "source-map", "project-audit"], keywords: /archive|preserve|provenance|metadata|original/i },
    { id: "connector", name: "Connector", summary: "Finds creator-approved bridges between ideas, projects, people, and next conversations.", domain: "connection", reasoningStyle: "relationship-mapping", tone: "warm, practical", safety: "Never invents relationships, endorsements, or introductions.", skills: ["compare", "cluster", "task-plan"], keywords: /connect|bridge|relationship|collaborator|who should|link these ideas/i },
    { id: "finisher", name: "Finisher", summary: "Breaks an approved body of work into the smallest steps needed to complete and release it.", domain: "completion", reasoningStyle: "sequence-first, constraint-aware", tone: "steady, motivating", safety: "Never mistakes a plan for completion or pressures the creator past capacity.", skills: ["task-plan", "project-audit", "publish-preparation"], keywords: /finish|complete|ship|deadline|stuck|what next|release/i },
    { id: "prompt-engineer", name: "Prompt Engineer", summary: "Designs reusable, bounded instructions for tools while keeping the creator in control.", domain: "prompting", reasoningStyle: "precise, testable", tone: "clear", safety: "Names tool limits, required context, and review points; never promises a model will be correct.", skills: ["simplify", "outline", "task-plan"], keywords: /prompt|instruction|ai workflow|system prompt|model/i },
    { id: "humble-guide", name: "Humble Guide", summary: "Offers a calm pause, questions, and one small next step when the work feels overwhelming.", domain: "creator care", reasoningStyle: "gentle, non-presumptive", tone: "compassionate", safety: "Never presents itself as a therapist, spiritual authority, or replacement for human support.", skills: ["simplify", "task-plan", "project-audit"], keywords: /overwhelmed|afraid|freeze|where do i start|too much|discouraged/i },
    { id: "teacher", name: "Teacher", summary: "Explains at adjustable levels; builds learning paths.", domain: "education", reasoningStyle: "scaffolded", tone: "encouraging", safety: "Never presents speculation as established fact.", skills: ["simplify", "outline", "compare"], keywords: /teach|explain|learn|course|lesson|beginner/i },
    { id: "collaboration-facilitator", name: "Collaboration Facilitator", summary: "Divides work, resolves versions, preserves attribution.", domain: "collaboration", reasoningStyle: "coordinative", tone: "fair", safety: "Preserves attribution and decisions.", skills: ["task-plan", "compare", "project-audit"], keywords: /collaborat|team|assign|attribution|decision|merge versions/i }
  ];
  var SKILLS = [
    { id: "summarize", name: "Summarize", category: "understand", description: "Condense material faithfully." },
    { id: "classify", name: "Classify", category: "understand", description: "Label items by type or evidence class." },
    { id: "cluster", name: "Cluster", category: "understand", description: "Group related material into themes." },
    { id: "outline", name: "Outline", category: "structure", description: "Propose a structure to accept or reject." },
    { id: "compare", name: "Compare", category: "understand", description: "Contrast options, sources, or versions." },
    { id: "fact-check", name: "Fact-check", category: "research", description: "Separate established from unverified claims." },
    { id: "source-map", name: "Source-map", category: "research", description: "Map claims to their sources." },
    { id: "citation-build", name: "Citation-build", category: "research", description: "Assemble citations from real sources only." },
    { id: "contradiction-detect", name: "Contradiction-detect", category: "review", description: "Find internal conflicts." },
    { id: "timeline-build", name: "Timeline-build", category: "structure", description: "Order events chronologically." },
    { id: "character-track", name: "Character-track", category: "structure", description: "Track characters, traits, and arcs." },
    { id: "world-rule-check", name: "World-rule-check", category: "review", description: "Check continuity against world rules." },
    { id: "equation-review", name: "Equation-review", category: "research", description: "Review equations, variables, and assumptions." },
    { id: "unit-check", name: "Unit-check", category: "research", description: "Check units and dimensional consistency." },
    { id: "hypothesis-design", name: "Hypothesis-design", category: "research", description: "Frame testable hypotheses." },
    { id: "experiment-plan", name: "Experiment-plan", category: "research", description: "Design experiments and controls." },
    { id: "interview-question-build", name: "Interview-questions", category: "research", description: "Draft interview or research questions." },
    { id: "chapter-draft", name: "Chapter-draft", category: "create", description: "Draft a chapter (labeled as a suggestion)." },
    { id: "scene-draft", name: "Scene-draft", category: "create", description: "Draft a scene (labeled as a suggestion)." },
    { id: "rewrite-in-voice", name: "Rewrite-in-voice", category: "create", description: "Offer edits that preserve the creator's voice." },
    { id: "edit", name: "Edit", category: "review", description: "Developmental, line, and copy edits." },
    { id: "brainstorm", name: "Brainstorm", category: "create", description: "Generate options without committing." },
    { id: "expand", name: "Expand", category: "create", description: "Develop an idea into more detail." },
    { id: "simplify", name: "Simplify", category: "understand", description: "Make complex material clearer." },
    { id: "visualize", name: "Visualize", category: "produce", description: "Describe a diagram, map, or board." },
    { id: "export", name: "Export", category: "produce", description: "Prepare content for a target format." },
    { id: "publish-preparation", name: "Publish-prep", category: "produce", description: "Ready work for publication." },
    { id: "task-plan", name: "Task-plan", category: "produce", description: "Break work into next actions." },
    { id: "project-audit", name: "Project-audit", category: "review", description: "Assess a project's state and gaps." },
    { id: "world-rule-build", name: "World-rule-build", category: "structure", description: "Define cultures, systems, and lore." }
  ];
  var P_BY = {}; PERSONAS.forEach(function (p) { P_BY[p.id] = p; });
  var S_BY = {}; SKILLS.forEach(function (s) { S_BY[s.id] = s; });
  var CATS = [["[EVIDENCE]", "evidence", "Evidence"], ["[INTERPRETATION]", "interpretation", "Interpretation"], ["[INFERENCE]", "inference", "Inference"], ["[SPECULATION]", "speculation", "Speculation"], ["[RECOMMENDATION]", "recommendation", "Recommendation"], ["[CREATIVE SUGGESTION]", "creative_suggestion", "Creative suggestion"], ["[GENERATED DRAFT]", "generated_draft", "Generated draft"]];
  var CAT_LABEL = {}; CATS.forEach(function (c) { CAT_LABEL[c[1]] = c[2]; });

  /** Deterministic routing (same rules as the original): your pins, else keyword match, else Creative Director + Editor. */
  function route(prompt, wisdom, pins, extraSkills) {
    var pinned = pins.map(function (id) { return P_BY[id]; }).filter(Boolean);
    var matched = pinned.length ? pinned : PERSONAS.filter(function (p) { return p.keywords.test(prompt); });
    var personas = (matched.length ? matched : [P_BY["creative-director"], P_BY.editor]).slice(0, 3);
    var ids = []; personas.forEach(function (p) { p.skills.forEach(function (s) { if (ids.indexOf(s) < 0) ids.push(s); }); });
    extraSkills.forEach(function (s) { if (ids.indexOf(s) < 0) ids.push(s); });
    return { personas: personas, skills: ids.map(function (id) { return S_BY[id]; }).filter(Boolean), wisdom: wisdom,
      rationale: pinned.length ? "You chose these personas directly." : matched.length ? "Routed by the language in your request." : "No specific domain matched, so the Creative Director and Editor responded." };
  }
  // The request leads (the Spaidbot endpoint answers the first thing it reads); compact instructions follow.
  function buildMessage(prompt, r, mode, ctxText) {
    var m = MODES.find(function (x) { return x.id === mode; }) || MODES[1];
    return [
      prompt,
      "",
      "Answer as Dream Board's Creative Companion in " + m.name + " mode (" + m.instruction + " Boundary: " + m.boundary + ")",
      "Personas: " + r.personas.map(function (p) { return p.name + " (" + p.summary + " Reasoning: " + p.reasoningStyle + ". Safety: " + p.safety + ")"; }).join("; ") + ".",
      "Skills: " + r.skills.map(function (s) { return s.name; }).join(", ") + ".",
      r.wisdom ? "Wisdom lens: frame reflection around purpose, long-term impact and the people affected; never claim divine authority or decide for the creator." : "",
      "Preserve the creator's authorship and voice; never claim to have changed their work; never invent sources, citations or results.",
      "Do not introduce yourself. Start every section line with exactly one label: [EVIDENCE] [INTERPRETATION] [INFERENCE] [SPECULATION] [RECOMMENDATION] [CREATIVE SUGGESTION] [GENERATED DRAFT]. Use [EVIDENCE] only for things present in the creator's material below.",
      ctxText ? "\nCreator's own material (one chapter excerpt they chose to share):\n" + ctxText : ""
    ].filter(function (x) { return x !== ""; }).join("\n");
  }
  function parseSegments(text) {
    var segs = [];
    String(text || "").split("\n").forEach(function (raw) {
      var line = raw.trim(); if (!line) return;
      var clean = line.replace(/^[*_#>\-\s]+/, "").replace(/^\*\*(\[[A-Z ]+\])\*\*/, "$1");
      var mk = CATS.find(function (c) { return clean.toUpperCase().indexOf(c[0]) === 0; });
      if (mk) segs.push({ category: mk[1], text: clean.slice(mk[0].length).replace(/^[\s:*]+/, "").trim() });
      else if (segs.length) segs[segs.length - 1].text += "\n" + line;
      else segs.push({ category: "interpretation", text: line });
    });
    return segs.filter(function (s) { return s.text.trim(); });
  }

  K.css("companion",
    ".cp-chips { display: flex; flex-wrap: wrap; gap: 6px; }" +
    ".cp-chips button { font-size: 12px; padding: 6px 11px; min-height: 34px; border-radius: 999px; border: 1px solid rgba(217,181,108,0.28); background: rgba(4,8,6,0.45); color: var(--cream-dim); cursor: pointer; }" +
    ".cp-chips button[aria-pressed=true], .cp-chips button[aria-checked=true] { color: #1b1407; background: linear-gradient(180deg, var(--gold-hi), var(--gold)); border-color: transparent; }" +
    ".cp-l { display: block; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--gold); margin: 14px 0 8px; }" +
    ".cp-toggle { display: flex; gap: 10px; align-items: center; font-size: 14px; color: var(--cream); cursor: pointer; }" +
    ".cp-toggle input { width: 20px; height: 20px; accent-color: var(--gold); }" +
    ".cp-out { border-left: 3px solid #9fc7e8; }" +
    ".cp-badge { display: inline-block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #9fc7e8; border: 1px solid rgba(159,199,232,0.5); border-radius: 999px; padding: 2px 10px; }" +
    ".cp-seg { padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(217,181,108,0.16); background: rgba(4,8,6,0.4); margin-top: 8px; }" +
    ".cp-seg b { display: block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 4px; }" +
    ".cp-seg p { margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 1.5; color: var(--cream); overflow-wrap: anywhere; }" +
    ".cp-seg.evidence b { color: var(--ok); } .cp-seg.interpretation b, .cp-seg.inference b { color: var(--gold-hi); } .cp-seg.speculation b { color: #e3b3e6; } .cp-seg.recommendation b { color: #9fc7e8; } .cp-seg.creative_suggestion b, .cp-seg.generated_draft b { color: #f2c2b4; }" +
    ".cp-busy { border-left: 3px solid var(--gold); padding: 10px 12px; border-radius: 10px; background: rgba(217,181,108,0.08); color: var(--cream); font-size: 14px; }" +
    ".cp-runs { display: grid; gap: 8px; }" +
    ".cp-run { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }" +
    ".cp-run button.open { all: unset; cursor: pointer; display: block; min-width: 0; }" +
    ".cp-run button.open b { display: block; color: var(--cream); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
    ".cp-reg { columns: 2 260px; column-gap: 18px; font-size: 13px; color: var(--cream-dim); }" +
    ".cp-reg div { break-inside: avoid; margin-bottom: 8px; } .cp-reg b { color: var(--gold-hi); font-weight: 500; }" +
    "details.bk-panel > summary { cursor: pointer; font-family: var(--serif); font-size: 21px; color: var(--gold-hi); }" +
    "@media (min-width: 821px) { .room .bk-work.cp-work { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }"
  );

  var S = null;

  function outputHtml() {
    if (S.status === "working") return '<p class="cp-busy">Asking Spaidbot… routed to ' + K.esc(S.lastRoute) + "</p>";
    if (S.status === "busy") return '<p class="cp-busy"><b>Spaidbot is busy right now.</b> Nothing was saved and nothing touched your writing. Try again in a moment — your request is still in the box.</p>';
    if (S.status === "error") return '<p class="cp-busy"><b>Spaidbot could not answer:</b> ' + K.esc(S.error) + ". Nothing was saved and nothing touched your writing.</p>";
    if (!S.current) return '<p class="bk-empty">Choose a working mode, then ask. Every answer is labelled by category and saved privately to your Passport.</p>';
    var r = S.current;
    var segs = (r.output && r.output.segments) || [];
    return '<div class="rm-row" style="margin-bottom:6px"><span class="cp-badge">Suggestion · not your words</span><span class="note">' + K.esc(r.selected_persona) + " · " + K.esc(((r.output && r.output.mode) || "").replace(/^./, function (c) { return c.toUpperCase(); })) + " · " + K.esc(K.fmtDay(r.created_at)) + "</span></div>" +
      '<p class="note" style="margin:0 0 4px">You asked: ' + K.esc(r.prompt.slice(0, 220)) + (r.prompt.length > 220 ? "…" : "") + "</p>" +
      segs.map(function (s) { return '<div class="cp-seg ' + K.esc(s.category) + '"><b>' + K.esc(CAT_LABEL[s.category] || s.category) + "</b><p>" + K.esc(s.text) + "</p></div>"; }).join("") +
      '<div class="rm-row" style="margin-top:12px"><button class="btn small" type="button" data-cp-act="copy">Copy suggestion</button><button class="btn small solid" type="button" data-cp-act="note">Save as research note</button></div>' +
      '<p class="note" style="margin-top:8px">Nothing is inserted into your writing. Copy it, or save it to your Knowledge Vault marked "Suggestion · not your words" — only when you click.</p>';
  }

  function render(el) {
    var mode = MODES.find(function (m) { return m.id === S.mode; });
    var pinnedNames = S.pins.map(function (id) { return P_BY[id].name; });
    var chOpts = '<option value="">Nothing — just my request</option>' + S.chapterOpts.map(function (o) { return '<option value="' + o.id + '"' + (S.ctxChapter === o.id ? " selected" : "") + ">" + K.esc(o.label) + "</option>"; }).join("");
    el.innerHTML = K.scene("Dream Board · Companion · Spaidbot", "Creative intelligence, under your direction.",
      "Routed to named personas and skills, answered through Spaidbot, and labelled line by line — evidence, interpretation, speculation, creative suggestion. It suggests; you write.",
      "art-hero-hill.jpg", '<a class="btn" href="#/r/knowledge">Knowledge Vault</a><a class="btn" href="#/book">Book Studio</a>') +
      '<div class="bk-work two cp-work">' +
      K.panel("Ask", "Only what you type — plus a chapter excerpt and its book's source names if you opt in — is sent to Spaidbot.",
        '<label class="sr-only" for="cp-prompt">Your request</label><textarea id="cp-prompt" class="bk-ta" style="min-height:130px;font-family:var(--sans);font-size:15px" maxlength="6000" placeholder="Ask about structure, voice, sources, or the next step…">' + K.esc(S.prompt) + "</textarea>" +
        '<span class="cp-l">Working mode</span><div class="cp-chips" role="radiogroup" aria-label="Working mode">' + MODES.map(function (m) { return '<button type="button" role="radio" data-cp-mode="' + m.id + '" aria-checked="' + (S.mode === m.id) + '" title="' + K.esc(m.description) + '">' + m.name + "</button>"; }).join("") + "</div>" +
        '<p class="note" style="margin:6px 0 0"><b>' + mode.name + ":</b> " + K.esc(mode.description) + " " + K.esc(mode.boundary) + "</p>" +
        '<span class="cp-l">Personas · pin up to 3, or let routing decide' + (pinnedNames.length ? " · " + K.esc(pinnedNames.join(", ")) : "") + '</span><div class="cp-chips" role="group" aria-label="Personas">' + PERSONAS.map(function (p) { return '<button type="button" data-cp-pin="' + p.id + '" aria-pressed="' + (S.pins.indexOf(p.id) >= 0) + '" title="' + K.esc(p.summary) + '">' + K.esc(p.name) + "</button>"; }).join("") + "</div>" +
        '<span class="cp-l">Extra skills (optional, up to 4)</span><div class="cp-chips" role="group" aria-label="Skills">' + SKILLS.map(function (s) { return '<button type="button" data-cp-skill="' + s.id + '" aria-pressed="' + (S.extra.indexOf(s.id) >= 0) + '" title="' + K.esc(s.description) + '">' + K.esc(s.name) + "</button>"; }).join("") + "</div>" +
        '<span class="cp-l">Share a chapter excerpt (your words, first ~2,000 characters)</span><select class="bk-in" data-cp="chapter">' + chOpts + "</select>" +
        '<label class="cp-toggle" style="margin-top:14px"><input type="checkbox" data-cp="sources"' + (S.withSources ? " checked" : "") + (S.ctxChapter ? "" : " disabled") + "> Also share that book\u2019s source list (file names and word counts only)</label>" +
        '<label class="cp-toggle" style="margin-top:10px"><input type="checkbox" data-cp="wisdom"' + (S.wisdom ? " checked" : "") + "> Wisdom mode — purpose, long-term impact, the people affected</label>" +
        '<div class="rm-row" style="margin-top:14px"><button class="btn solid" type="button" data-cp-act="ask"' + (S.status === "working" ? " disabled" : "") + ">" + (S.status === "working" ? "Asking…" : "Ask the Companion") + '</button><span class="note">Routing preview: ' + K.esc(S.preview) + "</span></div>") +
      K.panel("Review", "", outputHtml(), "cp-out") +
      "</div>" +
      '<div class="bk-work one">' +
      (S.runs === null ? K.setupNotice("Companion history", "dreamboard_companion_runs") :
        K.panel("Your companion history", "Private to your Passport. Open one to read it again; delete removes it for good.",
          S.runs.length ? '<div class="cp-runs">' + S.runs.map(function (r) { return '<div class="rm-item cp-run"><button class="open" type="button" data-cp-open="' + r.id + '"><b>' + K.esc(r.prompt.slice(0, 120)) + '</b><span class="rm-meta">' + K.esc(r.selected_persona) + " · " + K.esc(K.fmtDay(r.created_at)) + '</span></button><button class="btn small" type="button" data-cp-del="' + r.id + '">Delete</button></div>'; }).join("") + "</div>" : '<p class="bk-empty">No companion requests yet.</p>')) +
      '<details class="bk-panel"><summary>Persona &amp; skill registry · ' + PERSONAS.length + " personas · " + SKILLS.length + ' skills</summary><p class="sub" style="margin-top:8px">Each persona is a declared configuration — role, reasoning style, tone and a safety rule — not a person. Routing is deterministic: your pins, else keywords in your request.</p>' +
      '<div class="cp-reg">' + PERSONAS.map(function (p) { return "<div><b>" + K.esc(p.name) + "</b> — " + K.esc(p.summary) + ' <span class="rm-meta">Safety: ' + K.esc(p.safety) + "</span></div>"; }).join("") + "</div>" +
      '<div class="cp-reg" style="margin-top:12px">' + SKILLS.map(function (s) { return "<div><b>" + K.esc(s.name) + "</b> · " + K.esc(s.category) + " — " + K.esc(s.description) + "</div>"; }).join("") + "</div></details>" +
      "</div>";
  }

  function updatePreview(el) {
    var r = route(S.prompt, S.wisdom, S.pins, S.extra);
    S.preview = r.personas.map(function (p) { return p.name; }).join(" + ") + " · " + r.skills.length + " skills";
    var btn = el.querySelector('[data-cp-act="ask"]');
    if (btn && btn.nextElementSibling) btn.nextElementSibling.textContent = "Routing preview: " + S.preview;
  }

  async function excerpt(chId) {
    if (!chId) return "";
    var rows = await K.q(K.sb.from("dreamboard_book_passages").select("body,position,seq").eq("chapter_id", chId).eq("speaker", "author").order("position", { ascending: true }).order("seq", { ascending: true }).limit(40));
    var t = rows.map(function (p) { return p.body; }).join("\n\n");
    return t.slice(0, 2000);
  }

  /** Opt-in only: the names of the creator's imported source files for the shared chapter's book (no contents leave the device). */
  async function sourceList(chId) {
    var o = S.chapterOpts.find(function (x) { return x.id === chId; }); if (!o) return "";
    try {
      var rows = await K.q(K.sb.from("dreamboard_book_sources").select("name,kind,words").eq("book_id", o.book_id).order("imported_at", { ascending: true }).limit(40));
      return rows.map(function (r) { return "- " + r.name + (r.kind ? " (" + r.kind + ")" : "") + (r.words ? " · " + r.words + " words" : ""); }).join("\n");
    } catch (e) { return ""; }
  }

  async function ask(el) {
    var clean = S.prompt.trim();
    if (!clean) { K.toast("Type a request first.", true); return; }
    var r = route(clean, S.wisdom, S.pins, S.extra);
    S.lastRoute = r.personas.map(function (p) { return p.name; }).join(" + ") + " · " + r.skills.length + " skills";
    S.status = "working"; render(el);
    try {
      var ctxText = await excerpt(S.ctxChapter);
      var srcText = S.withSources && S.ctxChapter ? await sourceList(S.ctxChapter) : "";
      if (srcText) ctxText = (ctxText ? ctxText + "\n\n" : "") + "The creator's own source files for this book (names only, not their contents):\n" + srcText;
      var res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: buildMessage(clean, r, S.mode, ctxText) }], product: "ath" }) });
      var data = null; try { data = await res.json(); } catch (x2) { data = null; }
      if (res.status === 503 || (data && data.retry)) { S.status = "busy"; render(el); return; }
      if (!res.ok || !data || !data.reply) { S.status = "error"; S.error = (data && (data.error || data.message)) || ("HTTP " + res.status); render(el); return; }
      var segs = parseSegments(data.reply);
      var model = null; try { (data.provenance.executed || []).forEach(function (e) { if (e.kind === "model" && e.runtime) model = e.runtime; }); } catch (x3) { /* optional */ }
      var row = { prompt: clean.slice(0, 12000), selected_skills: r.skills.map(function (s) { return s.name; }), selected_persona: r.personas.map(function (p) { return p.name; }).join(" + "), wisdom_enabled: !!S.wisdom,
        output: { segments: segs, mode: S.mode, rationale: r.rationale, sharedChapter: S.ctxChapter || null, label: "Suggestion · not your words", provenance: "Human material: your request" + (S.ctxChapter ? " and one chapter excerpt you chose" : "") + (S.withSources && S.ctxChapter ? " plus that book's source file names" : "") + ". AI contribution: Spaidbot reply, labelled by category." },
        provider: "spaidbot", model: model ? String(model).slice(0, 200) : null, status: "complete" };
      if (S.runs !== null) {
        try { var saved = await K.insert("dreamboard_companion_runs", row); S.runs.unshift(saved); S.current = saved; }
        catch (err) { if (K.missingTable(err)) S.runs = null; S.current = Object.assign({ id: null, created_at: new Date().toISOString() }, row); K.toast("The answer is shown; it could not be saved to your history: " + err.message, true); }
      } else S.current = Object.assign({ id: null, created_at: new Date().toISOString() }, row);
      S.status = "ready"; render(el);
    } catch (err) { S.status = "error"; S.error = err.message || String(err); render(el); }
  }

  function labelledText(r) {
    var segs = (r.output && r.output.segments) || [];
    return "Suggestion · not your words — Dream Board Companion via Spaidbot (" + r.selected_persona + ", " + K.fmtDay(r.created_at) + ")\nYou asked: " + r.prompt + "\n\n" +
      segs.map(function (s) { return "[" + (CAT_LABEL[s.category] || s.category).toUpperCase() + "] " + s.text; }).join("\n\n");
  }

  DBRoom.register("companion", {
    mount: async function (el) {
      S = { prompt: "", mode: "build", pins: [], extra: [], wisdom: false, withSources: false, ctxChapter: "", chapterOpts: [], status: "idle", error: "", current: null, runs: [], preview: "", lastRoute: "" };
      el.innerHTML = '<p class="loading">Opening the Companion…</p>';
      try { S.runs = await K.list("dreamboard_companion_runs", { select: "id,prompt,selected_skills,selected_persona,wisdom_enabled,output,provider,model,status,created_at", order: "created_at", limit: 30 }); }
      catch (e) { if (K.missingTable(e)) S.runs = null; else throw e; }
      try { var prof = await K.q(K.sb.from("dreamboard_profiles").select("wisdom_mode").eq("id", K.uid()).maybeSingle()); S.wisdom = !!(prof && prof.wisdom_mode); } catch (e) { /* default off */ }
      try {
        var books = await K.list("dreamboard_books", { select: "id,title,updated_at", order: "updated_at", limit: 20 });
        if (books.length) {
          var chs = await K.q(K.sb.from("dreamboard_book_chapters").select("id,title,position,book_id").in("book_id", books.map(function (b) { return b.id; })).order("position", { ascending: true }).limit(400));
          books.forEach(function (b) { chs.filter(function (c) { return c.book_id === b.id; }).forEach(function (c, i) { S.chapterOpts.push({ id: c.id, book_id: b.id, label: (b.title || "Untitled").slice(0, 40) + " · " + (i + 1) + ". " + (c.title || "Untitled").slice(0, 50) }); }); });
        }
      } catch (e) { /* no Book Studio: excerpt option just stays empty */ }
      updatePreview(el); render(el);

      el.addEventListener("input", function (e) { if (e.target.id === "cp-prompt") { S.prompt = e.target.value; updatePreview(el); } });
      el.addEventListener("change", function (e) {
        var k = e.target.dataset.cp;
        if (k === "chapter") { S.ctxChapter = e.target.value; var sw = el.querySelector('[data-cp="sources"]'); if (sw) sw.disabled = !S.ctxChapter; }
        else if (k === "sources") S.withSources = e.target.checked;
        else if (k === "wisdom") { S.wisdom = e.target.checked; updatePreview(el); }
      });
      el.addEventListener("click", async function (e) {
        var b = e.target.closest("button"); if (!b || !el.contains(b)) return;
        var d = b.dataset;
        if (d.cpMode) { S.mode = d.cpMode; render(el); }
        else if (d.cpPin) { var i = S.pins.indexOf(d.cpPin); if (i >= 0) S.pins.splice(i, 1); else if (S.pins.length < 3) S.pins.push(d.cpPin); else { K.toast("Up to three personas — unpin one first."); return; } updatePreview(el); render(el); }
        else if (d.cpSkill) { var j = S.extra.indexOf(d.cpSkill); if (j >= 0) S.extra.splice(j, 1); else if (S.extra.length < 4) S.extra.push(d.cpSkill); else { K.toast("Up to four extra skills."); return; } updatePreview(el); render(el); }
        else if (d.cpAct === "ask") await ask(el);
        else if (d.cpAct === "copy" && S.current) {
          try { await navigator.clipboard.writeText(labelledText(S.current)); K.toast("Copied, with its “not your words” label. Paste it wherever you decide it belongs."); }
          catch (err) { K.toast("Copy was blocked by the browser: " + err.message, true); }
        }
        else if (d.cpAct === "note" && S.current) {
          try {
            await K.insert("dreamboard_vault_entries", { title: ("Companion suggestion · " + S.current.prompt).slice(0, 240), content: labelledText(S.current), source_type: "research", status: "inbox", tags: ["companion", "spaidbot", "suggestion-not-my-words"] });
            K.toast("Saved to your Knowledge Vault inbox as a research note, labelled “Suggestion · not your words”.");
          } catch (err) { K.toast("The note could not save: " + err.message, true); }
        }
        else if (d.cpOpen) { S.current = S.runs.find(function (r) { return r.id === d.cpOpen; }) || null; S.status = "ready"; render(el); var o = el.querySelector(".cp-out"); if (o) o.scrollIntoView({ block: "start", behavior: "smooth" }); }
        else if (d.cpDel) {
          if (!window.confirm("Delete this companion request from your history? This cannot be undone.")) return;
          try { await K.remove("dreamboard_companion_runs", d.cpDel); S.runs = S.runs.filter(function (r) { return r.id !== d.cpDel; }); if (S.current && S.current.id === d.cpDel) S.current = null; render(el); K.toast("Deleted."); }
          catch (err) { K.toast("Could not delete: " + err.message, true); }
        }
      });
    }
  });
})();
