"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export type GraphNode = { id: string; node_type: string; label: string; description: string; vault_entry_id: string | null; created_at: string };
export type EdgeOrigin = "user" | "system" | "ai_suggestion" | "import";
export type GraphEdge = { id: string; from_node_id: string; to_node_id: string; relationship: string; origin: EdgeOrigin; confidence: number | null; evidence: string | null; confirmed_by_user: boolean };

const NODE_COLUMNS = "id,node_type,label,description,vault_entry_id,created_at";
const EDGE_BASE_COLUMNS = "id,from_node_id,to_node_id,relationship";
const EDGE_FULL_COLUMNS = "id,from_node_id,to_node_id,relationship,origin,confidence,evidence,confirmed_by_user";
const RELATIONSHIPS = ["supports", "belongs_to", "inspires", "contradicts", "follows", "references"] as const;
const RENDER_CAP = 300;
const GOLDEN_ANGLE = 2.399963229728653;

export type CreativeGraphState = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loadState: "local" | "loading" | "ready" | "needs-setup";
  provenanceReady: boolean;
  createEdge: (fromId: string, toId: string, relationship: string) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;
  confirmEdge: (id: string) => Promise<void>;
};

export function useCreativeGraph(user: User | null, notify: (message: string) => void): CreativeGraphState {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loadState, setLoadState] = useState<CreativeGraphState["loadState"]>("local");
  const [provenanceReady, setProvenanceReady] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setNodes([]); setEdges([]); setLoadState("local"); return; }
      setLoadState("loading");
      const nodesResult = await supabase.from("dreamboard_graph_nodes").select(NODE_COLUMNS).order("created_at", { ascending: false }).limit(700);
      if (nodesResult.error) { setLoadState("needs-setup"); return; }
      setNodes((nodesResult.data || []) as GraphNode[]);
      const fullResult = await supabase.from("dreamboard_graph_edges").select(EDGE_FULL_COLUMNS).limit(1200);
      if (fullResult.error) {
        // Provenance columns may not be migrated yet; fall back to the base shape.
        setProvenanceReady(false);
        const baseResult = await supabase.from("dreamboard_graph_edges").select(EDGE_BASE_COLUMNS).limit(1200);
        if (baseResult.error) { setLoadState("needs-setup"); return; }
        setEdges(((baseResult.data || []) as Array<Pick<GraphEdge, "id" | "from_node_id" | "to_node_id" | "relationship">>).map(edge => ({ ...edge, origin: "user" as EdgeOrigin, confidence: null, evidence: null, confirmed_by_user: true })));
      } else {
        setProvenanceReady(true);
        setEdges((fullResult.data || []) as GraphEdge[]);
      }
      setLoadState("ready");
    };
    void load();
  }, [user]);

  const createEdge = async (fromId: string, toId: string, relationship: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || fromId === toId) return;
    let saved: GraphEdge | null = null;
    let errorCode: string | undefined;
    if (provenanceReady) {
      const { data, error } = await supabase.from("dreamboard_graph_edges").insert({ owner_id: user.id, from_node_id: fromId, to_node_id: toId, relationship, origin: "user", confirmed_by_user: true }).select(EDGE_FULL_COLUMNS).single();
      if (data) saved = data as GraphEdge; else errorCode = error?.code;
    } else {
      const { data, error } = await supabase.from("dreamboard_graph_edges").insert({ owner_id: user.id, from_node_id: fromId, to_node_id: toId, relationship }).select(EDGE_BASE_COLUMNS).single();
      if (data) saved = { ...(data as Pick<GraphEdge, "id" | "from_node_id" | "to_node_id" | "relationship">), origin: "user", confidence: null, evidence: null, confirmed_by_user: true }; else errorCode = error?.code;
    }
    if (!saved) { notify(errorCode === "23505" ? "Those two nodes already have this relationship." : "Dreamboard could not save that connection. Please try again."); return; }
    setEdges(previous => [saved as GraphEdge, ...previous]);
    notify("Connection saved to your private Creative Graph.");
  };

  const deleteEdge = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_graph_edges").delete().eq("id", id);
    if (error) { notify("Dreamboard could not remove that connection. Please try again."); return; }
    setEdges(previous => previous.filter(edge => edge.id !== id));
    notify("The connection was removed.");
  };

  const confirmEdge = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !provenanceReady) return;
    const { error } = await supabase.from("dreamboard_graph_edges").update({ confirmed_by_user: true }).eq("id", id);
    if (error) { notify("Dreamboard could not confirm that suggestion. Please try again."); return; }
    setEdges(previous => previous.map(edge => edge.id === id ? { ...edge, confirmed_by_user: true } : edge));
    notify("Suggestion confirmed as a real relationship in your graph.");
  };

  return { nodes, edges, loadState, provenanceReady, createEdge, deleteEdge, confirmEdge };
}

