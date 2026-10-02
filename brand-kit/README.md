# Kara Kutu Brand Kit

The shared design system and project guide for every **Kara Kutu YouTube Akademisi** product:
the hub site (`karakutuyoutube.com`), the Mentorship Dashboard, ChannelPrompt, Thumbnail Studio and
anything built later. Copy this folder into a new project so that every product looks, feels and is
built the same way — by humans and by AI coding assistants (Claude, Codex…).

> Source of truth: `brand-kit/` in the **karakutuyoutubedashboard** repository. When a token or
> component changes, change it here first, bump the version in `tokens.css`, then copy it to the
> other projects.

## What's inside

| File | What it is | Read it when… |
|---|---|---|
| [`ECOSYSTEM.md`](ECOSYSTEM.md) | Map of products, domains, infrastructure, shared rules | Starting any new project or feature |
| [`DESIGN.md`](DESIGN.md) | Design language: tokens, themes, typography, components, background, do/don't | Building any UI |
| [`HUB-SITE.md`](HUB-SITE.md) | Plan for `karakutuyoutube.com` (the hub / landing site) | Building the hub |
| [`AGENTS.template.md`](AGENTS.template.md) | Drop-in instructions for AI assistants in a new repo | Creating a new repo |
| [`tokens.css`](tokens.css) | Framework-agnostic CSS: tokens, 3 themes, background, surfaces, buttons, forms, marketing layout | Always — import it first |
| [`theme.js`](theme.js) | 1 KB theme switcher (red / blue / mono), no dependencies | The page needs a theme picker |
| [`background.html`](background.html) | Markup for the signature background (grid, side lights, glowing YouTube logo) | Every page |
| [`example/index.html`](example/index.html) | A working hub page built only with the kit | You want a starting point |

## Quick start

### Plain HTML / Astro / any static site
```html
<head>
  <!-- 1. apply the saved theme before paint (no colour flash) -->
  <script>try{var t=localStorage.getItem('kk.theme');if(t==='blue'||t==='mono')document.documentElement.dataset.theme=t}catch(e){}</script>
  <!-- 2. fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800;900&display=swap" rel="stylesheet" />
  <!-- 3. the kit -->
  <link rel="stylesheet" href="/brand-kit/tokens.css" />
</head>
<body>
  <!-- paste background.html here -->
  …
  <script src="/brand-kit/theme.js"></script>
</body>
```

### React + Vite (like the Dashboard)
1. Copy `tokens.css` into `src/` and `import './tokens.css'` **before** your own stylesheet.
2. Put the theme snippet in `index.html` `<head>`.
3. Copy `src/components/Background.tsx`, `src/components/ThemePicker.tsx` and `src/lib/theme.ts`
   from the Dashboard repo (same markup and storage key as `background.html` / `theme.js`).

### Try the example
```bash
cd brand-kit && python3 -m http.server 8080   # then open http://localhost:8080/example/
```

## Rules in one breath
Dark background · glass cards · accent from theme variables only · three themes (red default, blue,
mono) that change colours **only** · danger is always red · Turkish UI copy · test at 390 px ·
the background never hurts readability. Details in [`DESIGN.md`](DESIGN.md).
