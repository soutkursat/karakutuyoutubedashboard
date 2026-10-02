# Kara Kutu Design System

Premium, dark, cinematic — like a YouTube studio at night. Every product must feel like part of the
same family. All values below live in [`tokens.css`](tokens.css); class names are identical to the
Dashboard, so the same vocabulary works everywhere.

## 1. Principles

1. **Dark canvas, light content.** Near-black background, white text, content on frosted glass.
2. **One accent, used with intent.** The accent (red by default) marks the *one* primary action,
   active states and highlights — not decoration everywhere.
3. **Depth through light, not borders.** Soft glows, gradients and translucent glass instead of heavy
   lines and boxes.
4. **Readability beats atmosphere.** Background effects must never reduce text contrast (see §6).
5. **Simple to use.** Few menus, obvious primary action, Turkish copy in plain language.
6. **Same on every screen.** Mobile-first; nothing overflows at 390 px.

## 2. Colour

### Neutrals (all themes)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#070708` | page background |
| `--text` | `#f6f6f7` | primary text |
| `--muted` | `#a3a3ad` | secondary text, descriptions |
| `--dim` | `#6e6e78` | hints, captions, placeholders-ish |
| `--line` / `--line-2` | white 7.5 % / 14 % | hairlines, input borders / hover |
| `--glass` | white 6 % → 1.8 % gradient | card fill |

### Accent — the only thing themes change
| Token | Red (default) | Blue | Mono |
|---|---|---|---|
| `--accent-rgb` | `255,45,70` | `45,125,255` | `255,255,255` |
| `--accent2-rgb` (gradient end) | `255,122,47` (orange) | `47,208,255` (cyan) | `190,190,205` |
| `--grad` (text gradient) | `#ff2d55 → #ff3b3b → #ff7a2f` | `#2d6dff → #3b8bff → #2fd0ff` | `#fff → #e4e4e7 → #a1a1aa` |
| `--grad-btn` (primary fill) | `#ff3a4f → #e3122c` | `#3a8bff → #1257e3` | `#fff → #d4d4d8` |
| `--accent-text` | `#ff5a6e` | `#5c9dff` | `#f4f4f5` |
| `--on-accent` (text on a filled accent) | white | white | **near-black** |

How to use them:
```css
.thing { background: rgba(var(--accent-rgb), 0.12); color: var(--accent-text); }
.cta   { background: var(--grad-btn); color: var(--on-accent); }   /* never color:#fff on accent */
```

### Semantic (never themed)
| Meaning | Token / colour |
|---|---|
| Danger: delete, cancel, error | `--danger-rgb`, `--danger-line`, `--danger-text` — red in **every** theme |
| Success / live / confirmed | `--green` `#22c55e` (text `#4ade80`) |
| Warning / pending / waiting | `--amber` `#f5b544` |
| WhatsApp | `.btn-wa` green `#25d366` |

**Never** hard-code `#ff2d46`, `rgba(255,45,70,…)` or any accent value in a component. If you need a
new accent shade, add a token to all three theme blocks.

## 3. Themes

- `red` (default, no attribute), `blue` (`<html data-theme="blue">`), `mono` (`data-theme="mono"`).
- Themes change **colours only**. A layout test must produce identical element positions in all three.
- Saved in `localStorage['kk.theme']`; apply it in `<head>` *before* CSS loads (snippet in README) so
  there is no colour flash. Picker: three round swatches (see `theme.js` / Dashboard `ThemePicker`).
- In mono, primary buttons are white with black text — always use `--on-accent`.

## 4. Typography

Fonts: **Inter** (body, 400–700) and **Inter Tight** (headings, 600–900) from Google Fonts.

| Role | Class / style |
|---|---|
| Hero headline | `.display` — `clamp(40px, 6vw, 72px)`, weight 900, letter-spacing −0.045em, line-height 1.02 |
| Section title | `.h2` — `clamp(28px, 3.6vw, 44px)`, weight 900 |
| Page title (app) | ~`clamp(28px, 3.4vw, 38px)`, weight 900 |
| Card title | `.card-title` — 18px, weight 800 |
| Body | 15px / 1.55, Inter |
| Lead paragraph | `.lead` — 17px, `--muted`, max 560px wide |
| Eyebrow (label above a title) | `.eyebrow` — 11.5px, uppercase, letter-spacing .14em, `--accent-text` |
| Hint / caption | `.fine` / `.field-hint` — 12–12.5px, `--dim` |

Highlight one phrase per headline with `.grad-text` (e.g. "Kanalını büyütmek için **tek merkez.**").

## 5. Shape, spacing, depth

- Radius: `--r-xl` 24px (cards), `--r-lg` 18px (rows), `--r-md` 12px (buttons, inputs), `--r-sm` 9px,
  pills `99px`.
- Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 28 · 36 px. Card padding 26px (20px on mobile).
  Gap between cards 20px (mobile 10–16px).
- Shadow: `--shadow` (large, soft, black). Accent glow only on primary buttons and `.glow` cards.

## 6. The signature background (`background.html` / `Background.tsx`)

Layers, back to front: radial accent glows (top-left, bottom-right) → 56px grid masked to fade out →
subtle noise → **side lights** (accent light bleeding in from left/right edges) → 1px glowing **edge
lines** → a large, very faint **YouTube logo** with a soft breathing halo.

Readability rules (measured, keep them):
- Logo width `min(34vw, 460px)`, stroke opacity ≤ 0.2, fill ≤ 0.07, overall `--logo-k` 0.9
  (mono 0.55). Light should *spread*, never form a bright spot behind text.
- Content sits on `.glass` cards in front of it. Headlines that sit directly on the background must
  stay ≥ 7:1 contrast.
- Breathing animation is slow (9 s) and disabled for `prefers-reduced-motion`.
- With a sidebar layout, shift the logo into the content area: `.bg-logo { --logo-x: calc(50% + 140px) }`.

## 7. Components (class names)

| Component | Classes | Notes |
|---|---|---|
| Card | `.card.glass` | add `.glow` for the one hero/important card on a screen |
| Primary button | `.btn.btn-primary` | **one per view**; sizes `.btn-sm` / default / `.btn-lg`; `.btn-block` full width |
| Secondary | `.btn.btn-ghost` | glassy outline |
| Tertiary | `.btn.btn-text` | text-only |
| Destructive | `.btn.btn-danger` | always red |
| WhatsApp | `.btn.btn-wa` | green, with the WhatsApp icon |
| Field | `.field` > `.field-label` + `.input` + `.field-hint` | 46px inputs, focus ring in accent |
| Chip / toggle chip | `.chip`, `.chip.active` | day pickers, topic pickers, filters |
| Badge | `.badge` + `.badge-live` / `.badge-soon` / `.badge-muted` | statuses |
| Notice | `.notice` | inline info strip; warn/success variants in the Dashboard |
| Brand | `.brand` > `.brand-mark` + `.brand-text` | red rounded square with white play triangle + "Kara Kutu YouTube Akademisi" |
| Status pill | `.pill-status` | green dot + text (e.g. "Veriler cihazından çıkmaz") |
| Outline chip label | `.chip-outline` | uppercase brand label above a hero headline |
| Product card (hub) | `.product.card.glass` | icon tile, status badge, title, text, button |
| Top nav (hub) | `.site-nav` | sticky, blurred; links collapse on mobile |

Dashboard-only patterns worth reusing (copy from that repo): modal with focus handling, toast,
segmented control (`.seg`), switch, stepper, day strip + slot grid, user menu with theme picker.

### Icons
Inline SVG, 24×24 viewBox, `stroke="currentColor"`, stroke-width 1.8, round caps/joins (Lucide-style).
Sizes 16 / 18 / 22. No icon fonts, no emoji in UI chrome.

## 8. Motion

Fast and subtle: hover 150–200 ms; modals "pop" in 220 ms; button press = 1px down. No parallax, no
autoplaying carousels. Respect `prefers-reduced-motion` (kit disables all animation).

## 9. Responsive

Breakpoints: **900px** (sidebars → drawer, 3-col → 1-col), **640px** (compact paddings, stacked
forms). Always test **390×844**. Rules: no horizontal scroll; grid children get `min-width: 0`;
long words wrap; tap targets ≥ 34px.

## 10. Voice & copy (Turkish UI)

Friendly, direct, "sen" form, short sentences. Buttons are verbs: "Randevu al", "Kaydet", "Panele git".
Explain *why* in hints, not in walls of text. Errors say what to do next. Brand name always in full:
"Kara Kutu YouTube Akademisi".

## 11. Do / Don't

| Do | Don't |
|---|---|
| One primary button per view | Several competing red buttons |
| Accent via tokens | Hard-coded hex/rgba accent values |
| Glass cards on the signature background | Flat grey boxes or white pages |
| Put new features in existing pages/cards | Add a new menu item for every feature |
| Measure readability when touching the background | Make the logo bigger/brighter "for vibe" |
| Danger in red in every theme | Theme-coloured delete buttons |

## 12. Ship checklist

- [ ] Imports `tokens.css`; no hard-coded accent colours (`grep -nE "255, ?45, ?70|#ff2d" src`)
- [ ] Works in red, blue and mono; identical layout in all three
- [ ] 390px: no horizontal scroll, nothing overlaps, tap targets OK
- [ ] Forms tested by real typing; focus never jumps out of an input
- [ ] Text over the background is readable in all themes
- [ ] Links to privacy policy and terms in the footer
- [ ] Production build passes
