// Universal project templates. Each type maps to a tool/view set so a project
// configures its workspace without siloing data into incompatible shapes.
// The type slug is stored in dreamboard_projects.kind; custom types set
// kind='custom' with a custom_type_label. Templates are code, not data —
// they describe UI, not storage.

export type ToolKey =
  | "capture"      // quick capture of ideas
  | "sources"      // knowledge/source library
  | "outline"      // structure / book architect
  | "writing"      // writing studio
  | "research"     // research workspace (questions, claims, evidence)
  | "equations"    // equation lab
  | "worldbuilding"// world rules, cultures, lore
  | "storyboard"   // scenes / panels / visual composition
  | "audio"        // narration / episodes / recordings
  | "business"     // model, roadmap, operations
  | "graph"        // creative graph / entity connections
  | "timeline"     // chronology
  | "export";      // publishing / export

export type ProjectTemplate = {
  slug: string;
  label: string;
  icon: string;
  description: string;
  tools: ToolKey[];
};

// Tools every project gets regardless of type.
export const BASE_TOOLS: ToolKey[] = ["capture", "sources", "graph", "timeline", "export"];

const withBase = (tools: ToolKey[]): ToolKey[] => Array.from(new Set([...BASE_TOOLS, ...tools]));

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  { slug: "book", label: "Book", icon: "✦", description: "Long-form writing with chapters, drafts, and versions.", tools: withBase(["outline", "writing"]) },
  { slug: "research", label: "Research Project", icon: "⌕", description: "Questions, claims, evidence, sources, and citations.", tools: withBase(["research", "writing"]) },
  { slug: "invention", label: "Invention", icon: "⚙", description: "Problems, components, constraints, experiments, and documentation.", tools: withBase(["research", "equations", "writing"]) },
  { slug: "device", label: "Device Concept", icon: "▣", description: "System concepts, specifications, and validation status.", tools: withBase(["research", "equations"]) },
  { slug: "film", label: "Film", icon: "▤", description: "Script, treatment, scenes, and production notes.", tools: withBase(["outline", "writing", "storyboard"]) },
  { slug: "series", label: "Television Series", icon: "▦", description: "Episodes, arcs, and season structure.", tools: withBase(["outline", "writing", "storyboard"]) },
  { slug: "podcast", label: "Podcast", icon: "◉", description: "Episodes, segments, questions, and recordings.", tools: withBase(["outline", "audio", "writing"]) },
  { slug: "game", label: "Game", icon: "◈", description: "Mechanics, worlds, progression, and production scope.", tools: withBase(["worldbuilding", "outline", "storyboard"]) },
  { slug: "world", label: "Virtual World", icon: "◍", description: "Geography, cultures, histories, rules, and lore.", tools: withBase(["worldbuilding", "writing"]) },
  { slug: "comic", label: "Comic", icon: "❏", description: "Panels, script-to-panel planning, and character sheets.", tools: withBase(["storyboard", "outline", "writing"]) },
  { slug: "music", label: "Music Project", icon: "♪", description: "Concepts, arrangements, recording, and release plans.", tools: withBase(["audio", "writing"]) },
  { slug: "art", label: "Visual Art Project", icon: "◐", description: "Image boards, references, and composition.", tools: withBase(["storyboard"]) },
  { slug: "business", label: "Business", icon: "◆", description: "Model, operations, roadmap, and growth.", tools: withBase(["business", "research", "writing"]) },
  { slug: "nonprofit", label: "Nonprofit", icon: "♥", description: "Mission, programs, and operations.", tools: withBase(["business", "writing"]) },
  { slug: "course", label: "Course", icon: "❖", description: "Learning paths, modules, and materials.", tools: withBase(["outline", "writing"]) },
  { slug: "archive", label: "Personal Archive", icon: "▥", description: "Preserve materials, versions, and provenance.", tools: withBase([]) },
  { slug: "family", label: "Family Legacy", icon: "❦", description: "Family history, people, places, and events.", tools: withBase(["writing"]) },
  { slug: "poetry", label: "Poetry Collection", icon: "❧", description: "Poems, sequences, and revisions.", tools: withBase(["writing"]) },
  { slug: "general", label: "General Creative Project", icon: "✧", description: "A flexible workspace for any idea.", tools: withBase(["outline", "writing", "research"]) },
];

const BY_SLUG: Record<string, ProjectTemplate> = Object.fromEntries(PROJECT_TEMPLATES.map(template => [template.slug, template]));

// Legacy slugs from the earlier 14-type list map onto the universal set so
// existing projects keep a valid template.
const LEGACY_ALIASES: Record<string, string> = { memoir: "book", script: "film", application: "invention", website: "business" };

export function templateForKind(kind: string, customLabel?: string | null): ProjectTemplate {
  const slug = LEGACY_ALIASES[kind] || kind;
  if (BY_SLUG[slug]) return BY_SLUG[slug];
  // Unknown slug => custom project type.
  return { slug: kind || "custom", label: customLabel?.trim() || "Custom Project", icon: "✺", description: "A creator-defined project type.", tools: withBase(["outline", "writing", "research"]) };
}

export function projectToolset(kind: string, customLabel?: string | null): ToolKey[] {
  return templateForKind(kind, customLabel).tools;
}
