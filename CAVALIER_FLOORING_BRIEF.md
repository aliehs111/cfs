# Cavalier Flooring — Project Brief

> Hand this to a new Claude Code session as the starting context for building the Cavalier Flooring website. This is **v1 scope only** — more requirements will land later.

## What this is

A new marketing website for **Cavalier Flooring**, a commercial flooring contractor. Primary purpose: **portfolio + lead capture**. Visitors browse past projects, get a sense of the company, and reach out about their own work.

I'm the founder. I recently built the CTX201 website with Claude Code (it lives in this same workspace, at `/Users/sheilamcgovern/Desktop/Projects2026/CTX201`). Several patterns from CTX201 are being deliberately reused. **Read CTX201's code first** when in doubt about how something should work — the working implementation is the source of truth, not this brief.

---

## Current build status

As of the last audit, the build order is approximately:

| Step | Item | Status |
|---|---|---|
| 1 | Scaffold + design system | ✅ Done |
| 2 | Static pages (Nav, Footer, About, Home) | ✅ Done |
| 3 | Database migrations + seed data | ✅ Done |
| 4 | Project gallery (`/projects`) | ✅ Done |
| 5 | Project detail (`/projects/:slug`) | ✅ Done |
| 6 | Contact form + modal | ✅ Done |
| 7 | Project-intake AI tool (`/discuss`) | ✅ Done |
| 8 | Chat widget | ✅ Done |
| 9 | Admin panel | ⚠️ Partial — Submissions + Intakes tabs built; Projects and Logs tabs remaining |
| 10 | Image upload UI | ❌ Not started |
| 11 | Logging (log_event helper + route instrumentation) | ❌ Not started — `/api/track/visit` is a stub (returns 204, no DB write) |
| 12 | Polish + deploy | ❓ Unknown |

---

## Tech stack (match CTX201 — proven)

- **Frontend:** React 19 + Vite + Tailwind v4 + react-router-dom v7
- **Backend:** FastAPI + Supabase + Anthropic SDK (`anthropic==0.40.0`, pinned in `requirements.txt`) — claude-sonnet-4-5 for the project-intake tool, claude-haiku-4-5 for the chat widget
- **Hosting:** Railway (frontend + backend each as a service; Supabase managed)
- **Auth:** admin-only password + signed cookie session (7-day TTL). **No public user auth in v1.**
- **Rate limiting:** slowapi, same patterns as CTX201
- **Logging:** Supabase `logs` table defined in schema. `logger.py` / `log_event()` **not yet implemented** — see build status above.

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
- **Scroll-to-top on route change** + page-view tracking. `<PageTracker />` component lives in `client/src/App.jsx`.
- **`<ChatGate />`** component in `App.jsx` suppresses the chat widget on admin pages — render `<ChatWidget />` conditionally based on `location.pathname.startsWith('/admin')`.
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

### `/discuss` — Describe Your Project (project intake tool)
Multi-turn AI conversation. Visitor selects a role (owner/facility vs. GC/specifier) then describes their project in free text. The backend (`server/routes/intake.py`) runs a 3-turn conversation with role-specific and turn-aware system prompts:

- **Turn 1:** reflect if description is rich enough; ask one clarifying question if too sparse
- **Turns 2–3:** prefer to give the reflection; one more question only if critical
- **Turn 4+ (final):** forced wrap-up — no questions, name outstanding items as discussion points for the phone call

Two role tracks with different guidance:
- **Owner/facility:** help them think through product fit and things they may not have considered
- **GC/specifier (contractor/architect/designer):** assume they know the product; focus on scope fit, geography, schedule, sequencing concerns

Saves to `project_responses` table only when the conversation is "complete" (AI response doesn't end with a question, or it's the final turn).

After the result: a "Let's Talk →" button opens the contact modal with the AI exchange pre-attached.

### `/admin` — Admin (private)
Password + signed cookie auth (7-day session). Tabs currently built:
- **Submissions** — contact form rows ✅
- **Project Intakes** — AI tool conversation history ✅

Tabs remaining:
- **Projects** — CRUD UI to add/edit gallery projects (form + image upload) ❌
- **Logs** — system + user activity logs ❌

---

## AI tools

### Describe-Your-Project (`/discuss`)
See page description above. The implementation in `server/routes/intake.py` is the authoritative source. Key notes:
- Uses claude-sonnet-4-5
- Role field (`owner` / `specifier`) is captured from the UI and passed to the API
- System prompt is assembled from: `BASE_PROMPT + role_guidance + turn_addendum`
- **Product scope in `intake.py` currently uses the old 5-category list** (LVT, VCT, carpet tile, sheet vinyl, ceramic tile). This is out of sync with the updated `knowledge_base.md`, which now includes wall tile, specialty wall panels, and concrete slab services. The intake system prompt needs a pass to align with the full scope.

### Chat widget (`ChatWidget.jsx`)
- Floating bubble in the corner; hidden on `/admin` via `<ChatGate />` in `App.jsx`
- Knowledge base: `server/knowledge_base.md` — read fresh on every request; no restart needed to pick up edits
- System prompt: thin wrapper in `server/routes/chat.py` — all behavioral rules and guidance live in the KB file itself
- Claude haiku-4-5 for cost
- Rate-limited 30/day per IP

---

## Database (Supabase) schema

RLS disabled by default; admin queries use the service role key. All non-PK columns nullable unless noted.

### `contacts` (identical to CTX201)
- `id` uuid PK
- `name`, `company`, `email`, `phone`, `message`
- `created_at` timestamptz default `now()`

### `project_responses` (analogous to `readiness_responses`)
- `id` uuid PK
- `project_description` text — first user message in the conversation
- `ai_output` text — Claude's final response
- `role` text — `"owner"` or `"specifier"` (from intake UI role selection)
- `created_at` timestamptz default `now()`

