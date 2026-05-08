# Cavalier Flooring — Project Brief

> Hand this to a new Claude Code session as the starting context for building the Cavalier Flooring website. This is **v1 scope only** — more requirements will land later.

## What this is

A new marketing website for **Cavalier Flooring**, a commercial flooring contractor. Primary purpose: **portfolio + lead capture**. Visitors browse past projects, get a sense of the company, and reach out about their own work.

I'm the founder. I recently built the CTX201 website with Claude Code (it lives in this same workspace, at `/Users/sheilamcgovern/Desktop/Projects2026/CTX201`). Several patterns from CTX201 are being deliberately reused. **Read CTX201's code first** when in doubt about how something should work — the working implementation is the source of truth, not this brief.

---

## Tech stack (match CTX201 — proven)

- **Frontend:** React 19 + Vite + Tailwind v4 + react-router-dom v7
- **Backend:** FastAPI + Supabase + Anthropic SDK (Claude sonnet-4.5 for the AI tool, haiku-4.5 for the chat widget)
- **Hosting:** Railway (frontend + backend each as a service; Supabase managed)
- **Auth:** admin-only password + signed cookie session. **No public user auth in v1.**
- **Rate limiting:** slowapi, same patterns
- **Logging:** Supabase `logs` table + the `log_event()` helper pattern

---

## Design system

### Colors
Cavalier's brand is **maroon and black**. The feel should be confident, gallery-like, calm — not loud "construction company." Quiet premium.

| token | hex (starting point) | purpose |
|---|---|---|
| `--charcoal` | `#1A1816` *(TBD)* | primary surface — dusky deep charcoal, warmer than navy |
| `--cream` | `#F9F5EF` | secondary surface — for sections that should breathe |
| `--maroon` | `#7B1E2C` *(TBD with founder — pull from logo)* | brand accent, hover states, emphasis words |
| `--black` | `#000000` | hard contrast moments |
| `--off-white` | TBD | body text on charcoal |

**Use cream sparingly** — for the about page, product detail areas, anywhere that should feel like a different room. Charcoal is the dominant surface.

