export const MEMORY_SCOPES = ["conversation", "workspace_item", "project", "active_context", "creator"] as const;
export const MEMORY_CATEGORIES = ["purpose", "preference", "voice", "person", "place", "canon_fact", "research_conclusion", "unresolved_question", "sensitive_exclusion", "ai_preference", "collaboration_rule"] as const;

export type MemoryScope = typeof MEMORY_SCOPES[number];
export type MemoryCategory = typeof MEMORY_CATEGORIES[number];

export type MemoryDraft = {
  content: string;
  scope: MemoryScope;
  category: MemoryCategory;
  sourceLabel: string;
  sourceType: "creator" | "import" | "companion" | "workspace";
  inferred: boolean;
  sensitive: boolean;
  sensitiveConsent: boolean;
};

export const MEMORY_SCOPE_LABELS: Record<MemoryScope, string> = {
  conversation: "Current conversation",
  workspace_item: "Current workspace item",
  project: "Current project",
  active_context: "Active Context projects",
  creator: "Creator-wide (explicitly enabled)",
};

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  purpose: "Project purpose",
  preference: "Creator preference",
  voice: "Voice guidance",
  person: "Important person",
  place: "Important place",
  canon_fact: "Canon fact",
  research_conclusion: "Research conclusion",
  unresolved_question: "Unresolved question",
  sensitive_exclusion: "Sensitive exclusion",
  ai_preference: "AI behavior preference",
  collaboration_rule: "Collaboration rule",
};

export function validateMemoryDraft(draft: MemoryDraft): string | null {
  if (!draft.content.trim()) return "Memory needs a clear description.";
  if (draft.content.trim().length > 4000) return "Memory descriptions are limited to 4,000 characters.";
  if (!draft.sourceLabel.trim()) return "Tell Dreamboard where this memory came from.";
  if (draft.sensitive && !draft.sensitiveConsent) return "Sensitive memory needs your explicit consent before it is stored.";
  return null;
}

export type HealthInput = {
  projectSelected: boolean;
  noteCount: number;
  draftWords: number;
  importingCount: number;
  unresolvedQuestionCount: number;
  unverifiedClaimCount: number;
  versionCount: number;
};

export type HealthObservation = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  options: string[];
};

export function deriveCreativeHealth(input: HealthInput): HealthObservation[] {
  if (!input.projectSelected) return [];
  const observations: HealthObservation[] = [];
  if (input.importingCount > 0) observations.push({
    id: "import-queue",
    title: "Material is still arriving.",
    detail: "Your import queue has material waiting before it can become part of your working library.",
    evidence: `${input.importingCount} import batch${input.importingCount === 1 ? " is" : "es are"} uploading or processing in this project.`,
    options: ["Let the current batch finish", "Review the processed material", "Pause new imports for now"],
  });
  if (input.unresolvedQuestionCount + input.unverifiedClaimCount > 0) observations.push({
    id: "research-open",
    title: "Some research is still open.",
    detail: "That is not a failure—it is a useful boundary around what needs care before publication.",
    evidence: `${input.unresolvedQuestionCount} open research question${input.unresolvedQuestionCount === 1 ? "" : "s"} and ${input.unverifiedClaimCount} unverified claim${input.unverifiedClaimCount === 1 ? "" : "s"} are attached to this project.`,
    options: ["Open Research Workspace", "Write with an uncertainty note", "Park this question"],
  });
  if (input.noteCount >= 8 && input.draftWords === 0) observations.push({
    id: "material-before-draft",
    title: "You have source material ready to meet the page.",
    detail: "A small draft can turn a collection into direction. Nothing needs to be perfect before you begin.",
    evidence: `${input.noteCount} project-scoped source item${input.noteCount === 1 ? "" : "s"} are in your Knowledge Vault, while the current draft has no words yet.`,
    options: ["Open Writing Studio", "Organize my notes", "Choose one source to begin with"],
  });
  if (input.draftWords > 0 && input.versionCount > 0) observations.push({
    id: "revision-rhythm",
    title: "Your work has a revision trail.",
    detail: "You can keep drafting with confidence: earlier snapshots remain available to revisit.",
    evidence: `${input.draftWords.toLocaleString()} current draft words and ${input.versionCount} saved version${input.versionCount === 1 ? "" : "s"} are available on this device.`,
    options: ["Continue writing", "Review version history", "Create a named snapshot"],
  });
  if (!observations.length) observations.push({
    id: "begin-gently",
    title: "Your project is quiet—and ready.",
    detail: "Dreamboard does not turn a calm season into a warning. Add the next true piece whenever you are ready.",
    evidence: "There is not enough project activity yet for a stronger observation.",
    options: ["Capture a thought", "Import material", "Create a research question"],
  });
  return observations;
}
