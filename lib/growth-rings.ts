export const GROWTH_CATEGORIES = ["spiritual", "physical", "mental", "financial", "creative", "relationships", "work"] as const;
export type GrowthCategory = (typeof GROWTH_CATEGORIES)[number];

export const GROWTH_CATEGORY_LABELS: Record<GrowthCategory, string> = {
  spiritual: "Spiritual",
  physical: "Physical",
  mental: "Mental",
  financial: "Financial",
  creative: "Creative",
  relationships: "Relationships",
  work: "Work",
};

export const GROWTH_PRACTICES: Record<GrowthCategory, readonly string[]> = {
  spiritual: ["Prayer", "Bible", "Church", "Worship", "Fasting", "Reflection", "Gratitude"],
  physical: ["Sleep", "Workout", "Steps", "Nutrition", "Water", "Recovery"],
  mental: ["Reading", "Learning", "Journaling", "Thinking", "Meditation"],
  financial: ["Budget", "Investments", "Trading", "Business", "Saving"],
  creative: ["Dreamboard", "Writing", "Music", "Studios", "Projects"],
  relationships: ["Family", "Friends", "Mentorship", "Serving"],
  work: ["Job", "Business", "Clients", "Sales", "Meetings", "Deep Work"],
};

export type GrowthEntry = {
  id: string;
  occurred_on: string;
  category: GrowthCategory;
  practice: string;
  reflection: string | null;
  created_at: string;
};

export type GrowthSummary = {
  days: number;
  total: number;
  byPractice: Array<{ practice: string; count: number }>;
  byMonth: Array<{ month: string; entries: GrowthEntry[] }>;
};

export function inLastDays(entries: GrowthEntry[], now = new Date(), days = 90): GrowthEntry[] {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return entries.filter(entry => new Date(`${entry.occurred_on}T00:00:00`) >= cutoff);
}

export function summarizeGrowth(entries: GrowthEntry[], now = new Date(), days = 90): GrowthSummary {
  const recent = inLastDays(entries, now, days);
  const counts = new Map<string, number>();
  recent.forEach(entry => counts.set(entry.practice, (counts.get(entry.practice) || 0) + 1));
  const grouped = new Map<string, GrowthEntry[]>();
  [...recent].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).forEach(entry => {
    const date = new Date(`${entry.occurred_on}T00:00:00`);
    const month = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    grouped.set(month, [...(grouped.get(month) || []), entry]);
  });
  return {
    days,
    total: recent.length,
    byPractice: [...counts.entries()].map(([practice, count]) => ({ practice, count })).sort((a, b) => b.count - a.count || a.practice.localeCompare(b.practice)),
    byMonth: [...grouped.entries()].map(([month, monthEntries]) => ({ month, entries: monthEntries })),
  };
}

export function growthLanguage(summary: GrowthSummary): string {
  if (!summary.total) return "Your wall begins with one honest entry. There is no streak to protect and no missed day to repair.";
  const highlights = summary.byPractice.slice(0, 3).map(item => `${item.practice.toLowerCase()} ${item.count} ${item.count === 1 ? "time" : "times"}`);
  return `Over the last ${summary.days} days, you recorded ${summary.total} act${summary.total === 1 ? "" : "s"} of care${highlights.length ? `: ${highlights.join(", ")}` : ""}. A quiet day does not erase what came before.`;
}
