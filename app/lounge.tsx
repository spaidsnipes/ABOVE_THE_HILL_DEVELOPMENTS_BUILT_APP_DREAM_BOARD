"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

const wowWorldUrl = "https://wealthymindsets-pro.vercel.app";

type Post = { id: string; author_id: string; author_label: string; body: string; topic: string; project_ref: string | null; created_at: string };
type Comment = { id: string; post_id: string; author_id: string; author_label: string; body: string; created_at: string };

type LoungeStatus = "local" | "loading" | "ready" | "needs-setup";

export type LoungeState = {
  posts: Post[];
  comments: Record<string, Comment[]>;
  blocked: Set<string>;
  status: LoungeStatus;
  publish: (body: string, projectRef: string) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  loadComments: (postId: string) => Promise<void>;
  addComment: (postId: string, body: string) => Promise<void>;
  report: (target: { postId?: string; commentId?: string }, reason: string) => Promise<void>;
  block: (authorId: string) => Promise<void>;
};

export function useLounge(user: User | null, viewerLabel: string, notify: (message: string) => void): LoungeState {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<LoungeStatus>("local");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setStatus("local"); return; }
      setStatus("loading");
      const postsResult = await supabase.from("dreamboard_lounge_posts").select("id,author_id,author_label,body,topic,project_ref,created_at").order("created_at", { ascending: false }).limit(60);
      if (postsResult.error) { setStatus("needs-setup"); return; }
      setPosts((postsResult.data || []) as Post[]);
      if (user) {
        const blocksResult = await supabase.from("dreamboard_lounge_blocks").select("blocked_id");
        if (!blocksResult.error) setBlocked(new Set((blocksResult.data || []).map(row => (row as { blocked_id: string }).blocked_id)));
      }
      setStatus("ready");
    };
    void load();
  }, [user]);

  const publish = async (body: string, projectRef: string) => {
    const supabase = getSupabaseBrowserClient();
    const clean = body.trim();
    if (!supabase || !user || !clean) { notify("Set up your Passport before publishing to the shared Lounge."); return; }
    const { data, error } = await supabase.from("dreamboard_lounge_posts").insert({ author_id: user.id, author_label: viewerLabel, body: clean.slice(0, 2000), topic: "From Dreamboard", project_ref: projectRef.trim() ? projectRef.trim().slice(0, 160) : null }).select("id,author_id,author_label,body,topic,project_ref,created_at").single();
    if (error || !data) { notify("Dreamboard could not publish that post. Please confirm your Passport and try again."); return; }
    setPosts(previous => [data as Post, ...previous]);
    notify("Your update is shared in the Dreamboard Lounge.");
  };

  const deletePost = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    const { error } = await supabase.from("dreamboard_lounge_posts").delete().eq("id", id);
    if (error) { notify("The post could not be deleted. Please try again."); return; }
    setPosts(previous => previous.filter(post => post.id !== id));
    notify("Your post was deleted.");
  };

  const loadComments = async (postId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("dreamboard_lounge_comments").select("id,post_id,author_id,author_label,body,created_at").eq("post_id", postId).order("created_at").limit(200);
    if (!error) setComments(previous => ({ ...previous, [postId]: (data || []) as Comment[] }));
  };

  const addComment = async (postId: string, body: string) => {
    const supabase = getSupabaseBrowserClient();
    const clean = body.trim();
    if (!supabase || !user || !clean) { notify("Set up your Passport before commenting in the Lounge."); return; }
    const { data, error } = await supabase.from("dreamboard_lounge_comments").insert({ post_id: postId, author_id: user.id, author_label: viewerLabel, body: clean.slice(0, 2000) }).select("id,post_id,author_id,author_label,body,created_at").single();
    if (error || !data) { notify("Your comment could not be posted. Please try again."); return; }
    setComments(previous => ({ ...previous, [postId]: [...(previous[postId] || []), data as Comment] }));
  };

  const report = async (target: { postId?: string; commentId?: string }, reason: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) { notify("Set up your Passport to report content."); return; }
    const { error } = await supabase.from("dreamboard_lounge_reports").insert({ reporter_id: user.id, post_id: target.postId || null, comment_id: target.commentId || null, reason: reason.slice(0, 500) });
    if (error) { notify("The report could not be filed. Please try again."); return; }
    notify("Thank you — your report was filed privately for moderation review.");
  };

  const block = async (authorId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || authorId === user.id) return;
    const { error } = await supabase.from("dreamboard_lounge_blocks").insert({ blocker_id: user.id, blocked_id: authorId });
    if (error) { notify("That person could not be blocked. Please try again."); return; }
    setBlocked(previous => new Set(previous).add(authorId));
    notify("You will no longer see this person's Lounge posts or comments.");
  };

  return { posts, comments, blocked, status, publish, deletePost, loadComments, addComment, report, block };
}

