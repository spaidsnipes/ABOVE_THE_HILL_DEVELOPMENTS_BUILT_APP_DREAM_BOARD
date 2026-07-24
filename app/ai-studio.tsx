"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { MASTER_PERSONAS, SKILLS, buildMessages, localFramework, parseSegments, routeRequest, type CompanionContext, type OutputSegment } from "../lib/companion";

export type CompanionRun = { id: string; prompt: string; selected_skills: string[]; selected_persona: string; wisdom_enabled: boolean; output: { summary?: string; nextSteps?: string[]; segments?: OutputSegment[]; provenance?: string }; provider: string; created_at: string };

const CATEGORY_LABELS: Record<string, string> = { evidence: "Evidence", interpretation: "Interpretation", inference: "Inference", speculation: "Speculation", recommendation: "Recommendation", creative_suggestion: "Creative suggestion", generated_draft: "Generated draft" };

export function AIStudioView({ user, notify, wisdomEnabled, context, runs, onRunSaved, onAppendToDraft }: {
  user: User | null; notify: (message: string) => void; wisdomEnabled: boolean; context: CompanionContext;
  runs: CompanionRun[]; onRunSaved: (run: CompanionRun) => void; onAppendToDraft: (text: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [pinnedPersonas, setPinnedPersonas] = useState<string[]>([]);
  const [includeDraft, setIncludeDraft] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [status, setStatus] = useState<"idle" | "working" | "ready" | "needs-connection">("idle");
  const [segments, setSegments] = useState<OutputSegment[]>([]);
  const [routeInfo, setRouteInfo] = useState("");

  const togglePin = (id: string) => setPinnedPersonas(previous => previous.includes(id) ? previous.filter(item => item !== id) : previous.length < 3 ? [...previous, id] : previous);

  const ask = async () => {
    const clean = prompt.trim();
    if (!clean || status === "working") return;
    setStatus("working");
    setSegments([]);
    // Privacy guard: only the context the creator opted into leaves this device.
    const scoped: CompanionContext = { ...context, draftExcerpt: includeDraft ? context.draftExcerpt : "", sources: includeSources ? context.sources : [] };
    const route = routeRequest(clean, wisdomEnabled, pinnedPersonas);
    setRouteInfo(`${route.personas.map(persona => persona.name).join(" + ")} · ${route.skills.length} skills. ${route.rationale}`);
    let output: OutputSegment[];
    let provider = "local-framework";
    let finalStatus: "ready" | "needs-connection" = "needs-connection";
    try {
      const messages = buildMessages(clean, route, scoped);
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${messages.system}\n\n---\n\n${messages.user}`, context: "" }) });
      const data = await response.json() as { text?: string };
      if (response.ok && data.text) { output = parseSegments(data.text); provider = "connected-model"; finalStatus = "ready"; }
      else output = localFramework(clean, route, scoped);
    } catch { output = localFramework(clean, route, scoped); }
    setSegments(output);
    setStatus(finalStatus);
    const supabase = getSupabaseBrowserClient();
    if (supabase && user) {
      const { data } = await supabase.from("dreamboard_companion_runs").insert({
        owner_id: user.id, prompt: clean, selected_skills: route.skills.map(skill => skill.name), selected_persona: route.personas.map(persona => persona.name).join(" + "), wisdom_enabled: wisdomEnabled,
        output: { segments: output, provenance: "Human material: your prompt, draft, and sources. AI contribution: " + (provider === "connected-model" ? "generative review from your connected model, labeled by category." : "local deterministic routing only.") },
        provider, status: provider === "connected-model" ? "complete" : "needs-model",
      }).select("id,prompt,selected_skills,selected_persona,wisdom_enabled,output,provider,created_at").single();
      if (data) onRunSaved(data as CompanionRun);
    }
  };

  const appendable = segments.filter(segment => segment.category === "creative_suggestion" || segment.category === "generated_draft");

  return <section className="view ai-studio">
    <div className="view-heading"><span className="eyebrow">CREATIVE COMPANION · ROUTED SKILLS, LABELED OUTPUT</span><h2>Creative intelligence, under your direction.</h2><p>Every request is routed to named skills in a working mode, and every part of the answer is labeled — evidence, interpretation, speculation, recommendation, or creative suggestion. Nothing touches your manuscript without your confirmation.</p></div>
    <div className="ai-grid">
      <section className="ai-card">
        <div className="card-head"><div><span className="eyebrow">ASK FOR A REVIEW</span><h3>Keep your voice in charge.</h3></div><span className={status === "ready" ? "ai-pill connected" : "ai-pill"}>{status === "ready" ? "MODEL CONNECTED" : "LOCAL COMPANION READY"}</span></div>
        <textarea value={prompt} onChange={event => setPrompt(event.target.value)} aria-label="Companion request" placeholder="Ask about structure, voice, sources, or the next step…" />
        <span className="eyebrow persona-pick-label">CHOOSE PERSONAS · UP TO 3 (OR LET ROUTING DECIDE)</span><div className="companion-skills-row" role="group" aria-label="Pin personas (up to 3)">{MASTER_PERSONAS.map(persona => <button key={persona.id} className={pinnedPersonas.includes(persona.id) ? "season active" : "season"} onClick={() => togglePin(persona.id)} title={persona.summary} aria-pressed={pinnedPersonas.includes(persona.id)}>{persona.name}</button>)}</div>
        <div className="companion-context-row"><label className="toggle-row cg-toggle"><span><b>Include draft excerpt</b></span><input type="checkbox" checked={includeDraft} onChange={event => setIncludeDraft(event.target.checked)} /><i /></label><label className="toggle-row cg-toggle"><span><b>Include your sources</b></span><input type="checkbox" checked={includeSources} onChange={event => setIncludeSources(event.target.checked)} /><i /></label></div>
        <button className="gold" onClick={() => void ask()} disabled={status === "working" || !prompt.trim()}>{status === "working" ? "Routing…" : "Ask the Companion"} <b>→</b></button>
        <p className="assist-note">Only the context you toggle on is sent. Pin up to three personas, or let routing choose from your words.</p>
      </section>
      <section className="ai-card ai-result">
        <span className="eyebrow">REVIEW PANEL{routeInfo ? ` · ${routeInfo.split(".")[0]}` : ""}</span>
        <h3>{segments.length ? "A labeled review" : "Your Companion"}</h3>
        {segments.length ? <div className="segment-list">{segments.map((segment, index) => <div key={index} className={`segment segment-${segment.category}`}><b>{CATEGORY_LABELS[segment.category]}</b><p>{segment.text}</p></div>)}</div> : <p>Ask a question and the answer arrives in labeled parts, with a private routing record saved to your account. The local framework works now; a connected model deepens the analysis.</p>}
        {appendable.length > 0 && <div className="vision-actions"><button className="ghost" onClick={() => { void navigator.clipboard.writeText(appendable.map(segment => segment.text).join("\n\n")); notify("Suggestion copied. Paste it wherever you decide it belongs."); }}>Copy suggestion</button><button className="ghost" onClick={() => { if (window.confirm("Append the Companion's suggestion to the END of your draft? Your existing words are not changed, and you can remove it or restore a version at any time.")) { onAppendToDraft(appendable.map(segment => segment.text).join("\n\n")); notify("Suggestion appended to the end of your draft — clearly yours to keep, edit, or delete."); } }}>Append to draft…</button></div>}
        {status === "needs-connection" && segments.length > 0 && <div className="connection-note"><b>Model connection is optional:</b><span>Add AI_BASE_URL, AI_API_KEY, and AI_MODEL in Vercel to upgrade from the local framework to generative review.</span></div>}
      </section>
    </div>
    <section className="companion-map"><div><span className="eyebrow">PERSONA & SKILL REGISTRY</span><h3>{MASTER_PERSONAS.length} master personas · {SKILLS.length} skills</h3><p>{MASTER_PERSONAS.slice(0, 12).map(persona => persona.name).join(" · ")} · and more</p></div><div><b>{SKILLS.slice(0, 10).map(skill => skill.name).join(" · ")}</b><small>{runs.length ? `${runs.length} private companion request${runs.length === 1 ? "" : "s"} saved to your account.` : "Your request history appears here after you sign in."}</small></div></section>
  </section>;
}
