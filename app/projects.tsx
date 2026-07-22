"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export const PROJECT_TYPES = ["book", "memoir", "research", "script", "comic", "podcast", "music", "application", "website", "game", "business", "course", "nonprofit", "custom"] as const;
export const PROJECT_STATUSES = ["idea", "incubating", "planning", "active", "paused", "blocked", "review", "ready_to_publish", "published", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type Project = { id: string; title: string; kind: string; description: string; status: ProjectStatus; mission: string; intended_outcome: string; completion_definition: string; metadata: { next_action?: string }; created_at: string; updated_at: string; archived_at: string | null };

const FULL_COLUMNS = "id,title,kind,description,status,mission,intended_outcome,completion_definition,metadata,created_at,updated_at,archived_at";
const BASE_COLUMNS = "id,title,kind,created_at,updated_at";
type BaseRow = Pick<Project, "id" | "title" | "kind" | "created_at" | "updated_at">;
const fromBase = (row: BaseRow): Project => ({ ...row, description: "", status: "active", mission: "", intended_outcome: "", completion_definition: "", metadata: {}, archived_at: null });

export type ProjectsState = {
  projects: Project[];
  loadState: "local" | "loading" | "ready" | "needs-setup";
  extended: boolean;
  createProject: (title: string, kind: string, description: string) => Promise<void>;
  updateProject: (id: string, patch: Partial<Omit<Project, "id" | "created_at" | "updated_at">>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  attachedCounts: Record<string, { vision: number; knowledge: number; documents: number }>;
  attachCurrentDocument: (projectId: string) => Promise<void>;
};

export function useProjects(user: User | null, notify: (message: string) => void, currentDocumentId: string | null): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<ProjectsState["loadState"]>("local");
  const [extended, setExtended] = useState(true);
  const [attachedCounts, setAttachedCounts] = useState<ProjectsState["attachedCounts"]>({});

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setProjects([]); setLoadState("local"); return; }
      setLoadState("loading");
      const fullResult = await supabase.from("dreamboard_projects").select(FULL_COLUMNS).order("updated_at", { ascending: false }).limit(200);
      if (fullResult.error) {
        setExtended(false);
        const baseResult = await supabase.from("dreamboard_projects").select(BASE_COLUMNS).order("updated_at", { ascending: false }).limit(200);
        if (baseResult.error) { setLoadState("needs-setup"); return; }
        setProjects(((baseResult.data || []) as BaseRow[]).map(fromBase));
      } else {
        setExtended(true);
        setProjects(((fullResult.data || []) as Project[]).map(project => ({ ...project, metadata: project.metadata || {} })));
      }
      const [vision, knowledge, documents] = await Promise.all([
        supabase.from("dreamboard_vision_entries").select("project_id").not("project_id", "is", null),
        supabase.from("dreamboard_vault_entries").select("project_id").not("project_id", "is", null),
        supabase.from("dreamboard_writing_documents").select("project_id").not("project_id", "is", null),
      ]);
      const counts: ProjectsState["attachedCounts"] = {};
      const tally = (rows: Array<{ project_id: string | null }> | null, key: "vision" | "knowledge" | "documents") => {
        for (const row of rows || []) { if (!row.project_id) continue; counts[row.project_id] = counts[row.project_id] || { vision: 0, knowledge: 0, documents: 0 }; counts[row.project_id][key] += 1; }
      };
      tally(vision.data as Array<{ project_id: string | null }> | null, "vision");
      tally(knowledge.data as Array<{ project_id: string | null }> | null, "knowledge");
      tally(documents.data as Array<{ project_id: string | null }> | null, "documents");
      setAttachedCounts(counts);
      setLoadState("ready");
    };
    void load();
  }, [user]);

  const createProject = async (title: string, kind: string, description: string) => {
    const supabase = getSupabaseBrowserClient();
    const cleanTitle = title.trim();
    if (!supabase || !user || !cleanTitle) return;
    if (extended) {
      const { data, error } = await supabase.from("dreamboard_projects").insert({ owner_id: user.id, title: cleanTitle.slice(0, 160), kind, description: description.trim(), status: "idea" }).select(FULL_COLUMNS).single();
      if (error || !data) { notify("Dreamboard could not create that project yet. Please try again."); return; }
      setProjects(previous => [{ ...(data as Project), metadata: (data as Project).metadata || {} }, ...previous]);
    } else {
      const { data, error } = await supabase.from("dreamboard_projects").insert({ owner_id: user.id, title: cleanTitle.slice(0, 160), kind }).select(BASE_COLUMNS).single();
      if (error || !data) { notify("Dreamboard could not create that project yet. Please try again."); return; }
      setProjects(previous => [fromBase(data as BaseRow), ...previous]);
    }
    notify(`“${cleanTitle.slice(0, 60)}” is now a real, private project.`);
  };

  const updateProject = async (id: string, patch: Partial<Omit<Project, "id" | "created_at" | "updated_at">>) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    if (!extended) { notify("Run the project-model migration first to edit project details."); return; }
    const now = new Date().toISOString();
    const payload = { ...patch, updated_at: now, ...(patch.status ? { archived_at: patch.status === "archived" ? now : null } : {}) };
    const { error } = await supabase.from("dreamboard_projects").update(payload).eq("id", id);
    if (error) { notify("That project change could not be saved. Please try again."); return; }
    setProjects(previous => previous.map(project => project.id === id ? { ...project, ...payload } as Project : project));
  };

  const deleteProject = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_projects").delete().eq("id", id);
    if (error) { notify("Dreamboard could not delete that project. Please try again."); return; }
    setProjects(previous => previous.filter(project => project.id !== id));
    notify("The project was permanently deleted. Attached vault material was kept and simply detached.");
  };

  const attachCurrentDocument = async (projectId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !currentDocumentId) return;
    const { error } = await supabase.from("dreamboard_writing_documents").update({ project_id: projectId }).eq("id", currentDocumentId);
    if (error) { notify("The document could not be attached. Please try again."); return; }
    setAttachedCounts(previous => ({ ...previous, [projectId]: { ...(previous[projectId] || { vision: 0, knowledge: 0, documents: 0 }), documents: (previous[projectId]?.documents || 0) + 1 } }));
    notify("Your current writing document is attached to this project.");
  };

  return { projects, loadState, extended, createProject, updateProject, deleteProject, attachedCounts, attachCurrentDocument };
}