### `projects` *(new — gallery storage)*
- `id` uuid PK
- `slug` text UNIQUE — URL-friendly identifier
- `name` text
- `project_type` text — values from a finalized list (seed data uses: Healthcare, Retail, Multi-family)
- `location` text — e.g., "Charlottesville, VA"
- `year` int
- `square_footage` int
- `flooring_type` text — "LVT", "Sheet Vinyl", "Carpet Tile", etc.
- `short_description` text — card-level
- `long_description` text — detail page
- `image_urls` text[] — array of Supabase storage URLs
- `is_public` bool default true — hide private/NDA projects
- `created_at` timestamptz default `now()`

### `logs` (identical to CTX201)
- `id`, `level`, `event`, `route`, `message`, `metadata` (jsonb), `created_at`.
- Levels: `info` / `warning` / `error`.
- `log_event()` helper **not yet implemented** — table exists but nothing writes to it.

---

## Image handling (new — decide before building)

CTX201 has no image uploads, so this is novel territory.

**Recommended: Supabase Storage.** Same Supabase project, public bucket for project images. Admin upload UI uses the Supabase JS client with the admin session.

Each project: support 1–10 images. First image = card thumbnail; rest are the detail-page gallery. Encourage 4:3 or 3:2 aspect in the upload UI but support both.

Alternative: Cloudinary (better transforms + CDN, but adds a service). Default to Supabase Storage unless founder asks for it.

---

## Reused infrastructure (lift verbatim from CTX201, reskin only)

| What | CTX201 origin | CFS equivalent |
|---|---|---|
| Themed contact form (light + dark) | `client/src/components/ContactForm.jsx` | `client/src/components/ContactForm.jsx` |
| Modal wrapper for contact | `client/src/components/ContactModal.jsx` | `client/src/components/ContactModal.jsx` |
| Multi-turn AI tool UI | `client/src/components/Interactive.jsx` | `client/src/components/ProjectIntake.jsx` |
| Floating chat widget | `client/src/components/ChatWidget.jsx` | `client/src/components/ChatWidget.jsx` |
| Page tracking + scroll-to-top | `client/src/App.jsx` (`<PageTracker />`) | `client/src/App.jsx` (`<PageTracker />`, `<ChatGate />`) |
| Sticky-footer + body bg | `client/src/index.css` | `client/src/index.css` |
| HMR polling fix | `client/vite.config.js` | `client/vite.config.js` |
| Admin auth + cookie | `server/routes/admin.py` | `server/routes/admin.py` |
| Admin panel UI | `client/src/pages/AdminPage.jsx` | `client/src/pages/AdminPage.jsx` |
| Logging helper | `server/logger.py` | **Not yet implemented** |
| Rate-limit handler that logs | `server/main.py` (`rate_limit_handler`) | `server/main.py` |

---

## What NOT to do in v1

- Don't add Stripe / quote calculation / online scheduling.
- Don't add public user authentication. Admin-only.
- Don't add Google Analytics or Mixpanel — the page-view logging pattern from CTX201 is already in place; port it.
- Don't try to scrape existing Cavalier site content — founder will provide copy.
- Don't add a blog or news section.
- Don't auto-generate project types or flooring types — founder defines the controlled vocabularies.

---

## Things to ASK / confirm with founder

1. **Exact maroon hex.** Pull from existing brand assets (logo, business card, vehicle wrap) — don't pick fresh.
2. **Project types list.** Seed data uses Healthcare / Retail / Multi-family — confirm full list before building admin CRUD.
3. **Flooring types list.** Seed data uses LVT / Sheet Vinyl / Carpet Tile — confirm full list. Note: the KB now covers wall tile, specialty panels, and concrete slab services; the intake system prompt still uses the old 5-category list and needs a pass.
4. **Geographic markers.** Cities/regions Cavalier serves. Used in About + on each project. Currently in intake.py: Charlottesville, Central VA up to Fredericksburg, Tidewater (Virginia Beach, Norfolk).
5. **Knowledge base content** for the chatbot. Currently seeded from the context seed document — confirm it's complete or add more.
6. ~~**Cavalier's voice.**~~ Confirmed: calm, plainspoken, confident, not salesy. Established in intake.py system prompt and KB.
7. **Logo / wordmark.** What format do they have it in? SVG ideal, PNG ok.
8. ~~**Chatbot scope.**~~ General-info FAQ style (from ChatWidget opening message). The `/discuss` tool handles lead-capture.
9. ~~**Project-intake AI: what's the suggested next step?**~~ Phone call. Established in intake.py: "the natural next step is a quick phone conversation."
10. **Private/NDA projects.** Are there clients Cavalier can't name publicly? If yes, `projects.is_public` handles it; if no, drop the column.
11. ~~**Admin user(s).**~~ One admin password, same pattern as CTX201.

---

## Suggested build order (remaining work)

1. ~~Scaffold + design system~~ ✅
2. ~~Static pages first~~ ✅
3. ~~Database migrations~~ ✅
4. ~~Project gallery~~ ✅
5. ~~Project detail~~ ✅
6. ~~Contact form + modal~~ ✅
7. ~~Project-intake AI tool~~ ✅
8. ~~Chat widget~~ ✅
9. **Admin panel — Projects + Logs tabs** ← next up
10. **Image upload UI** (inside admin → Projects)
11. **Logging** — implement `log_event()`, instrument routes, wire `/api/track/visit` to write to DB
12. **Intake system prompt** — update product scope to match the updated KB (wall tile, specialty panels, slab services)
13. **Polish + deploy** — Railway services, env vars, Supabase bucket policies

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
