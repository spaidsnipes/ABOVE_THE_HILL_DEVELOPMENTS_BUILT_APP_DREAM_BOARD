// Creative Companion foundation: typed skills, working modes, deterministic
// routing, context assembly, and honestly-labeled output categories.
// The Companion reviews and suggests; it never silently changes the work.

export type OutputCategory = "evidence" | "interpretation" | "inference" | "speculation" | "recommendation" | "creative_suggestion" | "generated_draft";
export type OutputSegment = { category: OutputCategory; text: string };

export type CompanionSkill = { id: string; name: string; description: string; keywords: RegExp; instruction: string };
export type WorkingMode = { id: string; name: string; description: string; instruction: string };

export const COMPANION_SKILLS: CompanionSkill[] = [
  { id: "capture", name: "Capture Assistant", description: "Turns raw thoughts into clear, keepable captures.", keywords: /capture|idea|note|remember|jot/i, instruction: "Help the creator state the idea clearly and suggest a title and status for their Vision Vault. Do not embellish the idea." },
  { id: "organizer", name: "Organizer", description: "Finds structure in existing material.", keywords: /organi[sz]e|sort|group|theme|cluster|tag/i, instruction: "Group the provided material into candidate themes. Only reference material actually provided; never invent sources." },
  { id: "researcher", name: "Researcher", description: "Frames questions and evaluates sources.", keywords: /research|source|fact|evidence|cite|verify/i, instruction: "Identify what is established by the provided sources versus what still needs verification. Mark unverified claims clearly." },
  { id: "outline", name: "Outline Builder", description: "Shapes chapters and structure on request.", keywords: /outline|structure|chapter|arc|order/i, instruction: "Propose structure as suggestions the creator can accept or reject chapter by chapter. Never present a suggested outline as decided." },
  { id: "writing", name: "Writing Assistant", description: "Helps the draft move forward.", keywords: /write|draft|continue|scene|paragraph|stuck/i, instruction: "Offer concrete, small next-writing moves grounded in the draft excerpt. Any example prose must be labeled as a creative suggestion." },
  { id: "voice", name: "Voice Keeper", description: "Protects the creator's own voice.", keywords: /voice|tone|sound|style|authentic/i, instruction: "Describe the voice you observe in the excerpt and flag suggestions that would drift from it. Preserve, never replace, the creator's phrasing." },
  { id: "editor", name: "Editor", description: "Reviews for clarity and consistency.", keywords: /edit|revise|clarity|grammar|tighten|cut/i, instruction: "Point to specific reviewable edits with reasons. Do not rewrite wholesale." },
  { id: "architect", name: "Project Architect", description: "Thinks in systems and milestones.", keywords: /project|plan|milestone|scope|roadmap/i, instruction: "Relate advice to the project's stated mission and definition of done when provided." },
  { id: "finisher", name: "Finishing Coach", description: "Moves work toward honest completion.", keywords: /finish|complete|done|ship|publish|stuck/i, instruction: "Identify the smallest faithful step toward the stated definition of done. Resist scope growth." },
  { id: "connector", name: "Graph Connector", description: "Surfaces possible relationships for review.", keywords: /connect|relate|link|pattern|thread/i, instruction: "Suggest possible connections between provided items as suggestions requiring the creator's confirmation — never as facts." },
];

export const WORKING_MODES: WorkingMode[] = [
  { id: "guide", name: "The Humble Guide", description: "Steady, plain, encouraging.", instruction: "Be plain, warm, and brief. Ask at most one clarifying question." },
  { id: "finisher", name: "The Finisher", description: "Focused on the next faithful step.", instruction: "Bias toward the smallest completable action. No new scope." },
  { id: "researcher", name: "The Researcher", description: "Careful with claims and sources.", instruction: "Separate what is known from what is assumed. Flag anything unverifiable." },
  { id: "strategist", name: "The Strategist", description: "Long-view, trade-off aware.", instruction: "Name the trade-offs explicitly and recommend one path." },
  { id: "editor", name: "The Editor", description: "Precise, line-level attention.", instruction: "Be specific to the text provided; quote the exact words you are commenting on." },
  { id: "prayerful", name: "The Prayerful", description: "Purpose and people first (wisdom mode).", instruction: "Frame reflection around purpose, long-term impact, and the people affected. Never claim divine authority or make the choice for the creator." },
];

