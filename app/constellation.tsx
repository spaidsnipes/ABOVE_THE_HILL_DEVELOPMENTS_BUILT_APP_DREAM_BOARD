"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { templateForKind } from "../lib/project-types";
import type { Project } from "./projects";

type AttachedCounts = Record<string, { vision: number; knowledge: number; documents: number }>;
type ProjectLink = { id: string; from_project_id: string; to_project_id: string; relationship: string };
const RELATIONSHIPS = ["related", "inspires", "depends_on", "part_of", "contrasts"] as const;
const GOLDEN_ANGLE = 2.399963229728653;

export type ConstellationState = {
  links: ProjectLink[];
  loadState: "idle" | "loading" | "ready" | "needs-setup";
  link: (fromId: string, toId: string, relationship: string) => Promise<void>;
  unlink: (id: string) => Promise<void>;
};

export function useConstellation(user: User | null, notify: (message: string) => void): ConstellationState {
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [loadState, setLoadState] = useState<ConstellationState["loadState"]>("idle");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setLinks([]); setLoadState("idle"); return; }
      setLoadState("loading");
      const { data, error } = await supabase.from("dreamboard_project_links").select("id,from_project_id,to_project_id,relationship").limit(400);
      if (error) { setLoadState("needs-setup"); return; }
      setLinks((data || []) as ProjectLink[]);
      setLoadState("ready");
    };
    void load();
  }, [user]);

  const link = async (fromId: string, toId: string, relationship: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || fromId === toId) return;
    const { data, error } = await supabase.from("dreamboard_project_links").insert({ owner_id: user.id, from_project_id: fromId, to_project_id: toId, relationship }).select("id,from_project_id,to_project_id,relationship").single();
    if (error || !data) { notify(error?.code === "23505" ? "Those projects already have this relationship." : "The link could not be saved. Please try again."); return; }
    setLinks(previous => [data as ProjectLink, ...previous]);
    notify("Projects linked in your constellation.");
  };
  const unlink = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_project_links").delete().eq("id", id);
    if (error) { notify("The link could not be removed. Please try again."); return; }
    setLinks(previous => previous.filter(item => item.id !== id));
  };

  return { links, loadState, link, unlink };
}

