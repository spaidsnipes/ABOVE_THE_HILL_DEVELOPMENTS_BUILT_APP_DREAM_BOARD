"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export type ProjectRole = "owner" | "admin" | "editor" | "contributor" | "reviewer" | "viewer";
export const ROLE_ORDER: ProjectRole[] = ["owner", "admin", "editor", "contributor", "reviewer", "viewer"];
export const ROLE_CAPABILITY: Record<ProjectRole, string> = {
  owner: "Full control; the only role that can delete the project.",
  admin: "Manage members, edit everything, resolve reviews.",
  editor: "Edit the manuscript and material.",
  contributor: "Add material and comments.",
  reviewer: "Read and leave review comments.",
  viewer: "Read-only access.",
};
// Roles a manager may assign (never 'owner' — ownership transfer is separate).
export const ASSIGNABLE_ROLES: ProjectRole[] = ["admin", "editor", "contributor", "reviewer", "viewer"];

type Member = { id: string; member_id: string | null; invited_email: string | null; role: ProjectRole; status: string };
type Comment = { id: string; author_id: string; author_label: string; body: string; is_review_request: boolean; created_at: string };
type Activity = { id: string; actor_label: string; action: string; detail: string; created_at: string };

export type CollaborationState = {
  members: Member[];
  comments: Comment[];
  activity: Activity[];
  loadState: "idle" | "loading" | "ready" | "needs-setup";
  invite: (email: string, role: ProjectRole) => Promise<void>;
  changeRole: (id: string, role: ProjectRole) => Promise<void>;
  revoke: (id: string) => Promise<void>;
  respond: (accept: boolean) => Promise<void>;
  addComment: (body: string, isReviewRequest: boolean) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
};

export function useCollaboration(user: User | null, projectId: string | null, viewerLabel: string, notify: (message: string) => void): CollaborationState {
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loadState, setLoadState] = useState<CollaborationState["loadState"]>("idle");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !projectId) { setLoadState("idle"); return; }
      setLoadState("loading");
      const membersResult = await supabase.from("dreamboard_project_members").select("id,member_id,invited_email,role,status").eq("project_id", projectId).order("created_at");
      if (membersResult.error) { setLoadState("needs-setup"); return; }
      const [commentsResult, activityResult] = await Promise.all([
        supabase.from("dreamboard_project_comments").select("id,author_id,author_label,body,is_review_request,created_at").eq("project_id", projectId).order("created_at").limit(200),
        supabase.from("dreamboard_project_activity").select("id,actor_label,action,detail,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
      ]);
      setMembers((membersResult.data || []) as Member[]);
      setComments((commentsResult.data || []) as Comment[]);
      setActivity((activityResult.data || []) as Activity[]);
      setLoadState("ready");
    };
    void load();
  }, [user, projectId]);

  const logActivity = async (action: string, detail: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !projectId) return;
    const { data } = await supabase.from("dreamboard_project_activity").insert({ project_id: projectId, actor_id: user.id, actor_label: viewerLabel, action, detail }).select("id,actor_label,action,detail,created_at").single();
    if (data) setActivity(previous => [data as Activity, ...previous].slice(0, 50));
  };

  const invite = async (email: string, role: ProjectRole) => {
    const supabase = getSupabaseBrowserClient();
    const clean = email.trim().toLowerCase();
    if (!supabase || !user || !projectId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { notify("Enter a valid email address to invite a collaborator."); return; }
    const { data, error } = await supabase.from("dreamboard_project_members").insert({ project_id: projectId, invited_email: clean, role, status: "pending", invited_by: user.id }).select("id,member_id,invited_email,role,status").single();
    if (error || !data) { notify(error?.code === "23505" ? "That person is already a member of this project." : "The invitation could not be saved. Please try again."); return; }
    setMembers(previous => [...previous, data as Member]);
    void logActivity("invited", `${clean} as ${role}`);
    notify(`Invitation recorded for ${clean} as ${role}. They gain access only after they accept — access is enforced by database policy, not this screen.`);
  };

  const changeRole = async (id: string, role: ProjectRole) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_project_members").update({ role, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { notify("That role change could not be saved. Please try again."); return; }
    setMembers(previous => previous.map(member => member.id === id ? { ...member, role } : member));
    void logActivity("changed role", role);
  };

  const revoke = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    if (!window.confirm("Remove this collaborator? They immediately lose access to this project.")) return;
    const { error } = await supabase.from("dreamboard_project_members").delete().eq("id", id);
    if (error) { notify("The collaborator could not be removed. Please try again."); return; }
    setMembers(previous => previous.filter(member => member.id !== id));
    void logActivity("removed a collaborator", "");
    notify("The collaborator was removed and no longer has access.");
  };

  const respond = async (accept: boolean) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !projectId) return;
    const { error } = await supabase.rpc("dreamboard_respond_invitation", { pid: projectId, accept });
    if (error) { notify("Your response could not be saved. Please try again."); return; }
    setMembers(previous => previous.map(member => member.invited_email && (member.status === "pending") ? { ...member, status: accept ? "accepted" : "declined", member_id: user.id } : member));
    notify(accept ? "Invitation accepted — you now have access under your assigned role." : "Invitation declined.");
  };

  const addComment = async (body: string, isReviewRequest: boolean) => {
    const supabase = getSupabaseBrowserClient();
    const clean = body.trim();
    if (!supabase || !user || !projectId || !clean) return;
    const { data, error } = await supabase.from("dreamboard_project_comments").insert({ project_id: projectId, author_id: user.id, author_label: viewerLabel, body: clean.slice(0, 4000), is_review_request: isReviewRequest }).select("id,author_id,author_label,body,is_review_request,created_at").single();
    if (error || !data) { notify("Your comment could not be posted. Please try again."); return; }
    setComments(previous => [...previous, data as Comment]);
    if (isReviewRequest) void logActivity("requested a review", "");
  };

  const deleteComment = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const { error } = await supabase.from("dreamboard_project_comments").delete().eq("id", id);
    if (error) { notify("The comment could not be deleted. Please try again."); return; }
    setComments(previous => previous.filter(comment => comment.id !== id));
  };

  return { members, comments, activity, loadState, invite, changeRole, revoke, respond, addComment, deleteComment };
}