function WowWorldSurface() {
  return <section className="wow-world-surface"><div className="wow-surface-head"><div><span className="eyebrow">LIVE WOW WORLD SURFACE</span><h3>WOW World Lounge</h3><p>The live Lounge from the WOW World app, embedded here. Dreamboard&rsquo;s own community below is the native layer — this is an additional window, not the whole feature.</p></div><a className="ghost" href={`${wowWorldUrl}/lounge`} target="_blank" rel="noreferrer">Open full screen ↗</a></div><iframe title="WOW World Lounge" src={`${wowWorldUrl}/lounge`} loading="lazy" allow="autoplay; encrypted-media; clipboard-write" referrerPolicy="strict-origin-when-cross-origin" /></section>;
}

export function LoungeView({ lounge, user, signedIn, onPassport }: { lounge: LoungeState; user: User | null; signedIn: boolean; onPassport: () => void }) {
  const [text, setText] = useState("");
  const [projectRef, setProjectRef] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const visible = lounge.posts.filter(post => !lounge.blocked.has(post.author_id));

  const toggleComments = (postId: string) => {
    if (openComments === postId) { setOpenComments(null); return; }
    setOpenComments(postId);
    if (!lounge.comments[postId]) void lounge.loadComments(postId);
  };
  const doReport = (target: { postId?: string; commentId?: string }) => {
    const reason = window.prompt("Report this content. What's wrong with it? (optional)", "");
    if (reason === null) return;
    void lounge.report(target, reason);
  };

  return <section className="view ecosystem-view">
    <div className="view-heading"><span className="eyebrow">DREAMBOARD LOUNGE</span><h2>Let the work find its people.</h2><p>Share creator updates in the World of Wealth. Every public moment is intentional — and yours to delete.</p></div>
    <WowWorldSurface />
    {lounge.status === "needs-setup" && <div className="connection-note"><b>Community setup needed:</b><span>Run supabase/dreamboard-core-schema.sql and dreamboard-lounge-community.sql to enable the native Dreamboard Lounge with comments, reporting, and blocking.</span></div>}
    <div className="lounge-layout">
      <section className="lounge-composer">
        <div className="card-head"><div><span className="eyebrow">FROM YOUR CREATIVE DESK</span><h3>Post to the Lounge</h3></div><span className="live-dot">{lounge.status === "ready" ? "NATIVE" : "SETUP"}</span></div>
        {signedIn ? <>
          <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Share a thought, a milestone, or an invitation…" />
          <input className="lounge-project-ref" value={projectRef} onChange={event => setProjectRef(event.target.value)} placeholder="Optional: reference a project by name" maxLength={160} />
          <div><button className="gold" onClick={() => { void lounge.publish(text, projectRef); setText(""); setProjectRef(""); }} disabled={!text.trim() || lounge.status !== "ready"}>Share update <b>→</b></button></div>
          <p>Posts are public in the shared Lounge and stored under your Passport. You can delete yours anytime.</p>
        </> : <><p>Set up your Passport to post, comment, and moderate your own feed.</p><button className="gold" onClick={onPassport}>Set up Passport <b>→</b></button></>}
      </section>
      <section className="lounge-feed">
        {visible.length ? visible.map(post => <article key={post.id}>
          <div className="post-avatar">WOW</div>
          <div className="post-main">
            <header><span><b>{post.author_label}</b><small>{post.topic} · {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></span></header>
            {post.project_ref && <span className="post-project-ref">◈ {post.project_ref}</span>}
            <p>{post.body}</p>
            <footer className="post-actions">
              <button className="text-button" onClick={() => toggleComments(post.id)}>{openComments === post.id ? "Hide comments" : `Comments${lounge.comments[post.id] ? ` (${lounge.comments[post.id].length})` : ""}`}</button>
              {post.author_id === user?.id ? <button className="text-button" onClick={() => void lounge.deletePost(post.id)}>Delete</button> : signedIn && <><button className="text-button" onClick={() => doReport({ postId: post.id })}>Report</button><button className="text-button" onClick={() => void lounge.block(post.author_id)}>Block</button></>}
            </footer>
            {openComments === post.id && <div className="lounge-comments">
              {(lounge.comments[post.id] || []).map(comment => <div key={comment.id} className="lounge-comment"><b>{comment.author_label}</b><p>{comment.body}</p>{comment.author_id !== user?.id && signedIn && <button className="text-button" onClick={() => doReport({ commentId: comment.id })}>Report</button>}</div>)}
              {!(lounge.comments[post.id] || []).length && <p className="empty-state">No comments yet.</p>}
              {signedIn && <div className="lounge-comment-compose"><input value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="Add a comment…" onKeyDown={event => { if (event.key === "Enter" && commentText.trim()) { void lounge.addComment(post.id, commentText); setCommentText(""); } }} /><button className="ghost" onClick={() => { void lounge.addComment(post.id, commentText); setCommentText(""); }} disabled={!commentText.trim()}>Send</button></div>}
            </div>}
          </div>
        </article>) : <div className="empty-workspace"><span>◉</span><h3>{lounge.status === "ready" ? "The Lounge is waiting for its first shared post." : "The native Lounge appears here once connected."}</h3><p>Set up your Passport, then publish the thought that starts the room.</p></div>}
      </section>
    </div>
  </section>;
}
