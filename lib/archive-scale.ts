export const ARCHIVE_STAGE_LIMIT = 7_000;
export const EXTRACTION_WINDOW = 500;
export const UPLOAD_CONCURRENCY = 3;

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
 * archive can resume from the records in private storage.
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
      : `${fileCount.toLocaleString()} originals will be preserved first. Text extraction runs in ${extractionPasses} resumable pass${extractionPasses === 1 ? "" : "es"} of up to ${EXTRACTION_WINDOW.toLocaleString()} files.`;
  return { fileCount, bytes, extractionPasses, withinStageLimit, message };
}
