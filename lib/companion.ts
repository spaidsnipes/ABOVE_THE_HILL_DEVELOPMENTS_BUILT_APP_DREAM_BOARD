// Creative Companion: a transparent persona + skill architecture. A persona is
// not a fake consciousness — it is a declared configuration (role, domain,
// reasoning style, tone, skills, safety). Personas are composable; the active
// personas are always shown to the creator. Output is labeled by category so
// evidence is never confused with speculation, and the Companion reviews and
// suggests but never silently changes the work.

export type OutputCategory = "evidence" | "interpretation" | "inference" | "speculation" | "recommendation" | "creative_suggestion" | "generated_draft";
export type OutputSegment = { category: OutputCategory; text: string };

// ── Skills: reusable capabilities personas draw on ──────────────────────────
export type SkillCategory = "understand" | "structure" | "research" | "create" | "review" | "produce";
export type Skill = { id: string; name: string; category: SkillCategory; description: string };

export const SKILLS: Skill[] = [
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
  { id: "world-rule-build", name: "World-rule-build", category: "structure", description: "Define cultures, systems, and lore." },
];
const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map(skill => [skill.id, skill]));

// ── Personas: 25 transparent master configurations ──────────────────────────
export type Persona = {
  id: string;
  name: string;
  summary: string;
  domain: string;
  reasoningStyle: string;
  tone: string;
  safety: string;
  skills: string[];
  keywords: RegExp;
};

export const MASTER_PERSONAS: Persona[] = [
  { id: "creative-director", name: "Creative Director", summary: "Overall vision, emotional direction, and project identity.", domain: "vision", reasoningStyle: "big-picture, audience-first", tone: "inspiring, decisive", safety: "Serves the creator's intent, never overrides it.", skills: ["brainstorm", "outline", "project-audit"], keywords: /vision|direction|identity|audience|overall|theme/i },
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
  { id: "teacher", name: "Teacher", summary: "Explains at adjustable levels; builds learning paths.", domain: "education", reasoningStyle: "scaffolded", tone: "encouraging", safety: "Never presents speculation as established fact.", skills: ["simplify", "outline", "compare"], keywords: /teach|explain|learn|course|lesson|beginner/i },
  { id: "collaboration-facilitator", name: "Collaboration Facilitator", summary: "Divides work, resolves versions, preserves attribution.", domain: "collaboration", reasoningStyle: "coordinative", tone: "fair", safety: "Preserves attribution and decisions.", skills: ["task-plan", "compare", "project-audit"], keywords: /collaborat|team|assign|attribution|decision|merge versions/i },
];
const PERSONA_BY_ID: Record<string, Persona> = Object.fromEntries(MASTER_PERSONAS.map(persona => [persona.id, persona]));

export type CompanionRoute = { personas: Persona[]; skills: Skill[]; wisdom: boolean; rationale: string };

export function routeRequest(prompt: string, wisdomEnabled: boolean, pinnedPersonaIds: string[] = []): CompanionRoute {
  const pinned = pinnedPersonaIds.map(id => PERSONA_BY_ID[id]).filter(Boolean);
  const matched = pinned.length ? pinned : MASTER_PERSONAS.filter(persona => persona.keywords.test(prompt));
  const personas = (matched.length ? matched : [PERSONA_BY_ID["creative-director"], PERSONA_BY_ID["editor"]]).slice(0, 3);
  const skillIds = Array.from(new Set(personas.flatMap(persona => persona.skills)));
  const skills = skillIds.map(id => SKILL_BY_ID[id]).filter(Boolean);
  const rationale = pinned.length ? "You chose these personas directly." : matched.length ? "Routed by the language in your request." : "No specific domain matched, so the Creative Director and Editor responded.";
  return { personas, skills, wisdom: wisdomEnabled, rationale };
}

export type CompanionContext = { projectTitle: string | null; chapterTitle: string | null; draftExcerpt: string; sources: Array<{ title: string; excerpt: string }>; projectInstructions?: string; writingVoice?: string };

const CATEGORY_MARKERS: Array<[string, OutputCategory]> = [
  ["[EVIDENCE]", "evidence"], ["[INTERPRETATION]", "interpretation"], ["[INFERENCE]", "inference"],
  ["[SPECULATION]", "speculation"], ["[RECOMMENDATION]", "recommendation"],
  ["[CREATIVE SUGGESTION]", "creative_suggestion"], ["[GENERATED DRAFT]", "generated_draft"],
];