function ProjectEditor({ project, state, hasDocument, onWrite }: { project: Project; state: ProjectsState; hasDocument: boolean; onWrite: () => void }) {
  const [description, setDescription] = useState(project.description);
  const [mission, setMission] = useState(project.mission);
  const [outcome, setOutcome] = useState(project.intended_outcome);
  const [done, setDone] = useState(project.completion_definition);
  const [nextAction, setNextAction] = useState(project.metadata.next_action || "");
  const dirty = description !== project.description || mission !== project.mission || outcome !== project.intended_outcome || done !== project.completion_definition || nextAction !== (project.metadata.next_action || "");
  const save = () => void state.updateProject(project.id, { description, mission, intended_outcome: outcome, completion_definition: done, metadata: { ...project.metadata, next_action: nextAction } });
  return <>
    <label>DESCRIPTION<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What this project is, in your own words." /></label>
    <div className="project-detail-grid">
      <label>MISSION<textarea value={mission} onChange={event => setMission(event.target.value)} placeholder="Why this work matters." /></label>
      <label>INTENDED OUTCOME<textarea value={outcome} onChange={event => setOutcome(event.target.value)} placeholder="What exists in the world when it ships." /></label>
      <label>DEFINITION OF DONE<textarea value={done} onChange={event => setDone(event.target.value)} placeholder="The honest checklist for calling it complete." /></label>
      <label>CURRENT NEXT ACTION<input value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="The next faithful step." /></label>
    </div>
    <div className="vision-actions">
      <button className="gold" onClick={save} disabled={!dirty}>{dirty ? "Save project details" : "Saved"}</button>
      <label className="vision-status">STATUS<select value={project.status} onChange={event => void state.updateProject(project.id, { status: event.target.value as ProjectStatus })}>{PROJECT_STATUSES.map(status => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></label>
      {hasDocument && <button className="ghost" onClick={() => void state.attachCurrentDocument(project.id)}>Attach current writing document</button>}
      <button className="ghost" onClick={onWrite}>Open Writing Studio</button>
      {project.status === "archived"
        ? <><button className="ghost" onClick={() => void state.updateProject(project.id, { status: "active" })}>Restore</button><button className="ghost" onClick={() => { if (window.confirm(`Permanently delete “${project.title}”? Attached material is kept but detached. This cannot be undone.`)) void state.deleteProject(project.id); }}>Delete</button></>
        : <button className="ghost" onClick={() => void state.updateProject(project.id, { status: "archived" })}>Archive</button>}
    </div>
  </>;
}

export function ProjectsView({ state, signedIn, hasDocument, onPassport, onWrite }: { state: ProjectsState; signedIn: boolean; hasDocument: boolean; onPassport: () => void; onWrite: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("book");
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(() => state.projects.filter(project => showArchived ? project.status === "archived" : project.status !== "archived"), [state.projects, showArchived]);

  if (!signedIn) return <section className="view"><div className="view-heading"><span className="eyebrow">YOUR CREATIONS</span><h2>Projects live under your Passport.</h2><p>Projects, their material, and their history are private to your creator account. Sign in to create the first one.</p></div><button className="gold" onClick={onPassport}>Set up Passport <b>→</b></button></section>;

  return <section className="view projects-view">
    <div className="view-heading split"><div><span className="eyebrow">YOUR CREATIONS · PRIVATE BY DEFAULT</span><h2>Projects</h2><p>{state.projects.length ? `${state.projects.length} project${state.projects.length === 1 ? "" : "s"} under your Passport. Each one carries its own purpose and definition of done.` : "A project is a container for real work — a book, a business, a course. Create the first one when you're ready."}</p></div><button className="ghost" onClick={() => { setShowArchived(previous => !previous); setOpenId(null); }}>{showArchived ? "Show active" : "Show archived"}</button></div>
    {state.loadState === "needs-setup" && <div className="connection-note"><b>Projects setup needed:</b><span>Run supabase/dreamboard-core-schema.sql (and dreamboard-project-model.sql) in your Supabase project.</span></div>}
    {state.loadState === "ready" && !state.extended && <div className="connection-note"><b>Project model migration available:</b><span>Run supabase/dreamboard-project-model.sql to enable status, mission, and completion definitions. Until then, projects are title-and-type only.</span></div>}
    <div className="input-card project-create"><label>NEW PROJECT TITLE<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} placeholder="The honest name for the work" /></label><div className="project-create-row"><label className="vision-status">TYPE<select value={kind} onChange={event => setKind(event.target.value)}>{PROJECT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label><button className="gold" onClick={() => { void state.createProject(title, kind, ""); setTitle(""); }} disabled={!title.trim() || state.loadState !== "ready"}>Create project <b>→</b></button></div></div>
    <div className="project-list">
      {visible.map(project => { const counts = state.attachedCounts[project.id] || { vision: 0, knowledge: 0, documents: 0 }; const isOpen = openId === project.id; return <article key={project.id} className={isOpen ? "project-card open" : "project-card"}>
        <button className="project-summary" onClick={() => setOpenId(isOpen ? null : project.id)} aria-expanded={isOpen}><div><span className="eyebrow">{project.kind.toUpperCase()} · {project.status.replace(/_/g, " ").toUpperCase()}</span><h3>{project.title}</h3>{project.description && !isOpen && <p>{project.description.slice(0, 140)}</p>}</div><small>{counts.documents} doc{counts.documents === 1 ? "" : "s"} · {counts.vision} idea{counts.vision === 1 ? "" : "s"} · {counts.knowledge} source{counts.knowledge === 1 ? "" : "s"}</small></button>
        {isOpen && <div className="project-detail">
          {state.extended ? <ProjectEditor key={project.id} project={project} state={state} hasDocument={hasDocument} onWrite={onWrite} /> : <p className="empty-state">Run the project-model migration to edit mission, status, and completion definition here.</p>}
        </div>}
      </article>; })}
      {!visible.length && <p className="empty-state">{showArchived ? "No archived projects." : "No projects yet. Dreamboard begins empty on purpose — create the first container for your real work above."}</p>}
    </div>
  </section>;
}
