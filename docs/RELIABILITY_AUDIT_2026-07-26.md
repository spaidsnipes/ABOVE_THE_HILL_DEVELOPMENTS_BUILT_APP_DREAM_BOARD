# Dreamboard reliability audit — July 26, 2026

This audit was performed against the public Dreamboard build and the connected Supabase project. It distinguishes working journeys from incomplete integrations so creators are never asked to trust a decorative button.

## What works now

- Creator Home starts without sample projects or synthetic creative material.
- Quick Capture, Vision Vault, local writing, version snapshots, Reader controls, Markdown/EPUB export, project navigation, Research, Legacy, Creative Graph, and Companion routing render with honest empty states.
- Bulk Import accepts a creator-selected file and clearly waits for a Passport before private cloud storage begins.
- The Companion now has the promised 30 declared personas and 30 skills. It caps routing at three personas and labels local, non-model output as such.
- Dreamboard's WOW World surface opens Lounge, Shop, and Radio without putting Passport identity or private material in a URL.

## Repairs shipped in this pass

- An empty Knowledge Vault now leads to **Bulk Import**, not an empty vault.
- Passport messaging now tells the truth about device sessions: an email link signs in only the browser where it opens. A person who opens the link on a phone is signed in on that phone, not on their desktop.
- Passport now has an **I opened the link — check Passport** action that checks the current browser session instead of leaving the creator guessing.

## What is not yet a completed service

- **Cross-device Passport / WOW World single sign-on:** Dreamboard and WM Pro presently use different browser-session models. The embedded WM Pro Lounge correctly asks for its own login. This needs a shared auth design and an explicit callback flow; an iframe cannot safely borrow another app's session.
- **Mobile-to-desktop email sign-in:** the current Supabase magic-link template must be changed to send an OTP code if we want a phone to deliver a code that the desktop can verify. Until then, creators must open the link in the browser they want signed in.
- **Google Drive, text extraction, search indexing, and AI retrieval for thousands of pages:** the intake ledger and private storage groundwork exist, but the long-running consent, processing, chunking, and search pipeline is still a build item. Do not upload a 7,000-page library as a single unsupported batch.
- **AI generation:** the routing and transparency framework is real; a hosted model provider, spend controls, and consent are still required before it can generate from private work.
- **Publishing and Shop checkout:** present exports are local formats. Public publishing, checkout, payments, taxes, and fulfillment are not yet connected.
- **Broker connections in WM Pro:** current broker links are not bank/broker OAuth connections. A real version needs provider-approved OAuth/API credentials, callback routes, encrypted server-side token storage, account consent, revocation, and compliance review. It must not claim a brokerage account is connected before those checks pass.

## Security finding that blocks public social posting

The older WOW Lounge tables use public write policies keyed only to client-provided handles. That allows impersonation and arbitrary deletion. They must be migrated to an owner UUID plus server-authenticated writes before public community posting is enabled. The existing client code also uses a custom cookie model, so this must be corrected together with WM Pro rather than by a database policy that silently breaks the live lounge.

## Next 20 milestones (36–55)

1. Passport callback and session recovery in the active browser.
2. Verified email-code sign-in option after the Supabase template/configuration change.
3. WOW World shared-auth architecture decision and domain/callback map.
4. WM Pro authenticated server API boundary.
5. Lounge owner UUID migration and restrictive RLS.
6. Radio owner/role migration and secure upload authorization.
7. Audit logging for identity, posts, uploads, and consent changes.
8. Resumable import session ledger for thousands of files.
9. Private storage upload limits, hashes, retries, and duplicate detection.
10. Text extraction worker with file-level failures and reprocessing.
11. Creator-approved chunking and retrieval index.
12. Google Drive OAuth consent and folder selection.
13. Vault search, filters, and source provenance.
14. Project creation and source-to-project assignment.
15. Book Architect real outline, chapter, and source linking.
16. Voice-learning references with ownership consent and coverage reporting.
17. Provider-backed Companion with context controls, budget limits, and provenance.
18. Writer recovery, offline protection, and export verification.
19. Luminous long-session visual/accessibility pass (contrast, reduced motion, focus, density).
20. Full signed-in end-to-end, security, and load test before a public launch claim.

Each milestone has a visible user journey and a verifiable completion condition; none should be marked complete only because a screen exists.