### Typography (same as CTX201)
- **Display / serif:** Cormorant Garamond (headlines, italic accents)
- **Body / sans:** DM Sans
- Load both from Google Fonts in `index.html` (copy the link from CTX201's `client/index.html`).

Match the CTX201 typography rhythm: large display headlines with tight letter-spacing (`-0.02em`), generous body line-height (~1.7–1.9), italic display for quoted/reflective lines.

### Style principles (lifted from CTX201)
- **Quiet confidence over sales energy.** No oversized buttons. Text-link CTAs with hairline underlines (`borderBottom: '1px solid rgba(...)'`).
- **Hairline dividers** between sections (`1px solid rgba(<color>, 0.08)`).
- **Eyebrow labels** above section headlines: small, uppercase, wide letter-spacing (`0.14em`–`0.16em`), often in maroon.
- **Sticky-footer flex layout:** `#root { display: flex; flex-direction: column; min-height: 100vh; }` with `main { flex: 1 }`. Background is the dominant surface color (charcoal here, was navy on CTX201).
- **Scroll-to-top on route change** + page-view tracking. Lift the `<PageTracker />` component from CTX201's `client/src/App.jsx`.
- **Vite HMR fix:** copy the `server.watch.usePolling: true` config from CTX201's `vite.config.js` so file changes reliably trigger reloads on macOS.

---

## Pages (v1)

### `/` — Home
**TBD.** Define separately when we get there. For now: a hero + a 3-card preview into the project gallery + a quiet contact CTA. Don't over-design before founder reviews.

### `/projects` — Project gallery (main public surface)
- Grid of cards, searchable + filterable by project type.
- Each card: project name, 1+ images (first is the thumbnail), short description, project type tag, location.
- Filter UI: chip-style row at top — `All · Healthcare · Retail · Multi-family · ...`. Project types finalized with founder before building.
- Search: text input filters card names/descriptions client-side.
- Card click → `/projects/:slug`.

### `/projects/:slug` — Project detail
- Full image gallery (carousel or scroll-grid).
- Long description.
- Metadata: location, year, square footage, flooring product used.
- "Discuss a similar project →" link → opens contact modal (lift CTX201's `ContactModal.jsx` pattern).

### `/about` — Company story
Standard about page. Photo, story, the team, principles. Founder will provide copy.

### `/contact` — Contact
- Form fields: **name, company, email, phone (optional), message**.
- Lift `ContactForm.jsx` + `ContactModal.jsx` from CTX201 verbatim, then reskin colors.
- Includes an **"Optional first step"** block above the form linking to the Describe-Your-Project tool. Same pattern CTX201 uses on contact for its Interview / Possibilities tools. The tool's input flows into the contact submission via `sessionStorage`. See `formatLeadContext()` in CTX201's `ContactForm.jsx` for the format.

### `/admin` — Admin (private)
Reuse CTX201's auth + nav pattern. Tabs:
- **Submissions** — contact form rows
- **Project Intakes** — AI tool's Q&A history
- **Projects** — *new* — CRUD UI to add/edit gallery projects (form + image upload)
- **Logs** — system + user activity logs

---

## AI tools (lifted from CTX201)

### Describe-Your-Project (analogous to CTX201's Interview)
Pattern based on `Interactive.jsx` + `routes/readiness.py`:
- Free-form text input. Visitor describes: space type, approximate square footage, current floor (if any), intended use, timeline, budget if comfortable.
- POST to `/api/project-intake`.
- Backend calls Claude sonnet-4.5 with a system prompt in Cavalier's voice: warm, expert, plainspoken. The AI reflects the project back, names the likely product type (LVT, polished concrete, carpet tile, etc.), surfaces 1–2 things to think about, and ends with what the natural next step is. **Never gives a hard quote** — that's a real conversation.
- Saves description + AI output to `project_responses`.
- After the result: a "Let's Talk →" button opens the contact modal with the AI exchange pre-attached.

### Chatbot (same as CTX201's ChatWidget)
- Floating bubble in the corner.
- Knowledge base: `server/knowledge_base.md` — founder writes the content (what they install, what they don't, geographies, response time, basic FAQ).
- Claude haiku-4.5 for cost.
- Rate-limited 30/day per IP, same as CTX201.

---

## Database (Supabase) schema

RLS disabled by default; admin queries use the service role key. All non-PK columns nullable unless noted.

### `contacts` (identical to CTX201)
- `id` uuid PK
- `name`, `company`, `email`, `phone`, `message`
- `created_at` timestamptz default `now()`

### `project_responses` (analogous to `readiness_responses`)
- `id` uuid PK
- `project_description` text — what the visitor wrote
- `ai_output` text — Claude's response
- `created_at` timestamptz default `now()`

### `projects` *(new — gallery storage)*
- `id` uuid PK
- `slug` text UNIQUE — URL-friendly identifier
- `name` text
- `project_type` text — values from a finalized list (TBD with founder)
- `location` text — e.g., "Charlottesville, VA"
- `year` int
- `square_footage` int
- `flooring_type` text — "LVT", "Polished Concrete", "Carpet Tile", etc.
- `short_description` text — card-level
- `long_description` text — detail page
- `image_urls` text[] — array of Supabase storage URLs
- `is_public` bool default true — hide private/NDA projects
- `created_at` timestamptz default `now()`

### `logs` (identical to CTX201)
- `id`, `level`, `event`, `route`, `message`, `metadata` (jsonb), `created_at`.
- Levels: `info` / `warning` / `error`.
- Same `log_event()` helper.

---

## Image handling (new — decide before building)

CTX201 has no image uploads, so this is novel territory.

**Recommended: Supabase Storage.** Same Supabase project, public bucket for project images. Admin upload UI uses the Supabase JS client with the admin session.

Each project: support 1–10 images. First image = card thumbnail; rest are the detail-page gallery. Encourage 4:3 or 3:2 aspect in the upload UI but support both.

Alternative: Cloudinary (better transforms + CDN, but adds a service). Default to Supabase Storage unless founder asks for it.

---

## Reused infrastructure (lift verbatim from CTX201, reskin only)

| What | Where in CTX201 |
|---|---|
| Themed contact form (light + dark) | `client/src/components/ContactForm.jsx` |
| Modal wrapper for contact | `client/src/components/ContactModal.jsx` |
| Multi-step Q&A AI tool UI | `client/src/components/Interactive.jsx` |
| Streaming AI tool UI | `client/src/components/FitAssessment.jsx` |
| Floating chat widget | `client/src/components/ChatWidget.jsx` |
| Page tracking + scroll-to-top | `client/src/App.jsx` (`<PageTracker />`) |
| Sticky-footer + body bg | `client/src/index.css` |
| HMR polling fix | `client/vite.config.js` |
| Admin auth + cookie | `server/routes/admin.py` |
| Admin panel UI | `client/src/pages/AdminPage.jsx` |
| Logging helper | `server/logger.py` |
| Page-view tracking endpoint | `server/routes/tracking.py` |
| Rate-limit handler that logs | `server/main.py` (`rate_limit_handler`) |

**Lift, don't reinvent.** If CTX201's pattern works, use it. Spend creative energy on what's actually new (gallery + image upload + the project-intake AI prompt).

---

## What NOT to do in v1

- Don't add Stripe / quote calculation / online scheduling.
- Don't add public user authentication. Admin-only.
- Don't add Google Analytics or Mixpanel — the page-view logging pattern from CTX201 is already in place; port it.
- Don't try to scrape existing Cavalier site content — founder will provide copy.
- Don't add a blog or news section.
- Don't auto-generate project types or flooring types — founder defines the controlled vocabularies.

---

## Things to ASK before writing code

The new Claude Code session should ask the founder these *before* scaffolding:

1. **Exact maroon hex.** Pull from existing brand assets (logo, business card, vehicle wrap) — don't pick fresh.
2. **Project types list.** Healthcare / Retail / Multi-family / Office / Education / Industrial / Hospitality / other?
3. **Flooring types list.** LVT / Polished Concrete / Carpet Tile / Sheet Vinyl / Rubber / Wood / Tile / other?
4. **Geographic markers.** Cities/regions Cavalier serves. Used in About + on each project.
5. **Knowledge base content** for the chatbot. Founder writes; do not invent.
6. **Cavalier's voice.** Read CTX201's voice if helpful — calm, plainspoken, confident, not salesy. Confirm Cavalier wants the same tone or something different.
7. **Logo / wordmark.** What format do they have it in? SVG ideal, PNG ok.
8. **Chatbot scope.** Lead-capture-leaning ("tell me about your project") or general-info-leaning (FAQ-style)? CTX201's is general-info. Flooring contractors often want lead-capture. Confirm.
9. **Project-intake AI: what's the suggested next step?** Site visit? Phone call? An info packet? Must be defined *before* writing the system prompt.
10. **Private/NDA projects.** Are there clients Cavalier can't name publicly? If yes, the `projects.is_public` flag handles it; if no, drop the column.
11. **Admin user(s).** Just the founder, or multiple admins? CTX201 has one admin password — same pattern OK?

---

## Suggested build order

1. **Scaffold + design system.** Vite + React + Tailwind config, CSS variables (charcoal, cream, maroon, black), font imports, sticky-footer layout, page-tracker / scroll-to-top.
2. **Static pages first.** Nav, Footer, About, basic Home. No data yet.
3. **Database migrations.** Create the four tables in Supabase. Seed `projects` with 2–3 sample rows so the gallery has something to render.
4. **Project gallery.** `/projects` reading from Supabase with filter chips and search input.
5. **Project detail.** `/projects/:slug`.
6. **Contact form + modal.** Lift from CTX201, reskin.
7. **Project-intake AI tool.** Backend route, frontend Q&A UI, sessionStorage handoff to contact modal.
8. **Chat widget.** Backend route, knowledge_base.md, frontend bubble.
9. **Admin panel.** Auth, then the four tabs.
10. **Image upload UI.** Inside admin → Projects.
11. **Logging.** Add `log_event()` to every user-facing route entry. Add page-view tracking. Add rate-limit handler.
12. **Polish + deploy.** Railway services, env vars, Supabase bucket policies.

Each step should leave the app deployable. Don't stack 5 partial features.

---

## Future (not v1, just noting)

- Public client portal — clients log in to see project status.
- Online scheduling for site visits.
- Email automations (drip after contact submission).
- Blog / case studies.
- Gallery sort by date / size / location.
- Multi-language support.

These are explicitly out of scope. Don't pre-build for them.
