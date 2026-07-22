// Organize My Notes: deterministic, explainable analysis of the creator's
// own material. No AI runs here and the UI must say so. Output is a proposal
// the creator reviews — nothing is applied without approval.

export type OrganizeNote = { id: number; title: string; body: string; tags: string[] };
export type ThemeCluster = { label: string; keyword: string; noteIds: number[] };
export type OrganizeProposal = {
  clusters: ThemeCluster[];
  duplicates: Array<[number, number]>;
  questions: number[];
  analyzed: number;
};

const STOPWORDS = new Set("the and for that with this from your you was were are is a an in on of to it its as at by be or not but they them their there then than so we our i my me he she his her him have has had will would can could should about into over under after before more most very just what when where who how why all any some no yes one two three".split(" "));

function significantWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []).filter(word => !STOPWORDS.has(word));
}

export function analyzeNotes(notes: OrganizeNote[]): OrganizeProposal {
  // Theme candidates: words that recur across different notes.
  const wordToNotes = new Map<string, Set<number>>();
  for (const note of notes) {
    for (const word of new Set(significantWords(`${note.title} ${note.body}`))) {
      if (!wordToNotes.has(word)) wordToNotes.set(word, new Set());
      wordToNotes.get(word)!.add(note.id);
    }
  }
  const candidates = [...wordToNotes.entries()]
    .filter(([, ids]) => ids.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 8);

  // Assign each note to its strongest candidate theme (one theme per note).
  const assigned = new Set<number>();
  const clusters: ThemeCluster[] = [];
  for (const [keyword, ids] of candidates) {
    const members = [...ids].filter(id => !assigned.has(id));
    if (members.length < 2) continue;
    members.forEach(id => assigned.add(id));
    clusters.push({ keyword, label: keyword.charAt(0).toUpperCase() + keyword.slice(1), noteIds: members });
  }

  // Possible duplicates: same normalized title, or same first 120 characters.
  const duplicates: Array<[number, number]> = [];
  for (let i = 0; i < notes.length; i += 1) {
    for (let j = i + 1; j < notes.length; j += 1) {
      const a = notes[i], b = notes[j];
      const titleMatch = a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
      const bodyMatch = a.body.slice(0, 120).trim().toLowerCase() === b.body.slice(0, 120).trim().toLowerCase() && a.body.length > 40;
      if (titleMatch || bodyMatch) duplicates.push([a.id, b.id]);
    }
  }

  // Open questions the creator wrote themselves.
  const questions = notes.filter(note => /\?\s*$/m.test(note.body) || /\?\s*$/.test(note.title)).map(note => note.id);

  return { clusters, duplicates, questions, analyzed: notes.length };
}
