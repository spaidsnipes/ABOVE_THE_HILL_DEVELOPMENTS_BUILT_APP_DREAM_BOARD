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

export type LocalMigrationSummary = { notes: number; draftWords: number; snapshots: number };

export function PassportView({ user, email, setEmail, handle, setHandle, status, message, onSend, onCheckSession, onSave, onSignOut, notify, localMigration, migrationState, onMigrateLocalWork }: { user: User | null; email: string; setEmail: (value: string) => void; handle: string; setHandle: (value: string) => void; status: string; message: string; onSend: () => void; onCheckSession: () => void; onSave: () => void; onSignOut: () => void; notify: (message: string) => void; localMigration: LocalMigrationSummary; migrationState: "idle" | "migrating" | "complete" | "error"; onMigrateLocalWork: () => void }) {
  const identity = useCreatorIdentity(user, notify);
  const missingConnection = status === "needs-connection";
  return <section className="view wm-id">
    <div className="view-heading"><span className="eyebrow">ONE PASSPORT · WOW WORLD</span><h2>Your WOW World Passport.</h2><p>Your secure Passport carries your creator identity through Dreamboard and the World of Wealth—encouraging people to live in the overflow.</p></div>
    <div className="wm-grid">
      <section className="wm-card wm-orbit-card"><div className="wm-seal">WOW</div><span className="eyebrow">WORLD OF WEALTH PASSPORT</span><h3>{user ? `Welcome, ${user.email}` : "Make the work yours."}</h3><p>{user ? "Your account is verified by Supabase. Choose a Passport handle for your place in WOW World." : "Enter your email and Dreamboard sends a secure sign-in link. No additional password to remember."}</p><div className="wm-path"><span>Dreamboard</span><i>→</i><span>WOW Lounge</span><i>→</i><span>WOW Shop</span><i>→</i><span>WOW Radio</span></div></section>
      <section className="wm-card wm-form">{missingConnection ? <><span className="eyebrow">CONNECTION REQUIRED</span><h3>Link the Supabase project.</h3><p>Passport is built into Dreamboard. Add the project URL and publishable key in Vercel, then it becomes live for every visitor.</p><div className="connection-note"><b>Safe connection values only:</b><span>Use your Project URL and Publishable key. Never use a secret key or service-role key in Dreamboard.</span></div></> : !user ? <><span className="eyebrow">CREATE OR SIGN IN</span><h3>Start with your email.</h3><label>EMAIL ADDRESS<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><button className="gold wide" onClick={onSend} disabled={status === "sending"}>{status === "sending" ? "Sending email…" : status === "sent" ? "Send a fresh sign-in link" : "Email my Passport link"} <b>→</b></button>{status === "sent" && <button className="text-button" onClick={onCheckSession}>I opened the link — check Passport</button>}<p className="wm-message">{message || "We’ll send a secure Passport sign-in link to this email. Check Spam or Promotions if it does not arrive soon."}</p><p className="wm-message"><b>Important:</b> the link signs in the exact browser where it opens. To sign in this desktop tab, open the email link in a desktop browser. Opening it on your phone signs in your phone, not this computer.</p></> : <><span className="eyebrow">CLAIM YOUR PASSPORT</span><h3>Choose the name people will know.</h3><label>PASSPORT HANDLE<input value={handle} onChange={event => setHandle(event.target.value)} placeholder="above_the_hill" autoCapitalize="none" /></label><button className="gold wide" onClick={onSave} disabled={status === "saving"}>{status === "saving" ? "Saving Passport…" : "Save my Passport"} <b>→</b></button><p className="wm-message">{message || "Your Passport stays private until you choose to share in WOW World."}</p><button className="text-button" onClick={onSignOut}>Sign out on this device</button></>}</section>
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
      <section className="wm-card wm-form passport-migration">
        <span className="eyebrow">LOCAL WORK → PASSPORT</span>
        <h3>Bring forward only what you approve.</h3>
        <p>{localMigration.notes.toLocaleString()} unsynced note{localMigration.notes === 1 ? "" : "s"} · {localMigration.draftWords.toLocaleString()} draft words · {localMigration.snapshots.toLocaleString()} local version{localMigration.snapshots === 1 ? "" : "s"} found on this device.</p>
        <p className="wm-message">This makes private cloud copies under this Passport. The originals on this device are kept. It never uploads anything until you choose this button.</p>
        <button className="gold wide" onClick={onMigrateLocalWork} disabled={migrationState === "migrating" || migrationState === "complete" || (!localMigration.notes && !localMigration.draftWords && !localMigration.snapshots)}>{migrationState === "migrating" ? "Securing local work…" : migrationState === "complete" ? "Local work secured" : "Secure approved local work"} <b>→</b></button>
        {migrationState === "error" && <p className="wm-message">Some work could not be copied. Nothing was deleted locally; retry when your connection is ready.</p>}
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
