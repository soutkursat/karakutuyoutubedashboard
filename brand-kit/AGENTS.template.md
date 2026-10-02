# AGENTS.md — <PRODUCT NAME> · Kara Kutu YouTube Akademisi

> Copy this file into the root of a new Kara Kutu project as `AGENTS.md` (Codex) and/or `CLAUDE.md`
> (Claude Code). Fill in the "This product" section. Keep the rest unchanged.

## Read first
- `brand-kit/ECOSYSTEM.md` — products, domains, infrastructure, shared rules
- `brand-kit/DESIGN.md` — design system (tokens, themes, components, background, checklist)

## This product
- **What it does:** <one paragraph>
- **Address:** <subdomain>.karakutuyoutube.com
- **Stack:** <e.g. Vite + React + TypeScript / Astro / plain HTML>
- **Data:** <none (client-only) | Supabase tables …>
- **Status / next steps:** <…>

## Non-negotiables
- Import `brand-kit/tokens.css` first. Never hard-code accent colours — use `var(--accent-rgb)`,
  `var(--grad-btn)`, `var(--accent-text)`, `var(--on-accent)`. Danger UI uses `--danger-*`.
- Support the three themes (red default, blue, mono) via `<html data-theme>` and
  `localStorage['kk.theme']`; themes change colours only.
- Use the signature background (`brand-kit/background.html`) and keep it faint (readability first).
- UI copy in **Turkish** ("sen" form). Brand name: "Kara Kutu YouTube Akademisi".
- Time zone: `Europe/Istanbul`.
- WhatsApp `wa.me` messages: plain text + `*bold*`, **no emoji**.
- Hosting is Vercel, data/auth is Supabase. **No PHP, no MySQL, no long-running servers.** Server
  logic = short Vercel Function (`api/`) or Supabase SQL function with RLS.
- Don't add a new menu item per feature — extend existing pages with cards/modals.
- In React: never put inline callbacks in `useEffect` dependency lists for modals/forms (it steals
  focus from inputs on every keystroke). Keep them in a ref.

## Before every commit
- `npm run build` (or the project's build) passes.
- Checked at 390 px: no horizontal scroll, no overlapping elements.
- Checked in red, blue and mono.
- Forms tested by typing, not programmatic fill.
