/* Dream Board OS · Collaboration (ported from ~/dreamboard/app/collaboration.tsx + ADR-0006, 2026-11-12)
 * Share one Book Studio book or one project with an invited Passport email, as reader or editor.
 *   - Private by default: nothing is shared until the owner presses Invite (explicit owner action, enforced by RLS + trigger).
 *   - The invitee answers through the dreamboard_share_respond RPC, which only flips status — nobody can raise their own role.
 *   - Shared reading goes through SECURITY DEFINER RPCs that check an accepted share; there are NO new policies on
 *     dreamboard_books / book_* / projects, so shared rows never leak into other rooms' queries for the invitee.
 *   - The author's voice leads: editors never write in the owner's manuscript. Editors (and the owner) leave margin notes.
 * Tables: dreamboard_shares, dreamboard_share_notes (supabase/dreamboard-os-grow.sql). */
(function () {
  "use strict";
  var K = window.DBKit;
  var SQL = "supabase/dreamboard-os-grow.sql";
  var ROLES = [["reader", "Reader", "Can read the shared manuscript or project. Read-only."], ["editor", "Editor", "Can read and leave margin notes. Never edits your words."]];
  function roleHelp(r) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i][0] === r) return ROLES[i][2]; return ""; }

  K.css("collaboration", [
    ".cb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}",
    "@media (max-width:900px){.cb-grid{grid-template-columns:minmax(0,1fr)}}",
    ".cb-list{display:grid;gap:10px}",
    ".cb-share{display:grid;gap:6px}",
    ".cb-share h4{word-break:break-word}",
    ".cb-pill{display:inline-block;font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid rgba(217,181,108,.35);color:var(--gold-hi)}",
    ".cb-pill.pending{color:#9fc7e8;border-color:rgba(159,199,232,.45)}.cb-pill.accepted{color:var(--ok);border-color:rgba(159,211,166,.45)}.cb-pill.declined{color:var(--muted)}",
    ".cb-email{word-break:break-all;color:var(--cream)}",
    ".cb-read{max-width:760px;margin:0 auto}",
    ".cb-read h2{font-family:var(--serif);font-weight:500;font-size:clamp(26px,4vw,40px);color:var(--gold-hi);margin:18px 0 4px}",
    ".cb-read h3.ch{font-family:var(--serif);font-weight:500;font-size:24px;color:var(--cream);margin:26px 0 8px}",
    ".cb-read .part{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-top:22px}",
    ".cb-read p.ps{font-family:var(--serif);font-size:19px;line-height:1.7;color:var(--cream);white-space:pre-wrap;word-break:break-word;margin:0 0 14px}",
    ".cb-read p.ps.ai{border-left:2px solid #9fc7e8;padding-left:10px;color:var(--cream-dim)}",
    ".cb-note{padding:10px 12px;border-radius:12px;background:rgba(4,8,6,.45);border:1px solid rgba(217,181,108,.16)}",
    ".cb-note p{margin:4px 0 0;white-space:pre-wrap;word-break:break-word}"
  ].join("\n"));

  DBRoom.register("collaboration", {
    mount: async function (el) {
      var S = { setup: false, mine: [], incoming: [], books: [], projects: [], view: null, viewData: null, notes: [], kind: "book", role: "reader", label: "" };
      var me = K.ctx.user() || {};

      async function load() {
        try {
          S.mine = await K.q(K.sb.from("dreamboard_shares").select("*").eq("owner_id", K.uid()).order("created_at", { ascending: false }));
          S.incoming = await K.q(K.sb.rpc("dreamboard_shared_with_me"));
        } catch (e) { if (K.missingTable(e) || /function .* does not exist|PGRST202/i.test(String(e.message || e.code))) S.setup = true; else K.toast("Could not open Collaboration: " + (e.message || e), true); }
        try { S.books = (await K.q(K.sb.from("dreamboard_books").select("id,title,owner_id").order("updated_at", { ascending: false }))).filter(function (b) { return b.owner_id === K.uid(); }); } catch (e) { S.books = []; }
        try { S.projects = await K.q(K.sb.from("dreamboard_projects").select("id,title").eq("owner_id", K.uid()).order("updated_at", { ascending: false })); } catch (e) { S.projects = []; }
        try { var pr = await K.q(K.sb.from("dreamboard_profiles").select("display_name").eq("id", K.uid()).maybeSingle()); S.label = (pr && pr.display_name) || ""; } catch (e) {}
        if (!S.label) S.label = String(me.email || "").split("@")[0];
      }
      function titleOf(kind, id) { var list = kind === "book" ? S.books : S.projects; var x = list.find(function (t) { return t.id === id; }); return x ? x.title : "(no longer available)"; }

      function incomingPanel() {
        var e = K.esc;
        var list = S.incoming.length ? '<div class="cb-list">' + S.incoming.map(function (s) {
          return '<article class="rm-item cb-share" data-id="' + s.id + '"><div class="rm-meta">' + (s.target_kind === "book" ? "Book" : "Project") + " · from " + e(s.owner_label) + " · " + K.fmtDay(s.created_at) + ' <span class="cb-pill ' + s.status + '">' + e(s.status) + '</span> <span class="cb-pill">' + e(s.role) + "</span></div><h4>" + e(s.title) + "</h4>" + (s.note ? '<p class="rm-meta" style="margin:0;white-space:pre-wrap">' + e(s.note) + "</p>" : "") +
            '<div class="rm-row">' + (s.status === "pending" ? '<button class="btn small solid" data-a="accept">Accept</button><button class="btn small" data-a="decline">Decline</button><span class="rm-meta">No access until you accept.</span>' : '<button class="btn small solid" data-a="open" data-k="' + s.target_kind + '" data-t="' + s.target_id + '">Open (read-only)</button><button class="btn small" data-a="leave">Leave</button>') + "</div></article>";
        }).join("") + "</div>" : '<p class="rm-meta">Nothing has been shared with your Passport (' + e(me.email || "") + ").</p>";
        return K.panel("Shared with me", "Invitations sent to your Passport email. You choose whether to accept.", list);
      }

      function sharePanel() {
        var e = K.esc, list = S.kind === "book" ? S.books : S.projects;
        var pick = list.length ? '<select id="cb-t" class="bk-in">' + list.map(function (t) { return '<option value="' + t.id + '">' + e(t.title) + "</option>"; }).join("") + "</select>"
          : '<p class="rm-meta" style="margin:0">' + (S.kind === "book" ? 'No Book Studio book on your Passport yet. <a href="#/book">Open Book Studio</a> — a book syncs to your Passport once it is saved.' : 'No projects yet. <a href="#/r/projects">Open Projects</a>.') + "</p>";
        return K.panel("Share your work", "Private by default. Nothing is shared until you press Invite.",
          '<div class="rm-form"><div class="rm-tabs" role="tablist"><button class="btn small" data-a="kind" data-v="book" aria-pressed="' + (S.kind === "book") + '">A book</button><button class="btn small" data-a="kind" data-v="project" aria-pressed="' + (S.kind === "project") + '">A project</button></div>' +
          '<label class="rm-l" for="cb-t">What to share</label>' + pick +
          '<label class="rm-l" for="cb-e">Their Passport email</label><input id="cb-e" class="bk-in" type="email" autocomplete="off" maxlength="320" placeholder="name@example.com">' +
          '<label class="rm-l" for="cb-r">Role</label><select id="cb-r" class="bk-in">' + ROLES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === S.role ? " selected" : "") + ">" + r[1] + "</option>"; }).join("") + '</select><p class="rm-meta" id="cb-rh" style="margin:0">' + e(roleHelp(S.role)) + "</p>" +
          '<label class="rm-l" for="cb-n">A note to them (optional)</label><input id="cb-n" class="bk-in" maxlength="500" placeholder="What you would love their eyes on">' +
          '<div class="rm-row"><button class="btn solid" data-a="invite"' + (list.length ? "" : " disabled") + '>Invite</button></div>' +
          '<p class="rm-meta" style="margin:0">Dream Board does not send an email. They see the invitation here when they sign in with that Passport email, and they gain access only after accepting. Access is enforced by database policy, not by this screen.</p></div>');
      }

      function minePanel() {
        var e = K.esc;
        var list = S.mine.length ? '<div class="cb-list">' + S.mine.map(function (s) {
          return '<article class="rm-item cb-share" data-id="' + s.id + '"><div class="rm-meta">' + (s.target_kind === "book" ? "Book" : "Project") + " · invited " + K.fmtDay(s.created_at) + ' <span class="cb-pill ' + s.status + '">' + e(s.status) + (s.status === "pending" ? " — no access yet" : "") + '</span></div><h4>' + e(titleOf(s.target_kind, s.target_id)) + '</h4><div class="cb-email">' + e(s.invited_email) + "</div>" +
            (s.responded_at ? '<div class="rm-meta">' + (s.status === "accepted" ? "Accepted " : "Declined or left ") + K.fmtDay(s.responded_at) + "</div>" : "") +
            '<div class="rm-row"><label class="rm-l">Role <select class="bk-in" style="width:auto" data-a="role">' + ROLES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === s.role ? " selected" : "") + ">" + r[1] + "</option>"; }).join("") + '</select></label><button class="btn small" data-a="open" data-k="' + s.target_kind + '" data-t="' + s.target_id + '">Notes &amp; preview</button><button class="btn small" data-a="revoke">Remove</button></div></article>';
        }).join("") + "</div>" : K.empty("No one has access to your work. Everything is private to you.");
        return K.panel("People you invited", "Change a role or remove someone at any time — they lose access immediately.", list);
      }

      function readerView() {
        var e = K.esc, d = S.viewData, isBook = S.view.kind === "book", body = "";
        if (!d) return K.empty("Opening…");
        if (isBook) {
          var chs = d.chapters || [], ps = d.passages || [], lastPart = null;
          body = '<h2>' + e(d.book && d.book.title || "Untitled") + "</h2>" + (d.book && d.book.subtitle ? '<p class="rm-meta">' + e(d.book.subtitle) + "</p>" : "") +
            (chs.length ? chs.map(function (c) {
              var part = c.part && c.part !== lastPart ? '<div class="part">' + e(c.part) + "</div>" : ""; lastPart = c.part || lastPart;
              var mine = ps.filter(function (p) { return p.chapter_id === c.id; });
              return part + '<h3 class="ch">' + e(c.title) + "</h3>" + (mine.length ? mine.map(function (p) { return '<p class="ps' + (p.speaker !== "author" ? " ai" : "") + '">' + (p.speaker !== "author" ? '<span class="rm-meta">Not the author\'s words · </span>' : "") + e(p.body) + "</p>"; }).join("") : '<p class="rm-meta">No passages placed in this chapter yet.</p>');
            }).join("") : '<p class="rm-meta">The author has not arranged chapters yet.</p>');
        } else {
          var p = d.project || {};
          body = "<h2>" + e(p.title || "Untitled") + '</h2><p class="rm-meta">' + e(p.kind || "") + " · " + e(p.stage || "") + (p.progress != null ? " · " + p.progress + "% by the owner's own measure" : "") + "</p>" + (p.vision ? '<p class="ps">' + e(p.vision) + "</p>" : "") +
            ((d.timeline || []).length ? '<h3 class="ch">Timeline</h3>' + d.timeline.map(function (t) { return '<p class="rm-meta"><b style="color:var(--cream)">' + e(t.title) + "</b> · " + K.fmtDay(t.occurred_at) + (t.detail ? " — " + e(t.detail) : "") + "</p>"; }).join("") : "");
        }
        var canNote = d.role === "owner" || d.role === "editor";
        var notes = S.notes.length ? '<div class="cb-list">' + S.notes.map(function (n) { return '<div class="cb-note" data-id="' + n.id + '"><div class="rm-meta">' + e(n.author_label || "A collaborator") + (n.is_review_request ? ' · <span class="cb-pill">review request</span>' : "") + " · " + K.fmtDay(n.created_at) + "</div><p>" + e(n.body) + "</p>" + (n.author_id === K.uid() || d.role === "owner" ? '<div class="rm-row" style="margin-top:6px"><button class="btn small" data-a="note-del">Delete</button></div>' : "") + "</div>"; }).join("") + "</div>" : '<p class="rm-meta">No notes yet.</p>';
        var compose = canNote ? '<div class="rm-form" style="margin-top:12px"><label class="rm-l" for="cb-note">Leave a note</label><textarea id="cb-note" class="bk-ta" style="min-height:90px;font-size:16px" maxlength="4000" placeholder="A margin note for the author — it never changes their words."></textarea><div class="rm-row"><button class="btn small solid" data-a="note-add">Add note</button><button class="btn small" data-a="note-add" data-r="1">Request a review</button></div></div>' : '<p class="rm-meta" style="margin-top:8px">You are a reader here. Ask the owner for the editor role to leave notes.</p>';
        return '<div class="rm-row" style="margin-bottom:10px"><button class="btn small" data-a="back">← Back to Collaboration</button><span class="cb-pill">' + e(d.role === "owner" ? "you own this" : d.role) + '</span><span class="rm-meta">Read-only view</span></div>' +
          '<div class="bk-panel cb-read">' + body + "</div>" + K.panel("Margin notes", "Notes sit beside the work. Nothing is written into the manuscript.", notes + compose);
      }

      function paint() {
        var head = K.scene("Collaboration · private until you choose", "Invite a reader or an editor.",
          "Share one book or one project with a Passport you trust. Readers read; editors leave margin notes. No one writes in your book but you.",
          "art-book-studio.jpg", '<a class="btn" href="#/book">Book Studio</a>');
        if (S.setup) { el.innerHTML = head + '<div class="bk-work one">' + K.setupNotice("Collaboration", SQL) + "</div>"; return; }
        if (S.view) { el.innerHTML = head + '<div class="bk-work one">' + readerView() + "</div>"; return; }
        el.innerHTML = head + '<div class="bk-work one">' + incomingPanel() + '<div class="cb-grid">' + sharePanel() + minePanel() + "</div></div>";
      }

      async function openView(kind, id) {
        S.view = { kind: kind, id: id }; S.viewData = null; S.notes = []; paint(); window.scrollTo(0, 0);
        try {
          S.viewData = await K.q(K.sb.rpc(kind === "book" ? "dreamboard_shared_book" : "dreamboard_shared_project", kind === "book" ? { bid: id } : { pid: id }));
          S.notes = await K.q(K.sb.from("dreamboard_share_notes").select("*").eq("target_kind", kind).eq("target_id", id).order("created_at"));
        } catch (e) { K.toast("Could not open: " + (e.message || e), true); S.view = null; }
        paint();
      }

      el.addEventListener("change", async function (ev) {
        var t = ev.target;
        if (t.id === "cb-r") { S.role = t.value; var h = el.querySelector("#cb-rh"); if (h) h.textContent = roleHelp(t.value); return; }
        if (t.dataset.a === "role") {
          var id = t.closest("[data-id]").dataset.id;
          try { await K.update("dreamboard_shares", id, { role: t.value }); S.mine.forEach(function (s) { if (s.id === id) s.role = t.value; }); K.toast("Role changed to " + t.value + "."); }
          catch (e) { K.toast("Could not change the role: " + (e.message || e), true); }
        }
      });

      el.addEventListener("click", async function (ev) {
        var b = ev.target.closest("[data-a]"); if (!b || !el.contains(b) || b.tagName === "SELECT") return;
        var a = b.dataset.a, row = b.closest("[data-id]"), id = row && row.dataset.id;
        try {
          if (a === "kind") { S.kind = b.dataset.v; paint(); return; }
          if (a === "invite") {
            var tid = (el.querySelector("#cb-t") || {}).value, email = String(el.querySelector("#cb-e").value || "").trim().toLowerCase(), role = el.querySelector("#cb-r").value, note = el.querySelector("#cb-n").value.trim();
            if (!tid) return K.toast("Choose what to share.", true);
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return K.toast("Enter a valid Passport email.", true);
            if (email === String(me.email || "").toLowerCase()) return K.toast("That is your own Passport — you already own this.", true);
            if (!confirm("Share \"" + titleOf(S.kind, tid) + "\" with " + email + " as " + role + "?\nThey get access only after they accept.")) return;
            var s = await K.insert("dreamboard_shares", { target_kind: S.kind, target_id: tid, invited_email: email, role: role, note: note.slice(0, 500) });
            S.mine.unshift(s); paint(); K.toast("Invitation recorded for " + email + ". They see it when they sign in with that Passport."); return;
          }
          if (a === "revoke") {
            if (!confirm("Remove this person? They immediately lose access.")) return;
            await K.remove("dreamboard_shares", id); S.mine = S.mine.filter(function (s) { return s.id !== id; }); paint(); K.toast("Removed. They no longer have access."); return;
          }
          if (a === "accept" || a === "decline" || a === "leave") {
            if (a === "leave" && !confirm("Leave this shared work? You will need a new invitation to see it again.")) return;
            var r = await K.q(K.sb.rpc("dreamboard_share_respond", { sid: id, accept: a === "accept" }));
            if (r === "not_found") return K.toast("That invitation is no longer open.", true);
            S.incoming = await K.q(K.sb.rpc("dreamboard_shared_with_me")); paint();
            K.toast(a === "accept" ? "Accepted — you can read it now under your assigned role." : a === "leave" ? "You left the shared work." : "Invitation declined."); return;
          }
          if (a === "open") { openView(b.dataset.k, b.dataset.t); return; }
          if (a === "back") { S.view = null; S.viewData = null; paint(); return; }
          if (a === "note-add") {
            var body = el.querySelector("#cb-note").value.trim(); if (!body) return K.toast("Write the note first.", true);
            var owner = S.viewData.role === "owner" ? K.uid() : (S.incoming.find(function (s) { return s.target_id === S.view.id; }) || {}).owner_id;
            // owner_id of the target is resolved in the database (policy checks it); ask it when we are not the owner
            if (!owner) owner = await K.q(K.sb.rpc("dreamboard_target_owner", { kind: S.view.kind, tid: S.view.id }));
            var n = await K.q(K.sb.from("dreamboard_share_notes").insert({ owner_id: owner, author_id: K.uid(), author_label: S.label.slice(0, 120), target_kind: S.view.kind, target_id: S.view.id, body: body.slice(0, 4000), is_review_request: b.dataset.r === "1" }).select().single());
            S.notes.push(n); paint(); K.toast(n.is_review_request ? "Review requested — it sits beside the work as a note." : "Note left beside the work."); return;
          }
          if (a === "note-del") {
            if (!confirm("Delete this note?")) return;
            await K.remove("dreamboard_share_notes", id); S.notes = S.notes.filter(function (n) { return n.id !== id; }); paint(); return;
          }
        } catch (e) {
          var m = String(e.message || e);
          K.toast(e.code === "23505" ? "That Passport is already invited to this." : /Only the owner/.test(m) ? "Only the owner can share this." : "Could not save: " + m, true);
        }
      });

      el.innerHTML = K.scene("Collaboration", "Opening…", "", "art-book-studio.jpg");
      await load();
      paint();
    }
  });
})();