function layoutPositions(nodes: GraphNode[]): Map<string, { x: number; y: number }> {
  // Deterministic golden-angle spiral: stable, overlap-free enough for a few
  // hundred nodes, no physics simulation or layout library needed.
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    const radius = 46 * Math.sqrt(index + 0.6);
    const angle = index * GOLDEN_ANGLE;
    positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return positions;
}

const typeColors: Record<string, string> = { source: "#1f806d", theme: "#a57628", project: "#3f5f9e", chapter: "#7d5ba6", insight: "#b3552f", person: "#2d7a8a", place: "#5a7d2f", question: "#8a2d55" };

export function CreativeGraphView({ graph, signedIn, onOpenSource, onVault, onPassport }: { graph: CreativeGraphState; signedIn: boolean; onOpenSource: () => void; onVault: () => void; onPassport: () => void }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [relationshipFilter, setRelationshipFilter] = useState<string>("all");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connectRelationship, setConnectRelationship] = useState<string>("supports");
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const dragging = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const presentTypes = useMemo(() => Array.from(new Set(graph.nodes.map(node => node.node_type))), [graph.nodes]);
  const visibleNodes = useMemo(() => graph.nodes.filter(node => typeFilter === "all" || node.node_type === typeFilter).slice(0, RENDER_CAP), [graph.nodes, typeFilter]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => graph.edges
    .filter(edge => visibleIds.has(edge.from_node_id) && visibleIds.has(edge.to_node_id))
    .filter(edge => relationshipFilter === "all" || edge.relationship === relationshipFilter)
    .filter(edge => showSuggestions || edge.confirmed_by_user), [graph.edges, visibleIds, relationshipFilter, showSuggestions]);
  const positions = useMemo(() => layoutPositions(visibleNodes), [visibleNodes]);
  const selected = visibleNodes.find(node => node.id === selectedId) || null;
  const selectedEdges = useMemo(() => selected ? visibleEdges.filter(edge => edge.from_node_id === selected.id || edge.to_node_id === selected.id) : [], [selected, visibleEdges]);
  const nodeById = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph.nodes]);

  const clickNode = (node: GraphNode) => {
    if (connectFrom && connectFrom !== node.id) { void graph.createEdge(connectFrom, node.id, connectRelationship); setConnectFrom(null); setSelectedId(node.id); return; }
    setSelectedId(previous => previous === node.id ? null : node.id);
  };
  const centerOn = (id: string) => { const position = positions.get(id); if (position) setView(previous => ({ ...previous, x: -position.x * previous.k, y: -position.y * previous.k })); };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => { dragging.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y }; };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => { const drag = dragging.current; if (!drag) return; setView(previous => ({ ...previous, x: drag.originX + (event.clientX - drag.startX), y: drag.originY + (event.clientY - drag.startY) })); };
  const onPointerUp = () => { dragging.current = null; };
  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => { setView(previous => ({ ...previous, k: Math.min(3, Math.max(0.3, previous.k * (event.deltaY > 0 ? 0.9 : 1.1))) })); };

  return <section className="view graph-view">
    <div className="view-heading split"><div><span className="eyebrow">CREATIVE GRAPH · PRIVATE TO YOU</span><h2>See the connections inside the archive.</h2><p>Every node and relationship below is real, stored material — nothing is invented. Suggested links stay visually distinct until you confirm them.</p></div><button className="gold" onClick={signedIn ? onVault : onPassport}>{signedIn ? "Add source material" : "Set up Passport"} <b>→</b></button></div>
    {graph.loadState === "needs-setup" && <div className="connection-note"><b>Graph setup needed:</b><span>Run supabase/dreamboard-creator-workspace.sql (and dreamboard-graph-provenance.sql) in your Supabase project to enable the private Creative Graph.</span></div>}
    {graph.loadState === "ready" && !graph.provenanceReady && <div className="connection-note"><b>Provenance migration available:</b><span>Run supabase/dreamboard-graph-provenance.sql to record which relationships are user-made versus suggested. Until then, all stored links are treated as user-made.</span></div>}
    <div className="cg-toolbar">
      <div className="vision-filters" role="group" aria-label="Filter nodes by type"><button className={typeFilter === "all" ? "season active" : "season"} onClick={() => setTypeFilter("all")}>All types</button>{presentTypes.map(type => <button key={type} className={typeFilter === type ? "season active" : "season"} onClick={() => setTypeFilter(type)}>{type}</button>)}</div>
      <div className="cg-controls">
        <label className="vision-status">RELATIONSHIP<select value={relationshipFilter} onChange={event => setRelationshipFilter(event.target.value)}><option value="all">All</option>{RELATIONSHIPS.map(relationship => <option key={relationship} value={relationship}>{relationship.replace("_", " ")}</option>)}</select></label>
        <label className="toggle-row cg-toggle"><span><b>Show suggestions</b></span><input type="checkbox" checked={showSuggestions} onChange={event => setShowSuggestions(event.target.checked)} /><i /></label>
        <button className="ghost" onClick={() => setView({ x: 0, y: 0, k: 1 })}>Reset view</button>
      </div>
    </div>
    <div className="cg-layout">
      <div className="cg-canvas" data-connecting={Boolean(connectFrom)}>
        {visibleNodes.length ? <svg ref={svgRef} viewBox="-450 -300 900 600" role="application" aria-label="Creative graph canvas. Drag to pan, scroll to zoom, click a node to inspect it." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {visibleEdges.map(edge => { const from = positions.get(edge.from_node_id); const to = positions.get(edge.to_node_id); if (!from || !to) return null; const suggested = !edge.confirmed_by_user; const highlighted = selected && (edge.from_node_id === selected.id || edge.to_node_id === selected.id); return <g key={edge.id}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={suggested ? "cg-edge cg-edge-suggested" : "cg-edge"} strokeWidth={highlighted ? 2.4 : 1.2} opacity={selected && !highlighted ? 0.18 : 0.75} />{highlighted && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5} className="cg-edge-label">{edge.relationship.replace("_", " ")}{suggested ? " · suggested" : ""}</text>}</g>; })}
            {visibleNodes.map(node => { const position = positions.get(node.id); if (!position) return null; const isSelected = node.id === selectedId; const isConnectSource = node.id === connectFrom; return <g key={node.id} transform={`translate(${position.x} ${position.y})`} className="cg-node" onClick={() => clickNode(node)} tabIndex={0} role="button" aria-label={`${node.node_type}: ${node.label}`} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); clickNode(node); } }}><circle r={isSelected ? 15 : 11} fill={typeColors[node.node_type] || "#5e756d"} stroke={isSelected || isConnectSource ? "#dcb86b" : "rgba(255,255,255,.65)"} strokeWidth={isSelected || isConnectSource ? 3 : 1.4} /><text y={isSelected ? 30 : 25} className="cg-node-label">{node.label.length > 26 ? `${node.label.slice(0, 25)}…` : node.label}</text></g>; })}
          </g>
        </svg> : <div className="graph-empty"><span>⌬</span><h3>{signedIn ? "Your first graph is waiting." : "Your graph stays private to your Passport."}</h3><p>{signedIn ? "Add a note, journal entry, or imported text to create a private source node." : "Sign in with your Passport, then every saved source becomes a real node here."}</p></div>}
        {graph.nodes.length > RENDER_CAP && <p className="cg-cap-note">Showing the {RENDER_CAP} most recent nodes of {graph.nodes.length}. Filters narrow the view.</p>}
      </div>
      <aside className="cg-panel">
        {connectFrom && <div className="connection-note"><b>Connecting:</b><span>“{nodeById.get(connectFrom)?.label}” → click a second node to create a “{connectRelationship.replace("_", " ")}” link, or cancel below.</span><button className="ghost" onClick={() => setConnectFrom(null)}>Cancel connection</button></div>}
        {selected ? <>
          <span className="eyebrow">{selected.node_type.toUpperCase()} NODE</span>
          <h3>{selected.label}</h3>
          {selected.description && <p>{selected.description}</p>}
          <div className="vision-actions">
            {selected.vault_entry_id && <button className="ghost" onClick={onOpenSource}>Open in Knowledge Vault</button>}
            <button className="ghost" onClick={() => centerOn(selected.id)}>Center node</button>
            <label className="vision-status">LINK AS<select value={connectRelationship} onChange={event => setConnectRelationship(event.target.value)}>{RELATIONSHIPS.map(relationship => <option key={relationship} value={relationship}>{relationship.replace("_", " ")}</option>)}</select></label>
            <button className="gold" onClick={() => setConnectFrom(selected.id)} disabled={connectFrom === selected.id}>Connect to another node</button>
          </div>
          <div className="cg-edge-list">
            <span className="eyebrow">RELATIONSHIPS · {selectedEdges.length}</span>
            {selectedEdges.map(edge => { const otherId = edge.from_node_id === selected.id ? edge.to_node_id : edge.from_node_id; const other = nodeById.get(otherId); const suggested = !edge.confirmed_by_user; return <article key={edge.id}><div><b>{edge.from_node_id === selected.id ? `${edge.relationship.replace("_", " ")} → ` : `← ${edge.relationship.replace("_", " ")} `}{other?.label || "removed node"}</b><small>{suggested ? `Suggested (${edge.origin.replace("_", " ")}${typeof edge.confidence === "number" ? ` · ${(edge.confidence * 100).toFixed(0)}%` : ""}) — not yet confirmed` : `Confirmed · ${edge.origin.replace("_", " ")}`}{edge.evidence ? ` · ${edge.evidence}` : ""}</small></div><div className="vision-actions">{suggested && <button className="ghost" onClick={() => void graph.confirmEdge(edge.id)}>Confirm</button>}<button className="ghost" onClick={() => { if (window.confirm(suggested ? "Reject and remove this suggested link?" : "Remove this relationship?")) void graph.deleteEdge(edge.id); }}>{suggested ? "Reject" : "Remove"}</button></div></article>; })}
            {!selectedEdges.length && <p className="empty-state">No relationships yet. Use “Connect to another node” to make the first one.</p>}
          </div>
        </> : <>
          <span className="eyebrow">HOW IT WORKS</span>
          <h3>Evidence before imagination.</h3>
          <p>{graph.nodes.length ? `${graph.nodes.length} node${graph.nodes.length === 1 ? "" : "s"} · ${graph.edges.length} relationship${graph.edges.length === 1 ? "" : "s"}, all stored under your Passport. Click a node to inspect it, connect it, or open its source. Drag to pan; scroll to zoom.` : "Each saved vault entry becomes a source node. Relationships appear only when you create them or confirm a suggestion — Dreamboard never invents links between your ideas."}</p>
        </>}
      </aside>
    </div>
  </section>;
}
