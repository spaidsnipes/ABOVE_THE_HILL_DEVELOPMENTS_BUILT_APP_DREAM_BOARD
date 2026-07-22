"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type IdentityState = "loading" | "ready" | "needs-migration" | "local";

// Deeper identity fields live behind supabase/dreamboard-passport-foundation.sql;
// the view degrades honestly when that migration hasn't been run.
function useCreatorIdentity(user: User | null, notify: (message: string) => void) {
  const [bio, setBio] = useState("");
  const [disciplines, setDisciplines] = useState("");
  const [state, setState] = useState<IdentityState>("local");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) { setState("local"); return; }
      setState("loading");
      const { data, error } = await supabase.from("dreamboard_profiles").select("bio, disciplines").eq("id", user.id).maybeSingle();
      if (error) { setState("needs-migration"); return; }
      setBio(data?.bio || "");
      setDisciplines((data?.disciplines || []).join(", "));
      setState("ready");
    };
    void load();
  }, [user]);

  const save = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || state !== "ready") return;
    setSaving(true);
    const parsed = disciplines.split(",").map(item => item.trim()).filter(Boolean).slice(0, 12);
    const { error } = await supabase.from("dreamboard_profiles").update({ bio: bio.slice(0, 2000), disciplines: parsed }).eq("id", user.id);
    setSaving(false);
    if (error) { notify("Your creator identity could not save yet. Please try again."); return; }
    setDisciplines(parsed.join(", "));
    notify("Your creator identity is saved privately to your Passport.");
  };

  return { bio, setBio, disciplines, setDisciplines, state, saving, save };
}

export function PassportView({ user, email, setEmail, handle, setHandle, status, message, onSend, onSave, onSignOut, notify }: { user: User | null; email: string; setEmail: (value: string) => void; handle: string; setHandle: (value: string) => void; status: string; message: string; onSend: () => void; onSave: () => void; onSignOut: () => void; notify: (message: string) => void }) {
  const identity = useCreatorIdentity(user, notify);
  const missingConnection = status === "needs-connection";
  return <section className="view wm-id">
    <div className="view-heading"><span className="eyebrow">ONE PASSPORT · WOW WORLD</span><h2>Your WOW World Passport.</h2><p>Your secure Passport carries your creator identity through Dreamboard and the World of Wealth—encouraging people to live in the overflow.</p></div>
    <div className="wm-grid">
      <section className="wm-card wm-orbit-card"><div className="wm-seal">WOW</div><span className="eyebrow">WORLD OF WEALTH PASSPORT</span><h3>{user ? `Welcome, ${user.email}` : "Make the work yours."}</h3><p>{user ? "Your account is verified by Supabase. Choose a Passport handle for your place in WOW World." : "Enter your email and Dreamboard sends a secure sign-in link. No additional password to remember."}</p><div className="wm-path"><span>Dreamboard</span><i>→</i><span>WOW Lounge</span><i>→</i><span>WOW Shop</span><i>→</i><span>WOW Radio</span></div></section>
      <section className="wm-card wm-form">{missingConnection ? <><span className="eyebrow">CONNECTION REQUIRED</span><h3>Link the Supabase project.</h3><p>Passport is built into Dreamboard. Add the project URL and publishable key in Vercel, then it becomes live for every visitor.</p><div className="connection-note"><b>Safe connection values only:</b><span>Use your Project URL and Publishable key. Never use a secret key or service-role key in Dreamboard.</span></div></> : !user ? <><span className="eyebrow">CREATE OR SIGN IN</span><h3>Start with your email.</h3><label>EMAIL ADDRESS<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><button className="gold wide" onClick={onSend} disabled={status === "sending"}>{status === "sending" ? "Sending email…" : "Email my Passport link"} <b>→</b></button><p className="wm-message">{message || "We’ll send a secure Passport sign-in link to this email. Check Spam or Promotions if it does not arrive soon."}</p></> : <><span className="eyebrow">CLAIM YOUR PASSPORT</span><h3>Choose the name people will know.</h3><label>PASSPORT HANDLE<input value={handle} onChange={event => setHandle(event.target.value)} placeholder="above_the_hill" autoCapitalize="none" /></label><button className="gold wide" onClick={onSave} disabled={status === "saving"}>{status === "saving" ? "Saving Passport…" : "Save my Passport"} <b>→</b></button><p className="wm-message">{message || "Your Passport stays private until you choose to share in WOW World."}</p><button className="text-button" onClick={onSignOut}>Sign out on this device</button></>}</section>
    </div>
    {user && <div className="wm-grid passport-identity">
      <section className="wm-card wm-form">
        <span className="eyebrow">CREATOR IDENTITY · PROFILE SECTION</span>
        <h3>Tell Dreamboard who is creating.</h3>
        {identity.state === "needs-migration" ? <div className="connection-note"><b>Identity fields need setup:</b><span>Run supabase/dreamboard-passport-foundation.sql in your Supabase project to enable biography and disciplines on your Passport.</span></div> : <>
          <label>BIOGRAPHY<textarea value={identity.bio} onChange={event => identity.setBio(event.target.value)} maxLength={2000} placeholder="A few honest sentences about you and the work you make." disabled={identity.state !== "ready"} /></label>
          <label>DISCIPLINES<input value={identity.disciplines} onChange={event => identity.setDisciplines(event.target.value)} placeholder="writer, teacher, founder — separate with commas" disabled={identity.state !== "ready"} /></label>
          <button className="gold wide" onClick={() => void identity.save()} disabled={identity.state !== "ready" || identity.saving}>{identity.saving ? "Saving…" : "Save creator identity"} <b>→</b></button>
          <p className="wm-message">This profile section stays private to your Passport until you intentionally share work that uses it.</p>
        </>}
      </section>
      <section className="wm-card wm-orbit-card passport-future">
        <span className="eyebrow">PASSPORT · WHAT GROWS FROM HERE</span>
        <h3>Built as your work becomes real.</h3>
        <p>Your Passport will carry these as their systems come online — none of them are simulated in the meantime:</p>
        <ul className="passport-roadmap"><li><b>Projects & Creative Graph</b> — already live, private to this Passport.</li><li><b>Creator timeline & version lineage</b> — grows from your saved versions.</li><li><b>Avatar & media</b> — arrives with private media storage.</li><li><b>Reputation, organizations, legacy</b> — arrive with collaboration and publishing.</li></ul>
      </section>
    </div>}
  </section>;
}
