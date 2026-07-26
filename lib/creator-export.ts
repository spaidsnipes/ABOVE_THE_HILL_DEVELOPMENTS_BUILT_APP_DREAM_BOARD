export type CreatorWorkspaceExport = {
  exportedAt: string;
  format: "dreamboard-creator-workspace/v1";
  scope: "current-device-workspace";
  notes: Array<{ title: string; body: string; kind: string; date: string; tags: string[] }>;
  draft: string;
  snapshots: Array<{ label: string; body: string; chapter: number; date: string; words: number }>;
  limitations: string[];
};

export function buildCreatorWorkspaceExport(input: Omit<CreatorWorkspaceExport, "exportedAt" | "format" | "scope" | "limitations">): CreatorWorkspaceExport {
  return {
    exportedAt: new Date().toISOString(),
    format: "dreamboard-creator-workspace/v1",
    scope: "current-device-workspace",
    notes: input.notes,
    draft: input.draft,
    snapshots: input.snapshots,
    limitations: [
      "This archive contains material visible in this browser workspace at export time.",
      "Private originals stored only in Supabase and cloud-only records are retained in their source system and are not silently copied into this download.",
      "The archive does not transfer identity, permissions, purchased items, or access to WOW World services.",
    ],
  };
}