export type CompanionRoute = { skills: CompanionSkill[]; mode: WorkingMode; rationale: string };

export function routeRequest(prompt: string, wisdomEnabled: boolean, pinnedSkillIds: string[] = []): CompanionRoute {
  const pinned = COMPANION_SKILLS.filter(skill => pinnedSkillIds.includes(skill.id));
  const matched = pinned.length ? pinned : COMPANION_SKILLS.filter(skill => skill.keywords.test(prompt));
  const skills = (matched.length ? matched : [COMPANION_SKILLS[0], COMPANION_SKILLS[1]]).slice(0, 3);
  const mode = wisdomEnabled ? WORKING_MODES.find(m => m.id === "prayerful")! :
    /finish|stuck|done|ship/i.test(prompt) ? WORKING_MODES.find(m => m.id === "finisher")! :
    /research|source|fact/i.test(prompt) ? WORKING_MODES.find(m => m.id === "researcher")! :
    /edit|revise|tighten/i.test(prompt) ? WORKING_MODES.find(m => m.id === "editor")! :
    WORKING_MODES[0];
  const rationale = pinned.length ? "You chose these skills directly." : matched.length ? "Routed by keywords in your request." : "No specific keywords matched, so the general capture and organizing skills responded.";
  return { skills, mode, rationale };
}

export type CompanionContext = { projectTitle: string | null; chapterTitle: string | null; draftExcerpt: string; sources: Array<{ title: string; excerpt: string }> };

const CATEGORY_MARKERS: Array<[string, OutputCategory]> = [
  ["[EVIDENCE]", "evidence"], ["[INTERPRETATION]", "interpretation"], ["[INFERENCE]", "inference"],
  ["[SPECULATION]", "speculation"], ["[RECOMMENDATION]", "recommendation"],
  ["[CREATIVE SUGGESTION]", "creative_suggestion"], ["[GENERATED DRAFT]", "generated_draft"],
];

export function buildMessages(prompt: string, route: CompanionRoute, context: CompanionContext): { system: string; user: string } {
  const system = [
    "You are Dreamboard's Creative Companion. You help the creator think, organize, and improve clarity while preserving their authorship and voice. You never claim to have changed their work and never invent source material.",
    `Active skills: ${route.skills.map(skill => `${skill.name} — ${skill.instruction}`).join(" | ")}`,
    `Working mode: ${route.mode.name} — ${route.mode.instruction}`,
    "Label every section of your reply by starting its line with exactly one of: [EVIDENCE] [INTERPRETATION] [INFERENCE] [SPECULATION] [RECOMMENDATION] [CREATIVE SUGGESTION] [GENERATED DRAFT]. Only use [EVIDENCE] for things directly present in the provided material.",
  ].join("\n");
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
  segments.push({ category: "evidence", text: `Your request was routed to ${route.skills.map(skill => skill.name).join(", ")} in ${route.mode.name} mode. ${route.rationale}` });
  if (context.draftExcerpt) segments.push({ category: "evidence", text: `Your current draft holds ${context.draftExcerpt.trim().split(/\s+/).length.toLocaleString()} words in the provided excerpt${context.chapterTitle ? ` of “${context.chapterTitle}”` : ""}.` });
  if (context.sources.length) segments.push({ category: "recommendation", text: `Revisit your own material first: ${context.sources.map(source => `“${source.title}”`).join(", ")}.` });
  segments.push({ category: "recommendation", text: route.skills.some(skill => skill.id === "finisher") ? "Name the single smallest step that moves this toward done, then take only that step." : "Name the one sentence your reader should carry away, then make the next edit serve it." });
  segments.push({ category: "interpretation", text: "This is Dreamboard's local framework — deterministic routing and prompts only, with no generative model connected. Connect a provider in Vercel (AI_BASE_URL, AI_API_KEY, AI_MODEL) for generative review." });
  return segments;
}