export function CollaborationPanel({ collab, user, ownerId }: { collab: CollaborationState; user: User | null; ownerId: string }) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProjectRole>("reviewer");
  const [commentText, setCommentText] = useState("");
  const isOwner = user?.id === ownerId;
  const isManager = isOwner || collab.members.some(member => member.member_id === user?.id && member.role === "admin" && member.status === "accepted");
  const myPending = collab.members.find(member => member.status === "pending" && member.member_id === user?.id);

  if (collab.loadState === "needs-setup") return <div className="collab-panel"><div className="connection-note"><b>Collaboration setup needed:</b><span>Run supabase/dreamboard-collaboration.sql in your Supabase project to enable members, roles, comments, and activity — all enforced by row-level security.</span></div></div>;
  if (collab.loadState !== "ready") return <div className="collab-panel"><p className="empty-state">Loading collaborators…</p></div>;

  return <div className="collab-panel">
    <span className="eyebrow">COLLABORATION · ACCESS ENFORCED BY DATABASE POLICY</span>
    {myPending && <div className="connection-note"><b>You have a pending invitation ({myPending.role}).</b><span>Accepting grants access under that role.</span><div className="vision-actions"><button className="gold" onClick={() => void collab.respond(true)}>Accept</button><button className="ghost" onClick={() => void collab.respond(false)}>Decline</button></div></div>}

    <div className="collab-members">
      <div className="collab-owner"><span className="member-avatar">◇</span><div><b>Owner</b><small>{isOwner ? "You" : "Project owner"}</small></div><em>owner</em></div>
      {collab.members.map(member => <div key={member.id} className="collab-member"><span className="member-avatar">{member.status === "accepted" ? "✓" : member.status === "pending" ? "…" : "×"}</span><div><b>{member.invited_email || "Linked collaborator"}</b><small>{member.status}{member.status === "pending" ? " — no access until accepted" : ""}</small></div>{isManager ? <div className="vision-actions"><label className="vision-status"><select value={member.role} onChange={event => void collab.changeRole(member.id, event.target.value as ProjectRole)}>{ASSIGNABLE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}</select></label><button className="ghost" onClick={() => void collab.revoke(member.id)}>Remove</button></div> : <em>{member.role}</em>}</div>)}
      {!collab.members.length && <p className="empty-state">No collaborators yet. This project is private to you.</p>}
    </div>

    {isManager && <div className="collab-invite"><span className="eyebrow">INVITE A COLLABORATOR</span><div className="collab-invite-row"><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="their@email.com" /><label className="vision-status"><select value={inviteRole} onChange={event => setInviteRole(event.target.value as ProjectRole)}>{ASSIGNABLE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}</select></label><button className="gold" onClick={() => { void collab.invite(email, inviteRole); setEmail(""); }} disabled={!email.trim()}>Invite</button></div><p className="import-truth">{ROLE_CAPABILITY[inviteRole]}</p></div>}

    <div className="collab-comments"><span className="eyebrow">COMMENTS & REVIEW REQUESTS</span>
      <div className="collab-comment-list">{collab.comments.map(comment => <article key={comment.id} className={comment.is_review_request ? "collab-comment review" : "collab-comment"}><div><b>{comment.author_label || "Collaborator"}{comment.is_review_request ? " · review request" : ""}</b><small>{new Date(comment.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small><p>{comment.body}</p></div>{comment.author_id === user?.id && <button className="ghost" onClick={() => void collab.deleteComment(comment.id)} aria-label="Delete comment">✕</button>}</article>)}{!collab.comments.length && <p className="empty-state">No comments yet.</p>}</div>
      <div className="collab-compose"><textarea value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="Leave a comment or request a review…" /><div className="vision-actions"><button className="ghost" onClick={() => { void collab.addComment(commentText, false); setCommentText(""); }} disabled={!commentText.trim()}>Comment</button><button className="gold" onClick={() => { void collab.addComment(commentText, true); setCommentText(""); }} disabled={!commentText.trim()}>Request review</button></div></div>
    </div>

    {collab.activity.length > 0 && <div className="collab-activity"><span className="eyebrow">ACTIVITY</span>{collab.activity.slice(0, 8).map(entry => <p key={entry.id}><b>{entry.actor_label || "Someone"}</b> {entry.action}{entry.detail ? ` — ${entry.detail}` : ""} · <small>{new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></p>)}</div>}
  </div>;
}