export function buildMessages(prompt: string, route: CompanionRoute, context: CompanionContext): { system: string; user: string } {
  const system = [
    "You are Dreamboard's Creative Companion. You help the creator think, organize, and improve clarity while preserving their authorship and voice. You never claim to have changed their work and never invent source material.",
    `Active personas (composed): ${route.personas.map(persona => `${persona.name} — ${persona.summary} Reasoning: ${persona.reasoningStyle}. Safety: ${persona.safety}`).join(" | ")}`,
    `Available skills: ${route.skills.map(skill => skill.name).join(", ")}.`,
    route.wisdom ? "Wisdom lens: frame reflection around purpose, long-term impact, and the people affected. Never claim divine authority or make the choice for the creator." : "",
    context.projectInstructions ? `Project instructions from the creator: ${context.projectInstructions}` : "",
    context.writingVoice ? `Preserve this project's writing voice: ${context.writingVoice}` : "",
    "When multiple personas contribute, attribute which persona is speaking when it helps. Label every section of your reply by starting its line with exactly one of: [EVIDENCE] [INTERPRETATION] [INFERENCE] [SPECULATION] [RECOMMENDATION] [CREATIVE SUGGESTION] [GENERATED DRAFT]. Use [EVIDENCE] only for things directly present in the provided material.",
  ].filter(Boolean).join("\n");
  const user = [
    prompt,
    context.projectTitle ? `\nProject: ${context.projectTitle}` : "",
    context.chapterTitle ? `Active chapter: ${context.chapterTitle}` : "",
    context.draftExcerpt ? `\nDraft excerpt:\n${context.draftExcerpt.slice(0, 2200)}` : "",
    context.sources.length ? `\nCreator's own sources:\n${context.sources.map(source => `- ${source.title}: ${source.excerpt.slice(0, 240)}`).join("\n")}` : "",
  ].join("\n");
  return { system, user };
}

export function parseSegments(text: string): OutputSegment[] {
  const segments: OutputSegment[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const marker = CATEGORY_MARKERS.find(([prefix]) => line.toUpperCase().startsWith(prefix));
    if (marker) segments.push({ category: marker[1], text: line.slice(marker[0].length).trim() });
    else if (segments.length) segments[segments.length - 1].text += `\n${line}`;
    else segments.push({ category: "interpretation", text: line });
  }
  return segments.filter(segment => segment.text.trim());
}

// Deterministic fallback when no model provider is connected. It routes,
// reflects real context back, and says exactly what it is.
export function localFramework(prompt: string, route: CompanionRoute, context: CompanionContext): OutputSegment[] {
  const segments: OutputSegment[] = [];
  segments.push({ category: "evidence", text: `Routed to ${route.personas.map(persona => persona.name).join(" + ")} drawing on ${route.skills.slice(0, 5).map(skill => skill.name).join(", ")}. ${route.rationale}` });
  if (context.projectInstructions) segments.push({ category: "evidence", text: `Applying this project's instructions: ${context.projectInstructions.slice(0, 160)}` });
  if (context.draftExcerpt) segments.push({ category: "evidence", text: `Your draft holds ${context.draftExcerpt.trim().split(/\s+/).length.toLocaleString()} words in the provided excerpt${context.chapterTitle ? ` of "${context.chapterTitle}"` : ""}.` });
  if (context.sources.length) segments.push({ category: "recommendation", text: `Ground the work in your own material first: ${context.sources.map(source => `"${source.title}"`).join(", ")}.` });
  const lead = route.personas[0];
  segments.push({ category: "recommendation", text: lead?.id === "critic-red-team" ? "Name the single weakest assumption in this work and test it before anything else." : (lead?.domain === "research" || lead?.domain === "science") ? "State which claims are established versus still to be verified, then design the smallest test." : "Name the one thing your audience should carry away, then make the next move serve it." });
  segments.push({ category: "interpretation", text: `${route.personas.length} persona${route.personas.length === 1 ? "" : "s"} active. This is Dreamboard's local framework — deterministic routing only, no generative model connected. Add AI_BASE_URL, AI_API_KEY, and AI_MODEL in the hosted environment for generative review.` });
  return segments;
}