export function ConstellationView({ state, projects, attachedCounts, activePrimaryId, signedIn, onFocusProject, onOpenProject, onPassport }: {
  state: ConstellationState; projects: Project[]; attachedCounts: AttachedCounts; activePrimaryId: string | null; signedIn: boolean;
  onFocusProject: (id: string) => void; onOpenProject: () => void; onPassport: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string>("related");
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const dragging = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const active = projects.filter(project => project.status !== "archived");
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    active.forEach((project, index) => {
      const radius = 60 * Math.sqrt(index + 0.5);
      const angle = index * GOLDEN_ANGLE;
      map.set(project.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
    return map;
  }, [active]);
  const material = (id: string) => { const c = attachedCounts[id]; return c ? c.vision + c.knowledge + c.documents : 0; };
  const idSet = useMemo(() => new Set(active.map(project => project.id)), [active]);
  const visibleLinks = state.links.filter(link => idSet.has(link.from_project_id) && idSet.has(link.to_project_id));
  const byId = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const selected = active.find(project => project.id === selectedId) || null;

  const clickStar = (id: string) => {
    if (connectFrom && connectFrom !== id) { void state.link(connectFrom, id, relationship); setConnectFrom(null); setSelectedId(id); return; }
    setSelectedId(previous => previous === id ? null : id);
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => { dragging.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y }; };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => { const drag = dragging.current; if (!drag) return; setView(previous => ({ ...previous, x: drag.originX + (event.clientX - drag.startX), y: drag.originY + (event.clientY - drag.startY) })); };
  const onPointerUp = () => { dragging.current = null; };
  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => { setView(previous => ({ ...previous, k: Math.min(3, Math.max(0.3, previous.k * (event.deltaY > 0 ? 0.9 : 1.1))) })); };

  if (!signedIn) return <section className="view"><div className="view-heading"><span className="eyebrow">CONSTELLATION</span><h2>Your creative universe.</h2><p>The constellation maps your projects and how they relate. Sign in with your Passport to see it.</p></div><button className="gold" onClick={onPassport}>Set up Passport <b>→</b></button></section>;

  return <section className="view graph-view">
    <div className="view-heading split"><div><span className="eyebrow">CONSTELLATION · YOUR PROJECT UNIVERSE</span><h2>Every project is a world you can enter.</h2><p>Stars are your real projects, sized by how much material each holds. Relationships are ones you draw — nothing is invented. Click a star to focus it, or connect two.</p></div><button className="ghost" onClick={() => setView({ x: 0, y: 0, k: 1 })}>Reset view</button></div>
    {state.loadState === "needs-setup" && <div className="connection-note"><b>Constellation setup needed:</b><span>Run supabase/dreamboard-constellation.sql to store project relationships.</span></div>}
    <div className="cg-layout">
      <div className="cg-canvas" data-connecting={Boolean(connectFrom)}>
        {active.length ? <svg viewBox="-480 -300 960 600" role="application" aria-label="Constellation. Drag to pan, scroll to zoom, click a project to focus it." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {visibleLinks.map(link => { const from = positions.get(link.from_project_id); const to = positions.get(link.to_project_id); if (!from || !to) return null; return <line key={link.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="cg-edge" strokeWidth={1.4} opacity={0.7} />; })}
            {active.map(project => { const position = positions.get(project.id); if (!position) return null; const size = 12 + Math.min(20, material(project.id) * 1.5); const isSelected = project.id === selectedId; const isPrimary = project.id === activePrimaryId; const template = templateForKind(project.kind, project.custom_type_label); return <g key={project.id} transform={`translate(${position.x} ${position.y})`} className="cg-node" onClick={() => clickStar(project.id)} tabIndex={0} role="button" aria-label={`${template.label}: ${project.title}, ${material(project.id)} items`} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); clickStar(project.id); } }}><circle r={size} fill={isPrimary ? "#dcb86b" : "#1f806d"} stroke={isSelected || project.id === connectFrom ? "#dcb86b" : "rgba(255,255,255,.7)"} strokeWidth={isSelected || project.id === connectFrom ? 3 : 1.5} opacity={0.9} /><text y={size + 15} className="cg-node-label">{project.title.length > 22 ? `${project.title.slice(0, 21)}…` : project.title}</text></g>; })}
          </g>
        </svg> : <div className="graph-empty"><span>✦</span><h3>Your universe is waiting for its first world.</h3><p>Create a project, and it becomes a star here — sized by the material you bring into it.</p></div>}
      </div>
      <aside className="cg-panel">
        {connectFrom && <div className="connection-note"><b>Connecting:</b><span>“{byId.get(connectFrom)?.title}” → click a second star to link them as “{relationship.replace("_", " ")}”.</span><button className="ghost" onClick={() => setConnectFrom(null)}>Cancel</button></div>}
        {selected ? <>
          <span className="eyebrow">{templateForKind(selected.kind, selected.custom_type_label).label.toUpperCase()}</span>
          <h3>{selected.title}</h3>
          <p>{material(selected.id)} pieces of material · {selected.status.replace(/_/g, " ")}</p>
          <div className="vision-actions">
            <button className="gold" onClick={() => { onFocusProject(selected.id); }}>{activePrimaryId === selected.id ? "Primary project" : "Make primary"}</button>
            <button className="ghost" onClick={onOpenProject}>Open in Projects</button>
            <label className="vision-status">LINK AS<select value={relationship} onChange={event => setRelationship(event.target.value)}>{RELATIONSHIPS.map(value => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></label>
            <button className="ghost" onClick={() => setConnectFrom(selected.id)} disabled={connectFrom === selected.id}>Connect to another</button>
          </div>
          <div className="cg-edge-list"><span className="eyebrow">LINKS</span>{visibleLinks.filter(link => link.from_project_id === selected.id || link.to_project_id === selected.id).map(link => { const otherId = link.from_project_id === selected.id ? link.to_project_id : link.from_project_id; return <article key={link.id}><div><b>{link.relationship.replace("_", " ")} → {byId.get(otherId)?.title || "removed"}</b></div><div className="vision-actions"><button className="ghost" onClick={() => void state.unlink(link.id)}>Remove</button></div></article>; })}{!visibleLinks.some(link => link.from_project_id === selected.id || link.to_project_id === selected.id) && <p className="empty-state">No links yet.</p>}</div>
        </> : <><span className="eyebrow">HOW IT WORKS</span><h3>Real worlds, real relationships.</h3><p>{active.length ? `${active.length} project${active.length === 1 ? "" : "s"} · ${visibleLinks.length} link${visibleLinks.length === 1 ? "" : "s"}. Click a star to focus a project, set it as your active primary, or connect it to another. Drag to pan; scroll to zoom.` : "Create your first project to light up the constellation."}</p></>}
      </aside>
    </div>
  </section>;
}
