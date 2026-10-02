# Hub Site — karakutuyoutube.com

The front door of the brand: it **introduces** Kara Kutu YouTube Akademisi, **showcases** every tool
and **routes** people to them. It is also the main marketing page, so it must be fast, findable on
Google and beautiful. A working skeleton is in [`example/index.html`](example/index.html).

## 1. Goals (in order)
1. A visitor understands in 5 seconds what Kara Kutu is and who it is for.
2. Every tool is one click away (cards → subdomains).
3. Prospective students contact us (WhatsApp) or log in to the Dashboard.
4. It ranks for Turkish YouTube-growth searches (SEO) and looks premium when shared.

## 2. Information architecture (single page first)

| # | Section | Content | Primary action |
|---|---|---|---|
| 1 | Top nav (`.site-nav`) | Brand · Araçlar · Nasıl çalışır · (Mentörlük) · theme swatches | "Panele giriş" → dashboard |
| 2 | Hero | `.chip-outline` brand label, `.display` headline with one `.grad-text` phrase, `.lead`, 2 buttons | "Araçları keşfet" |
| 3 | Tools (`#araclar`) | One `.product` card per product: icon, status badge (Yayında / Yakında), 1–2 sentences, button | each card → its subdomain |
| 4 | How it works | 3 steps | — |
| 5 | Mentorship | What the programme is, who it's for, what you get (sessions, Meet, follow-up) | WhatsApp |
| 6 | Social proof (later) | Student results, channel screenshots, quotes — only real ones | — |
| 7 | FAQ (later) | 5–8 short Q&As | — |
| 8 | Final CTA | `.card.glass.glow` centred, WhatsApp button | WhatsApp |
| 9 | Footer | © · Gizlilik · Kullanım koşulları · social links | — |

Add separate pages (e.g. `/mentorluk`, `/blog`) only when one page gets too long. Products keep
living on their own subdomains; the hub only links to them.

### Product registry
Keep products in one data list (title, description, url, status, icon) so adding a tool = adding one
entry. Status values: `live` → `.badge-live` "Yayında", `soon` → `.badge-soon` "Yakında".

## 3. Tech recommendation

- **Static-first** for SEO and speed: plain HTML (like the example) or **Astro** (static output) with
  `tokens.css`. If React is needed for a widget, use it only for that island. Avoid a client-only SPA
  for the hub — search engines and link previews need real HTML.
- Hosting: a **new Vercel project** (free). No server code needed. No PHP/MySQL (see ECOSYSTEM.md).
- Performance budget: < 100 KB JS, LCP < 2.5 s on 4G; images as WebP/AVIF with width/height set;
  fonts via Google Fonts with `display=swap`.

## 4. SEO & sharing checklist
- `<html lang="tr">`, unique `<title>` and `<meta name="description">` (Turkish).
- Open Graph + Twitter card tags with a 1200×630 image in the brand style.
- One `<h1>` (the hero headline); sections use `<h2>`.
- `sitemap.xml`, `robots.txt`, canonical URL `https://karakutuyoutube.com/`.
- Structured data: `Organization` (+ `Course`/`Service` for mentorship if relevant).
- `www.karakutuyoutube.com` redirects to the apex (or the other way round — pick one).

## 5. Going live (DNS at Natro)
1. Create the Vercel project, add domains `karakutuyoutube.com` and `www.karakutuyoutube.com`.
2. In Natro DNS add **exactly** the records Vercel displays (typically an `A` record for the apex and a
   `CNAME` for `www`). Remove the old Natro parking/redirect for the apex.
3. **Do not touch** the `dashboard` CNAME (or any other product subdomain).
4. The Google OAuth "Authorized domain" is already `karakutuyoutube.com` — once the hub is live it
   also satisfies Google's homepage requirement if we ever submit the app for verification.

## 6. Content guidelines
Turkish, "sen" form, concrete outcomes ("kanalını büyüt", "formülünü çöz"), no hype words without
proof. Real numbers and real student results only. Every claim on the page must be true today —
mark unfinished tools "Yakında".
