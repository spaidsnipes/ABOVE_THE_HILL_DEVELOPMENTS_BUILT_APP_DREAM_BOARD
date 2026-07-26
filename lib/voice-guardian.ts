export type VoiceReferenceDraft = { label: string; excerpt: string; consent: boolean };

export function countReferenceWords(samples: Array<{ excerpt: string }>): number {
  return samples.reduce((total, sample) => total + (sample.excerpt.trim() ? sample.excerpt.trim().split(/\s+/).length : 0), 0);
}

export function voiceReferenceCoverage(samples: Array<{ excerpt: string }>): string {
  const words = countReferenceWords(samples);
  if (!samples.length) return "No references yet";
  if (words < 150) return "Early reference set";
  if (words < 750) return "Growing reference set";
  return "Substantial reference set";
}

export function validateVoiceReference(draft: VoiceReferenceDraft): string | null {
  if (draft.label.trim().length < 2) return "Name where this voice reference came from.";
  if (draft.excerpt.trim().split(/\s+/).length < 20) return "Add at least 20 words so the reference has enough context.";
  if (!draft.consent) return "Confirm that this is your work or that you have permission to use it as a private reference.";
  return null;
}
