"use client";

import type { CreatorWorkspaceExport } from "../lib/creator-export";

export function CreatorOwnershipCard({ noteCount, snapshotCount, onExport }: { noteCount: number; snapshotCount: number; onExport: () => void }) {
  return <section className="settings-card creator-ownership">
    <span className="eyebrow">CREATOR OWNERSHIP</span>
    <h3>Keep a portable copy of the work in front of you.</h3>
    <p>Download this device’s {noteCount} local vault item{noteCount === 1 ? "" : "s"}, current draft, and {snapshotCount} version snapshot{snapshotCount === 1 ? "" : "s"} as an open JSON archive.</p>
    <button className="ghost" onClick={onExport}>Download creator workspace</button>
    <small>This is an export, not a deletion. Private cloud originals stay where you placed them.</small>
  </section>;
}

export function downloadCreatorWorkspace(data: CreatorWorkspaceExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dreamboard-creator-workspace-${data.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
