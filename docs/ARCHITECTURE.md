# Dreamboard Architecture

## Runtime

Next.js 16 App Router built through **vinext** (Vite + Cloudflare adapter).
`worker/index.ts` is the production entry (also serves image optimization).
Deployed via Vercel from `main`. Node >= 22.13.

## Layers

- **UI** — client components under `app/`. Historically everything lived in
  `app/page.tsx`; views are being extracted incrementally into sibling files
  (`app/vision-vault.tsx` was first). `page.tsx` still owns the shell: nav
  rail, active-view switch, Passport session state, and the notice bar.
- **Data** — Supabase from the browser (`lib/supabase-browser.ts`, publishable
  key only; RLS is the security boundary). See docs/DATA_MODEL.md. Every
  feature must degrade to honest local mode when env vars or tables are
  missing.
- **Server routes** — `app/api/ai/route.ts` proxies an OpenAI-compatible
  provider using `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`; returns a truthful 503
  when unconfigured.
- **Styling** — Tailwind 4 is available, but the design system is hand-written
  CSS: `globals.css` (structural base, dark defaults), `dreamboard.css`
  (themes: emerald/midnight/violet/blue + gold), `studios.css`,
  `home-hero.css`, `wm-id.css`. New views should reuse existing classes
  (`view`, `view-heading`, `input-card`, `vault-list`, `season`, `gold`,
  `ghost`) so all four themes keep working.

## Extraction pattern for views

When meaningfully changing a view, move it to `app/<view>.tsx` as a client
component exporting the view plus (when it owns data) a `use<System>` hook
that takes the Supabase `User` and a `notify` callback. Keep shell concerns
(nav, active view, notices) in `page.tsx`.

## Testing

`npm test` builds and runs `tests/rendered-html.test.mjs` against the built
worker (SSR smoke: shell, nav, truthfulness guards). Add behavior tests
alongside new systems as they grow real logic.
