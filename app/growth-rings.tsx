"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import "./growth-rings.css";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { GROWTH_CATEGORIES, GROWTH_CATEGORY_LABELS, GROWTH_PRACTICES, growthLanguage, summarizeGrowth, type GrowthCategory, type GrowthEntry } from "../lib/growth-rings";

const ENTRY_COLUMNS = "id,occurred_on,category,practice,reflection,created_at";

export type GrowthRingsState = {
  entries: GrowthEntry[];
  loadState: "idle" | "loading" | "ready" | "needs-setup";
  save: (category: GrowthCategory, practices: string[], reflection: string) => Promise<boolean>;
};

export function useGrowthRings(user: User | null, notify: (message: string) => void): GrowthRingsState {
  const [entries, setEntries] = useState<GrowthEntry[]>([]);
  const [loadState, setLoadState] = useState<GrowthRingsState["loadState"]>("idle");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setEntries([]); setLoadState("idle"); return; }
      setLoadState("loading");
      const { data, error } = await supabase.from("dreamboard_growth_entries").select(ENTRY_COLUMNS).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(1500);
      if (error) { setLoadState("needs-setup"); return; }
      setEntries((data || []) as GrowthEntry[]);
      setLoadState("ready");
    };
    void load();
  }, [user]);

  const save = async (category: GrowthCategory, practices: string[], reflection: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return false;
    if (!practices.length) { notify("Choose one or more practices you want to record."); return false; }
    const occurred_on = new Date().toISOString().slice(0, 10);
    const cleanReflection = reflection.trim().slice(0, 2000) || null;
    const rows = practices.map(practice => ({ owner_id: user.id, occurred_on, category, practice, reflection: cleanReflection }));
    const { data, error } = await supabase.from("dreamboard_growth_entries").upsert(rows, { onConflict: "owner_id,occurred_on,category,practice" }).select(ENTRY_COLUMNS);
    if (error || !data) { notify("Growth Rings needs its private database setup before it can save."); return false; }
    setEntries(previous => {
      const fresh = data as GrowthEntry[];
      const ids = new Set(fresh.map(entry => `${entry.occurred_on}:${entry.category}:${entry.practice}`));
      return [...fresh, ...previous.filter(entry => !ids.has(`${entry.occurred_on}:${entry.category}:${entry.practice}`))];
    });
    notify("Your entry is on the wall. Progression over perfection.");
    return true;
  };
  return { entries, loadState, save };
}

export function GrowthRingsView({ state, signedIn, onPassport }: { state: GrowthRingsState; signedIn: boolean; onPassport: () => void }) {
  const [category, setCategory] = useState<GrowthCategory>("spiritual");
  const [chosen, setChosen] = useState<string[]>([]);
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const summary = useMemo(() => summarizeGrowth(state.entries), [state.entries]);
  const todays = new Set(state.entries.filter(entry => entry.occurred_on === new Date().toISOString().slice(0, 10)).map(entry => `${entry.category}:${entry.practice}`));
  const toggle = (practice: string) => setChosen(previous => previous.includes(practice) ? previous.filter(value => value !== practice) : [...previous, practice]);

  if (!signedIn) return <section className="view"><div className="view-heading"><span className="eyebrow">GROWTH RINGS · PRIVATE TO YOUR PASSPORT</span><h2>Measure the distance you have traveled.</h2><p>Growth Rings holds the practices you choose to record. It never creates a broken streak, diagnoses your life, or makes a spiritual judgment.</p></div><button className="gold" onClick={onPassport}>Set up Passport <b>→</b></button></section>;
  return <section className="view growth-rings-view">
    <div className="growth-hero"><div><span className="eyebrow">GROWTH RINGS · PROGRESSION OVER PERFECTION</span><h2>How are you <em>growing?</em></h2><p>A missed day is never treated as a ruined journey. Your wall remembers the real acts of care, practice, and renewed commitment you choose to place on it.</p></div><div className="growth-ring-art" aria-hidden="true"><i /><i /><i /><b>{summary.total}</b><span>recorded acts<br />in 90 days</span></div></div>
    {state.loadState === "needs-setup" && <div className="connection-note"><b>Growth Rings setup needed:</b><span>Run <code>supabase/dreamboard-growth-rings.sql</code> once to make this private to each Passport.</span></div>}
    <div className="growth-grid"><section className="growth-checkin"><span className="eyebrow">TODAY’S CHECK-IN</span><h3>What belongs on your wall?</h3><p>Record what happened in your own words. This is reflection, not a verdict.</p><div className="growth-category-tabs" role="tablist">{GROWTH_CATEGORIES.map(value => <button key={value} className={category === value ? "active" : ""} onClick={() => { setCategory(value); setChosen([]); }} role="tab" aria-selected={category === value}>{GROWTH_CATEGORY_LABELS[value]}</button>)}</div><div className="practice-chips">{GROWTH_PRACTICES[category].map(practice => { const key = `${category}:${practice}`; return <button key={practice} className={chosen.includes(practice) ? "selected" : ""} onClick={() => toggle(practice)}>{todays.has(key) && <span aria-label="Already recorded today">✓</span>}{practice}</button>; })}</div><label className="growth-reflection">OPTIONAL REFLECTION<textarea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="What supported you today? What would you like to carry forward?" maxLength={2000} /></label><button className="gold" disabled={saving || !chosen.length} onClick={() => { void (async () => { setSaving(true); const saved = await state.save(category, chosen, reflection); if (saved) { setChosen([]); setReflection(""); } setSaving(false); })(); }}>{saving ? "Saving…" : "Place on my wall"}<b>→</b></button></section>
      <section className="progress-wall"><span className="eyebrow">YOUR PROGRESS WALL</span><h3>Growth is measured in seasons.</h3><p className="growth-language">{growthLanguage(summary)}</p>{state.loadState === "loading" && <p className="empty-state">Opening your private wall…</p>}{summary.byMonth.length ? <div className="wall-months">{summary.byMonth.map(month => <article key={month.month}><div className="wall-marker" /><div><span>{month.month}</span><p>{month.entries.map(entry => entry.practice).filter((practice, index, values) => values.indexOf(practice) === index).join(" · ")}</p><small>{month.entries.length} record{month.entries.length === 1 ? "" : "s"} you chose to keep</small></div></article>)}</div> : state.loadState === "ready" && <p className="empty-state">Your wall is ready for its first mark. Start with one true thing—not a perfect week.</p>}</section></div>
    <section className="growth-summary"><div><span className="eyebrow">90-DAY REFLECTION</span><h3>Evidence of your continued becoming.</h3><p>{summary.total ? "These totals come only from what you recorded. They are not a score, prediction, or judgment." : "When you record a practice, this view will reflect the actual pattern over time."}</p></div><div className="summary-practices">{summary.byPractice.slice(0, 6).map(item => <article key={item.practice}><b>{item.count}</b><span>{item.practice}</span></article>)}{!summary.byPractice.length && <div className="summary-empty">No records yet—your next honest entry is enough to begin.</div>}</div></section>
    <section className="growth-principle"><span>Dreamboard principle</span><h3>Progression over perfection.</h3><p>Meaningful growth is rarely linear. Rest, interruptions, mistakes, illness, grief, and changing seasons belong to a human life. Dreamboard celebrates consistency, resilience, learning, recovery, and a renewed commitment; it does not turn a missed day into a failure.</p></section>
  </section>;
}
