# Dreamboard — Engineering Brief

Dreamboard is the flagship product of Above the Hill Developments: a Creative
Operating System that helps creators capture ideas, organize knowledge, write,
publish, and preserve their work. It is an **existing production app** deployed
from `main`. Do not rebuild it. Continue from the codebase that exists.

Full product vision: [docs/vision/dreamboard-bible.md](docs/vision/dreamboard-bible.md)
Current implementation status: [docs/STATUS.md](docs/STATUS.md)
Architecture decisions: [docs/adr/](docs/adr/)

## Stack

- Next.js 16 App Router running through **vinext** (Cloudflare Workers adapter);
  `worker/index.ts` is the worker entry. Deploys via Vercel from `main`.
- React 19, Tailwind 4 (via PostCSS) plus hand-written CSS in `app/*.css`.
- **Supabase is the real backend**: magic-link auth, Postgres tables, and the
  `dreamboard-private` storage bucket. The SQL files in `supabase/` are the
  source of truth for the schema — update them when you change tables.
- Drizzle + D1 are scaffolding from the starter template and are intentionally
  unused (`db/schema.ts` is empty on purpose). Don't wire them up without a
  decision recorded in an ADR.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (must pass before pushing)
- `npm test` — builds, then runs the rendered-HTML smoke test
- `npm run lint`

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(browser client returns `null` without them — every feature must degrade
gracefully to local mode), and `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` for
`app/api/ai/route.ts`.

## Architecture reality

Almost the entire UI lives in `app/page.tsx` — one client component holding all
19 views and their state. This was fine for the foundation release but is the
main structural debt. When you do significant work on a view, extract it into
its own component file under `app/` as part of that work. Do not do a big-bang
rewrite of `page.tsx`; decompose incrementally, view by view, keeping behavior
identical.

## Non-negotiable rules

1. **Truthfulness.** No fake data, no mock content, no invented sources, no UI
   that claims something happened when it didn't. Empty states are honest and
   welcoming. The app repeatedly promises users "nothing is invented" — keep
   that promise in code. (See ADR-0002.)
2. **Naming: Passport, not Profile, not WM ID.** All user-facing copy says
   Passport. Internal leftovers (`wm_id` table, `wmUser` state, `wm-id.css`)
   exist for history — migrate them opportunistically, never reintroduce WM ID
   in the UX. (See ADR-0001.)
3. **Privacy by default.** Vault entries, graph nodes, documents, and imports
   are private to the signed-in creator (RLS on owner_id). Sharing is always an
   explicit user action. Never use the service-role key in app code.
4. **Design language.** Cream, emerald, gold, warm neutrals; calm, premium,
   editorial. Themes are `emerald-gold | midnight-gold | violet-gold |
   blue-gold` on `.os-shell`. Never restyle toward generic SaaS. Don't redesign
   a screen unless the change materially improves usability or consistency.
5. **The user's voice leads.** AI reviews and suggests; it never silently
   modifies a manuscript. Companion output must distinguish evidence,
   interpretation, speculation, and creative suggestion.

## Workflow

- Branch per system (`feature/passport`, `feature/creative-graph`, …); merge to
  `main` only when built and tested. Small fixes and docs may go straight to
  `main`.
- `npm run build` must pass before any push — `main` auto-deploys.
- Record significant architectural choices as a short ADR in `docs/adr/`.
- Keep `docs/STATUS.md` current when a system moves between placeholder →
  working.

## Priorities

1. Passport, Vision Vault, Creative Graph, Creator Home
2. Google Drive Import (and import text-extraction pipeline), AI Companion,
   Knowledge Vault
3. Lounge, Shop, Creator Economy

## WOW World

Dreamboard is part of the WOW World ecosystem. Lounge, Shop, and Radio embed
live surfaces from the WOW World app (`wealthymindsets-pro.vercel.app`) via
iframes, alongside Dreamboard's own Supabase-backed community tables.
