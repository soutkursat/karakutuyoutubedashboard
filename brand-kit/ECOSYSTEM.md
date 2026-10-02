# Kara Kutu Ecosystem

What we have, what we are building, and how everything fits together. Every project (and every AI
assistant working on one) should read this first.

## 1. The brand

- **Name:** Kara Kutu YouTube Akademisi (always written exactly like this; "YouTube" with a capital T).
- **What it is:** a YouTube education and mentorship brand for Turkish creators — especially
  faceless / documentary-style channels. Mentor: Kürşat.
- **Audience:** Turkish-speaking YouTubers, beginner to monetised. Mostly on mobile.
- **Language:** all user-facing copy is **Turkish**. Code, comments and docs may be English.
- **Contact:** WhatsApp +90 537 793 50 90 (primary channel — most students talk to us there).

## 2. Products

| Product | Address | Status | One-liner |
|---|---|---|---|
| **Hub site** | `karakutuyoutube.com` | Planned | Landing + showcase; the gateway to every tool. See [`HUB-SITE.md`](HUB-SITE.md). |
| **Mentorship Dashboard** | `dashboard.karakutuyoutube.com` | **Live** | Students book 1:1 mentorship sessions; the mentor manages everything. |
| **ChannelPrompt** ("Kanal Klonlayıcı") | TBD (e.g. `prompt.karakutuyoutube.com`) | Built (separate project) | Crack a successful channel's formula and turn it into a Claude Project prompt. |
| **Thumbnail Studio** | TBD (e.g. `thumbnail.karakutuyoutube.com`) | Planned | Thumbnail ideas/designs that get clicks. |

Subdomain names for new tools are not final. Pick short, lowercase, Turkish-friendly ASCII names and
add them to this table.

### 2.1 Mentorship Dashboard (live)
Repo: `soutkursat/karakutuyoutubedashboard`. Stack: Vite + React 19 + TypeScript, Supabase, Vercel.
- **Students:** register/login; book a slot from the mentor's weekly availability (Istanbul time);
  booking-frequency rule (new members: first 4 bookings 1 per week, then 1 per 2 weeks; cancelled
  bookings don't count); one-tap WhatsApp notification with a pre-filled message; profile with
  WhatsApp number, Skool membership, YouTube channels (link, monetisation, start date, upload days or
  frequency, video count, niche, content format, biggest challenge, up to 3 competitor channels).
- **Admin (mentor):** appointments (approve, Meet link, complete, cancel), weekly availability with
  copy-day, students (detailed add/edit, rights editing: new member vs veteran, remaining weekly
  rights, "remove waiting period"), settings, Google Calendar connection.
- **Google:** the *mentor's* Google account creates a calendar event with an automatic **Google Meet
  link** for every booking and invites the student when confirmed. Availability is **not** read from
  Google — it comes only from the dashboard's weekly schedule. Students never connect Google.
- **Legal pages:** `/gizlilik` (privacy, incl. Google Limited Use statement) and `/kosullar` (terms).

### 2.2 ChannelPrompt (built, separate project)
"Faceless channel prompt system". The user enters a reference channel (link, name, content language)
and its **5 most-viewed videos** (title, transcript — required; thumbnail — recommended). The tool
produces **one prompt** to paste into a **Claude Project**, so Claude first analyses the channel and
then produces every new video with the user, from idea to SEO. Flow: `1 Kanal → 2 5 video → 3 Prompt →
4 Claude Projesi`. Privacy promise shown in the UI: *"Veriler cihazından çıkmaz"* — data stays in the
browser. Its original visual style (dark, red→orange gradient, glass cards, step pills) is the origin
of this design system.

### 2.3 Thumbnail Studio (planned)
Scope not final. Must follow this kit and the shared rules below.

## 3. Infrastructure

| Piece | Service | Notes |
|---|---|---|
| Domain + DNS | **Natro** | Natro only manages the domain/DNS. Natro shared hosting (PHP/MySQL, 1 GB RAM) is **not used** by any product. |
| Hosting | **Vercel** (free plan) | One Vercel project per product. `dashboard.` is a CNAME to Vercel. |
| Server code | Vercel Functions (`api/` folder) | Short-lived only (~10 s). No always-on servers, no cron on the free plan. |
| Database + auth | **Supabase** (free plan) | Postgres + Auth + Realtime. 500 MB DB. Security lives in RLS policies and SQL functions. |
| Google | Google Cloud project "My First Project" (OAuth client "Web client 1") | Scope: `calendar.events` (+ `openid email`). Authorised domain: `karakutuyoutube.com`. App must stay **In production** (Testing mode expires tokens every 7 days). |

**Do not build** anything that needs PHP, MySQL, a long-running Node process, or heavy background
jobs. If server logic is needed: a short Vercel Function or a Supabase SQL function.

### Adding a new product
1. New repo + new Vercel project (Vite preset or Astro).
2. Copy `brand-kit/` and `AGENTS.template.md` → `AGENTS.md` (fill in the product section).
3. Natro DNS: add the **exact** record Vercel shows for the new subdomain (usually a CNAME). Never
   touch the existing `dashboard` record.
4. If it needs accounts or data: use the **same Supabase project** as the Dashboard (one user base),
   add tables with RLS in a re-runnable SQL file.
5. Add it to the product table above and to the hub site.

## 4. Shared rules (all products)

- **Design:** follow [`DESIGN.md`](DESIGN.md). Import `tokens.css`; never hard-code accent colours.
- **Themes:** red (default), blue, mono. Stored in `localStorage['kk.theme']`. Note: localStorage is
  per origin, so each subdomain remembers its own choice (a shared cookie on `.karakutuyoutube.com`
  is the upgrade path if we want one setting everywhere).
- **Accounts:** one Supabase project = one user base. Today each app has its own login session
  (sessions are per origin). Single sign-on across subdomains is a planned upgrade (Supabase auth
  with a cookie scoped to `.karakutuyoutube.com`) — do not build a second auth system.
- **Time:** always `Europe/Istanbul`.
- **WhatsApp links** (`https://wa.me/<number>?text=…`): plain text + `*bold*` only. **No emoji** —
  WhatsApp Desktop/Web shows them as "�" when they arrive through a link.
- **Privacy:** collect only what the feature needs; every product links to the privacy policy and terms.
- **Quality bar:** `npm run build` passes, mobile (390 px) checked, no horizontal scroll, no overlapping
  elements, forms tested with real typing (not programmatic fill).
