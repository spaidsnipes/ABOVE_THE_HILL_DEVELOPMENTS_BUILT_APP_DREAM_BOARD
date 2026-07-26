export const ARCHIVE_STAGE_LIMIT = 7_000;
export const EXTRACTION_WINDOW = 500;
export const UPLOAD_CONCURRENCY = 3;
export const MAX_BROWSER_FILE_BYTES = 50 * 1024 * 1024;

export type ArchivePlan = {
  fileCount: number;
  bytes: number;
  extractionPasses: number;
  withinStageLimit: boolean;
  message: string;
};

/**
 * Gives the creator an honest intake plan before any upload begins.  Files are
 * preserved individually, while extraction is deliberately bounded so a large
 * archive can later be processed from the records in private storage.
 */
export function planArchiveIntake(files: Array<{ size: number }>): ArchivePlan {
  const fileCount = files.length;
  const bytes = files.reduce((total, file) => total + Math.max(0, file.size || 0), 0);
  const extractionPasses = Math.ceil(fileCount / EXTRACTION_WINDOW);
  const withinStageLimit = fileCount <= ARCHIVE_STAGE_LIMIT;
  const message = !fileCount
    ? "Choose files to see an intake plan."
    : !withinStageLimit
      ? `Stage up to ${ARCHIVE_STAGE_LIMIT.toLocaleString()} files at a time so every original receives a durable receipt.`
      : `${fileCount.toLocaleString()} originals will be preserved first. When text extraction is enabled, this archive is prepared for ${extractionPasses} bounded pass${extractionPasses === 1 ? "" : "es"} of up to ${EXTRACTION_WINDOW.toLocaleString()} files.`;
  return { fileCount, bytes, extractionPasses, withinStageLimit, message };
}

/**
 * Browser uploads are deliberately kept inside a conservative envelope. This
 * is separate from the archive plan so the UI can tell the creator exactly
 * why a selection was not staged before any network request occurs.
 */
export function validateArchiveSelection(files: Array<{ name?: string; size: number }>) {
  const plan = planArchiveIntake(files);
  const oversized = files.find(file => file.size > MAX_BROWSER_FILE_BYTES);
  if (oversized) {
    return {
      accepted: false,
      plan,
      message: `“${oversized.name || "This file"}” is larger than the current 50 MB protected-upload limit. Keep that original aside and split or compress it before staging the batch.`,
    };
  }
  if (!plan.withinStageLimit) {
    return {
      accepted: false,
      plan,
      message: `${plan.message} You selected ${files.length.toLocaleString()} files, so no files were staged or uploaded.`,
    };
  }
  return { accepted: true, plan, message: plan.message };
}
