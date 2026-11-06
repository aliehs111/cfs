# Specs — Planned Work

Features agreed on but not yet built. Each section is meant to be enough context to start a fresh session.

### Suggested order

**Before launch: these risk losing leads or breaking the site**
- §4 Email notifications for submissions *(do first)*
- §5 Spam protection on forms *(build alongside §4)*
- ~~§11 `/discuss` prompt aligned with the chatbot knowledge base~~ ✅ done
- §18 Thorough review of the AI context, so the bots never say something Cavalier wouldn't
- §6 Production hosting setup (US region, Supabase plan, backups)
- §7 Account ownership, billing and costs *(a decision, not code)*
- §8 Mobile navigation menu
- §10 Admin → Projects tab with photo upload
- §9 Privacy policy page
- §13 Heading font fix *(decision + small change)*
- §16 Accessibility pass

**At launch**
- §3 SEO and moving the domain off Hibu
- §14 Uptime and error monitoring
- §17 Client handoff guide

**After launch**
- §1 Staff sign-in accounts, comments and replies
- §2 Share posts to Instagram/LinkedIn
- §12 Logging and Logs tab
- §15 Update the Anthropic SDK and models
- §19 Fix existing lint errors *(small; any time)*

---

## 1. Staff sign-in accounts for In the Field (posts, comments, replies)

**Status:** Not started. Requested Nov 2026.

### Goal

Know **who posted what and who replied**. Replace the single shared team password on In the Field with individual sign-in accounts, then add comments and replies on posts.

### Current state (what exists today)

- Public feed: `/in-the-field` → [client/src/pages/FieldPage.jsx](client/src/pages/FieldPage.jsx)
- Staff posting page: `/in-the-field/post` → [client/src/pages/FieldPostPage.jsx](client/src/pages/FieldPostPage.jsx). Reached via the faint hard-hat icon on the In the Field page.
- Backend: [server/routes/field.py](server/routes/field.py)
  - One shared password (`FIELD_PASSWORD` env var on the Railway **server** service) → signed cookie `cavalier_field_session`, 30-day TTL. An admin session is also accepted.
  - Uploads: backend issues a Supabase signed upload URL; the browser uploads straight to the `field-media` storage bucket.
  - Anyone signed in can delete any post.
- Database: `field_posts` table (see bottom of [schema.sql](schema.sql)). `author` is free text typed by the poster, so it's not trustworthy. RLS is enabled with no policies; the backend uses the service-role key.

**Problems this fixes:** anyone with the password can post under any name. You can't revoke one person without changing the password for everyone. Anyone can delete anyone's post.

### Scope

**In:**
1. **Individual staff accounts.** Invite-only: no public sign-up. Admin adds or removes people by email.
2. **Posts tied to a real user.** Show the poster's real name on each post; drop the free-text author field.
3. **Comments and replies on posts**, by signed-in staff. Show names and timestamps.
4. **Permissions:**
   - Staff can create posts and comments, and edit or delete **their own**.
   - Admin role can delete anything and manage users.
5. Admin panel: a **Team** tab to invite, deactivate, and set the role (staff / admin).

**Out (for now):**
- Public (non-staff) comments or accounts. Decided against for now because of spam and moderation burden. Revisit separately if wanted.
- Notifications (email/push when someone replies). Possible follow-up.
- Reactions/likes.

### Open decisions (ask the founder before building)

1. **Are comments public?** Can website visitors *read* staff comments, or are comments internal to the team only?
2. **Sign-in method:** emailed magic link (recommended — nothing to remember on a job site), Google sign-in, or email + password?
3. **Reply depth:** replies to a post only, or replies to replies too? A single level of nesting is recommended.
4. **What happens to the existing posts** whose `author` is free text? Assign them to a user, or leave them as-is with the old name?
5. Should the existing admin password login move onto the same account system (admin = a user with the admin role)?

### Suggested approach

- **Supabase Auth** for accounts. It's in the same project, handles magic links and email delivery, and needs no extra service.
  - Turn off public sign-ups in Supabase Auth settings. Admin invites users via the backend (service-role `auth.admin.invite_user_by_email`).
  - Frontend: add `@supabase/supabase-js` for sign-in and session handling only. Send the user's access token to the FastAPI backend as `Authorization: Bearer …`. The backend verifies the JWT and looks up the user's profile and role.
  - Keep all database writes going through FastAPI (service-role key, RLS stays on with no public policies). Same pattern as today.
- **New tables (draft):**
  - `profiles` — `id` (= auth user id), `full_name`, `role` (`staff` | `admin`), `active` bool, `created_at`
  - `field_comments` — `id`, `post_id` → `field_posts.id` (on delete cascade), `parent_id` (nullable, for replies), `user_id` → `profiles.id`, `body`, `created_at`, `edited_at`, `deleted_at` (soft delete keeps reply threads intact)
  - `field_posts` — add `user_id` → `profiles.id`; keep `author` for legacy rows.
- **Retire** `FIELD_PASSWORD` and the `cavalier_field_session` cookie once accounts are live.
- The hard-hat entrance stays; it now leads to a sign-in screen instead of the password box.

### Acceptance criteria

- [ ] An uninvited email cannot sign in or create an account.
- [ ] Each post and comment shows the real name of the signed-in user who created it, not a typed-in name.
- [ ] Staff can edit/delete only their own posts and comments; admins can delete any.
- [ ] Deactivating a user blocks them immediately (their next request fails), without affecting anyone else.
- [ ] Replies display under the comment they answer.
- [ ] Sign-in and posting work on a phone over a weak signal; the session lasts long enough that crews aren't signing in daily.
- [ ] Existing posts still display after migration.

### Related notes

- Project brief, which lists "no public user auth in v1": [CAVALIER_FLOORING_BRIEF.md](CAVALIER_FLOORING_BRIEF.md). This feature is **staff-only** auth, so it doesn't conflict with that.
- The CORS settings in [server/main.py](server/main.py) will need `PATCH` (or keep using POST/DELETE) and the `Authorization` header allowed. `allow_headers=["*"]` already covers the header.

---

## 2. Share In the Field posts to Instagram and LinkedIn (phone share sheet)

**Status:** Not started. Requested Nov 2026. Independent of section 1; it can be built before or after the accounts work.

### Goal

Let staff send an In the Field post to the company's **Instagram** and **LinkedIn** accounts in a couple of taps from their phone, without retyping the caption or re-finding the photos.

### Approach

Add a **Share** button to each post on the staff page (`/in-the-field/post`, in the "Recent posts" list, and on the "Posted" confirmation after a new post). It uses the phone's built-in share sheet ([Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) with files):

1. Download the post's photos/videos from their public Supabase URLs as files in the browser.
2. **Copy the caption to the clipboard first.** Instagram ignores text passed along with images from the share sheet, so the user pastes the caption into Instagram themselves. Show a short note: "Caption copied. Paste it in Instagram."
3. Call `navigator.share({ files, text: caption })`. The user picks Instagram or LinkedIn from the share sheet, and the app opens with the media attached. They post as the company account from the app as normal.

**No API keys, no app approvals, no cost.** Staff choose post-by-post what goes out.

### Details to handle

- Check `navigator.canShare({ files })` before showing the button. If sharing files isn't supported (most desktop browsers), fall back to: **Download photos** + **Copy caption** buttons.
- Large videos take a moment to download before the share sheet opens: show a "Preparing…" state on the button.
- Multi-photo posts: pass all files. Instagram turns them into a carousel. If a platform only accepts one file, the user picks from what's offered.
- Instagram on iPhone may only offer "Feed" / "Stories" / "Messages" targets; that's expected.
- The phones need the Instagram and LinkedIn apps installed and signed into the **company** accounts (or the staff member needs access to post as the company page).

### Out of scope (possible later steps)

- **Automatic cross-posting** through Buffer/Zapier (via an RSS feed of posts), or directly through the Instagram/LinkedIn APIs. Discussed and deferred: subscriptions or API app review aren't worth it until sharing by hand gets tedious.
- **Per-post public pages** (e.g. `/in-the-field/<id>`) with link-preview tags so a shared *link* shows a photo card on LinkedIn. Needs server-rendered meta tags because the site is a single-page app and LinkedIn's preview fetcher doesn't run JavaScript.

### Acceptance criteria

- [ ] On an iPhone and an Android phone, tapping Share on a post opens the share sheet with the post's photos/videos attached.
- [ ] Choosing Instagram opens Instagram with the media; the caption is on the clipboard ready to paste.
- [ ] Choosing LinkedIn opens a LinkedIn post with the media and caption.
- [ ] On desktop, the fallback buttons download the media and copy the caption.
- [ ] Nothing posts anywhere without the staff member confirming it in the Instagram/LinkedIn app.

---

## 3. SEO and moving the client's domain off Hibu

**Status:** Not started. Requested Nov 2026. Do this **at launch**, once the site is otherwise finished.

### Context

Cavalier's current website is hosted by **Hibu**. The **domain belongs to Cavalier, not Hibu.** When this site is done, it replaces the Hibu site on that same domain. Because the domain stays the same, there's no "change of address" in Google. The main risks are **breaking old URLs**, **breaking email**, and **losing things Hibu was quietly running**.

Domain: `______________` (fill in)

### Part A: Before the switch (discovery)

Find out exactly what Hibu controls. Most of the risk is here.

1. **Who controls DNS?** Confirm Cavalier has the login for the domain registrar (GoDaddy etc.). If Hibu manages the DNS or the registrar account, get it moved into Cavalier's own account *before* anything else. If the domain needs a transfer, get the authorization code.
2. **Email.** Write down all current DNS records, especially **MX, SPF, DKIM, DMARC** and any verification TXT records. Find out where email is hosted (Google Workspace, Microsoft 365, Hibu?). Email must keep working after the cutover. Only change the website records (`@` / `www`); copy everything else exactly.
3. **Phone numbers.** Hibu often uses **call-tracking numbers** on the site and in listings. Get Cavalier's **real** main number and use it everywhere on the new site.
4. **Google accounts.** Who owns the **Google Business Profile**, **Google Search Console** and **Google Analytics** for the domain? If Hibu set them up, ask them to add Cavalier as an owner, or set up fresh ones under Cavalier's Google account. Export Search Console data (top pages, top search terms) as a "before" benchmark.
5. **Old URLs.** Crawl the Hibu site and list every page URL (sitemap at `/sitemap.xml` if it exists, or a crawler such as Screaming Frog's free tier). These are needed for redirects (Part C).
6. **Content and photo rights.** Check the Hibu contract for who owns the old site's text and photos before reusing anything. The project brief already says not to scrape the old site; the founder supplies the copy.
7. **Hibu contract.** Note the cancellation terms and notice period. **Don't cancel until the new site is live and verified** (Part D).

### Part B: SEO work on the new site (before launch)

The site is a React single-page app: pages are built in the browser by JavaScript. Google can render that, but more slowly and less reliably. Other crawlers and link previews (LinkedIn, Facebook, Slack, many AI search tools) mostly can't. So:

1. **Pre-render the public pages to real HTML** at build time: `/`, `/projects`, each `/projects/<slug>`, `/about`, `/contact`, `/discuss`, `/in-the-field`. Options to evaluate: React Router v7's built-in prerendering (framework mode), or a Vite prerender plugin. Project pages need their slugs at build time: fetch them from the API during the build, and redeploy (or trigger a rebuild) when projects change.
2. **Per-page titles and descriptions.** Each page gets its own `<title>` and meta description; React 19 supports these directly inside components. Example: "Commercial Flooring Contractor in Central Virginia | Cavalier Flooring Systems". Each project page uses its own name, location and flooring type.
3. **Social preview tags** (Open Graph + Twitter): title, description and image per page, plus a default share image.
4. **Structured data** (JSON-LD): a `LocalBusiness` / `GeneralContractor` block on the home page with name, address, phone, hours, service area (Charlottesville, Central VA to Fredericksburg, Tidewater: confirm with founder) and logo.
5. **`sitemap.xml`** listing all public pages and project pages, generated at build. **`robots.txt`**: ✅ done (`client/public/robots.txt` blocks `/admin` and `/in-the-field/post`). Add the `Sitemap:` line once the domain and sitemap exist.
6. **Canonical URLs.** Pick one version (`https://www.<domain>` *or* `https://<domain>`), redirect the other to it, and set `<link rel="canonical">` on every page.
7. **A real 404 page**: ✅ done (`NotFoundPage.jsx`, catch-all route). Note: it's served with HTTP status 200 because the static host returns `index.html` for every path. Once pages are prerendered, make unknown URLs return a true 404 status.
8. **Images:** descriptive `alt` text everywhere (gallery, project pages, In the Field), reasonable file sizes, lazy loading below the fold.
9. **Page speed:** check Core Web Vitals with Lighthouse or PageSpeed Insights. Fonts, hero images and the JS bundle are the usual suspects.
10. **Local search terms in the copy**, written for people, not keyword stuffing: "commercial flooring", the flooring types, and the cities served. Mostly the founder's copy plus project descriptions; check that the About and Home pages mention the service area.
11. **Name, address and phone (NAP) must exactly match** the Google Business Profile and other listings.

### Part C: Redirects from old Hibu URLs

- Map every old URL from Part A step 5 to the closest new page (e.g. `/about-us` → `/about`, `/gallery` → `/projects`, `/contact-us` → `/contact`). Anything without a match goes to `/`.
- Use **permanent (301) redirects done by the server**, not JavaScript, so the old pages' search ranking carries over. The frontend is served as static files by Caddy on Railway; check whether a custom `Caddyfile` in `client/` can hold the redirect rules.
- Keep a simple table of old URL → new URL in the repo.

### Part D: Cutover day

1. In Railway, add the custom domain to the **frontend** service (both `@` and `www`). Railway shows the DNS records to create.
   - Railway uses CNAME records. A CNAME on the bare domain (`@`) needs a DNS host that supports CNAME flattening / ALIAS (Cloudflare does; GoDaddy doesn't). Otherwise point `www` at Railway and forward the bare domain to `www`.
2. **Recommended:** put the backend on a subdomain, e.g. `api.<domain>`. Frontend and API are then on the same site, so the admin and staff login cookies stop being cross-site, which is simpler and more reliable on iPhones.
3. Update environment variables:
   - server: `FRONTEND_URL=https://www.<domain>` (CORS)
   - client: `VITE_API_URL=https://api.<domain>` (then redeploy, because it's baked in at build)
4. Change **only** the website DNS records. Leave MX/SPF/DKIM/DMARC/TXT exactly as recorded in Part A.
5. Wait for HTTPS certificates to issue on Railway, then test: home page, deep links (refresh on a project page), every form, chat, admin login, In the Field posting, the redirects, and **send and receive a test email** on the domain.
6. **Google Search Console:** verify the domain (DNS TXT record), submit the new sitemap, and use URL Inspection → "Request indexing" on the main pages.
7. Update the **Google Business Profile** website link (and Bing Places, Yelp, BBB, industry directories) if any URLs changed, and the phone number if Hibu was using a tracking number.
8. **Only then** cancel Hibu, and make sure they don't still control DNS, email or listings when the account closes.

### Part E: After launch (first 4–6 weeks)

- Watch Search Console weekly for **404 errors** and "page not indexed" issues; add redirects for any old URLs that were missed.
- Compare traffic and search positions against the Part A benchmark. A small dip for a couple of weeks is normal.
- Ask satisfied clients for **Google reviews**. This is one of the biggest factors for local search.

### Acceptance criteria

- [ ] The site loads on the client's domain over HTTPS, and the non-canonical version (www or bare) redirects to the canonical one.
- [ ] Company email on the domain still sends and receives.
- [ ] Every old Hibu URL either 301-redirects to a relevant new page or was deliberately dropped.
- [ ] Viewing the raw page source (not the rendered page) of each public page shows its own title, description and main content.
- [ ] `sitemap.xml` and `robots.txt` are live, and the sitemap is submitted in Search Console under an account Cavalier owns.
- [ ] Google Business Profile, Search Console and Analytics are owned by Cavalier, not Hibu.
- [ ] The phone number on the site is Cavalier's real number and matches the Google Business Profile.
- [ ] A link to a project page pasted into LinkedIn shows a preview card with an image.

---

## 4. Email notifications for website submissions

**Status:** Not started. Requested Nov 2026. **High priority: build before launch.** Without it, leads sit in the database until someone happens to check `/admin`.

### Goal

Every time someone submits something on the website, the right people at Cavalier get an email with the full details, so nobody has to log into the admin panel to find new leads.

### What triggers an email

| Submission | Where it's saved today | Email? |
|---|---|---|
| Contact form (`/contact`, and the "Discuss a similar project" / "Let's Talk" modals) | `contacts` table, in [server/routes/contact.py](server/routes/contact.py) | **Yes**, always |
| Project-intake conversation (`/discuss`) | `project_responses` table, in [server/routes/intake.py](server/routes/intake.py), saved only when the conversation is complete | **Yes**, when it's saved |
| Chat widget conversations | Not saved | No |
| In the Field posts | `field_posts` | No (staff content, not leads) |

If a visitor uses `/discuss` and then sends the contact form, they get two emails. That's fine: the contact email already includes the AI exchange (`formatLeadContext()`), and the intake email shows that someone used the tool even if they never got in touch.

### What the email contains

**Contact form:**
- Subject: `New website inquiry: <name> (<company>)`
- Name, company, email, phone, message, date/time (Eastern time).
- If the visitor came through the project-intake tool, the attached AI exchange (already part of `message`).
- **Reply-To set to the visitor's email**, so hitting Reply in the inbox answers them directly.
- A link to `/admin` for the full history.

**Project intake:**
- Subject: `Project intake: <role> — <first ~60 characters of description>`
- Role (Owner/Facility or GC/Specifier), the visitor's project description, and Claude's final response.
- Note that this visitor may not have left contact info. The email is a heads-up, not a lead with a name attached.

Plain, readable formatting: simple HTML with a plain-text version. No marketing styling.

### Approach

- **Email service: [Resend](https://resend.com)** (recommended). Free tier is 3,000 emails/month, which is far more than needed, and it has a simple Python SDK and good deliverability. Alternatives if the founder prefers: Postmark, SendGrid, or sending through Cavalier's existing Google Workspace / Microsoft 365 over SMTP.
- New helper `server/notify.py` with `send_contact_notification(row)` and `send_intake_notification(row)`.
- Call it **after** the database insert succeeds, using FastAPI `BackgroundTasks` (or a try/except after the response is built) so that:
  - the visitor never waits on email, and
  - **if email fails, the submission still saves and the visitor still sees success.** Print the error to the server log (and write to the `logs` table once logging exists).
- The intake route streams its response, so send the notification from inside `generate()` right after the `project_responses` insert, wrapped in its own try/except.
- Escape all user-submitted text in the HTML email.

### Configuration (Railway **server** service variables)

- `RESEND_API_KEY`
- `NOTIFY_EMAIL_TO`: comma-separated list of who gets the emails (ask founder)
- `NOTIFY_EMAIL_FROM`: e.g. `Cavalier Website <website@<domain>>`

### Sending domain (ties to section 3)

- To send *from* Cavalier's own domain, the domain must be verified in Resend by adding a few DNS records (SPF/DKIM). **Add these alongside the existing email records; don't replace them.** Check the existing SPF record first, because a domain can only have one SPF record and Resend's include may need to be merged into it.
- Until the domain is moved off Hibu and DNS is in Cavalier's hands, either verify a subdomain you control or use Resend's test sender (`onboarding@resend.dev`, which can only send to the Resend account owner's address). That's enough for development and testing.

### Open decisions (ask the founder)

1. Who should receive the emails? One address, a shared inbox (e.g. `estimating@`), or several people?
2. Same recipients for contact-form leads and intake-tool emails, or different?
3. Should the visitor also get an automatic "Thanks, we got your message" confirmation email? (Not in scope unless requested.)
4. Which email service: Resend (recommended), or Cavalier's existing email provider?

### Acceptance criteria

- [ ] Submitting the contact form sends an email to every address in `NOTIFY_EMAIL_TO` within a minute, with all fields filled in.
- [ ] Replying to that email goes to the visitor's address, not the website's.
- [ ] Completing a `/discuss` conversation sends an intake email containing the description and Claude's response.
- [ ] If the email service is down or misconfigured, the submission still saves, the visitor still sees success, and the error appears in the server logs.
- [ ] Emails land in the inbox, not spam (check Gmail and Outlook), once the sending domain is verified.
- [ ] Text a visitor types that contains HTML (e.g. `<script>`) shows up as plain text in the email.

---

## 5. Spam protection on public forms

**Status:** Partly done (Nov 2026). Items 1 and 2 are built: the contact form has a hidden honeypot field (`cf_extra`) and a 5/hour, 20/day per-IP limit. `server/limiter.py` now keys on the visitor's real IP from Railway's proxy headers (`X-Real-IP`, else the last `X-Forwarded-For` entry). That also fixes the chat and intake limits, which previously may have been shared by all visitors. **Remaining:** items 3–4 (Turnstile, content checks), and a friendlier message on the contact form when someone hits the limit (it currently shows the generic error). Build the rest together with section 4.

**Current state:** `/api/contact` has no rate limit and no bot check. `/api/project-intake` and `/api/chat` are rate-limited (slowapi) but have no bot check, and every intake/chat request costs Anthropic API money.

**Build:**
1. **Honeypot field** on the contact form: a hidden input real people never fill in. If it has a value, return success but don't save or email.
2. **Rate limit** `/api/contact` (e.g. 5/hour and 20/day per IP) using the existing `limiter`.
3. **Cloudflare Turnstile** (free, usually invisible to real visitors) on the contact form and at the start of a `/discuss` conversation. The backend verifies the token with Cloudflare before saving or calling Claude. Keys: `TURNSTILE_SITE_KEY` (client), `TURNSTILE_SECRET_KEY` (server).
4. Basic content checks: reject messages that are only links, or over a sane length.

**Done when:** a scripted POST to `/api/contact` without a valid Turnstile token is rejected; a form with the honeypot filled is silently dropped; real submissions from a phone and desktop still work.

---

## 6. Production hosting setup (Railway region, Supabase plan, backups)

**Status:** Started. RLS is enabled (no policies) on every table as of Nov 2026, and `schema.sql` matches. The rest below is still to do. **Before launch.**

1. **Move the Railway services to a US East region.** *(Still to do, Nov 2026: a dashboard setting.)* The `cfs` server service currently runs in **Southeast Asia**. Every API call and chat message from Virginia goes around the world and back. Railway → service → Settings → Region. Check the frontend service too.
2. **Supabase plan.** Free-plan projects **pause after about a week with no activity**, which takes the whole site down until someone un-pauses it, and the free plan has **no automatic backups**. Recommend **Pro (~$25/month)** for a client's production site. If staying on free for now: set up a weekly backup (`pg_dump` export) and a scheduled ping to keep the project awake, and accept the risk.
3. **Storage limits.** The free plan includes 1 GB of file storage, and In the Field videos will use that up fast. Pro includes 100 GB and allows larger video uploads (raise `file_size_limit` on the `field-media` bucket and `MAX_VIDEO_MB` in `FieldPostPage.jsx`).
4. Confirm `ENV=production` is set on the Railway server service; it controls secure cookie settings.

**Done when:** both services run in a US region; Supabase can't pause on its own; a backup exists and a restore has been tried once.

---

## 7. Account ownership, billing and monthly costs

**Status:** Not started. **Decide before launch.**

The site depends on these accounts. For each, decide **who owns it** (Cavalier or the developer) and **who pays**:

| Service | What it's for | Approx. cost |
|---|---|---|
| Domain registrar | The domain | ~$15–25/yr |
| Railway | Hosts frontend and backend | ~$5–20/mo depending on usage |
| Supabase | Database + file storage | Free, or $25/mo Pro (see section 6) |
| Anthropic | Chat widget + `/discuss` AI | Usage-based; likely a few $/mo at this traffic |
| Resend (section 4) | Lead emails | Free at this volume |
| Cloudflare Turnstile (section 5) | Spam protection | Free |

Recommendations:
- Cavalier should **own the domain, the Google accounts, and anything holding their customers' data** (Supabase), even if the developer manages it day to day. Add the developer as a team member rather than the other way round.
- If the developer keeps hosting accounts, put the arrangement in writing (monthly fee, what happens if the arrangement ends, how the client gets their data out).
- Store all passwords and API keys in a shared password manager, not in email.
- Set **spending limits/alerts** on Railway and Anthropic.

**Done when:** the table above is filled in with owner, payer, and actual monthly cost, and the client has signed off.

---

## 8. Mobile navigation menu

**Status:** Not started. **Before launch.**

The navbar has six links (Home, Projects, In the Field, How can we help?, About, Contact) in a single row with no mobile layout. On phones they crowd or overflow.

**Build:** below a breakpoint (e.g. `md`), show the logo plus a menu button that opens a full-width panel with the links stacked. Match the quiet style: hairline dividers, uppercase small text, maroon active state. It closes on link tap, Escape, and outside tap; locks page scroll while open; is keyboard accessible (`aria-expanded`, focus moves into the menu).

**Done when:** at 375px wide (small iPhone), every link is reachable and nothing overflows horizontally on any page.

---

## 9. Privacy policy page

**Status:** Not started. **Before launch.**

A short, plain-language `/privacy` page linked in the footer. It should cover:
- What's collected: contact form details; project descriptions typed into `/discuss`; chat messages; basic page-visit data (once logging exists).
- That chat and `/discuss` text is processed by an AI provider (Anthropic) to generate responses.
- How it's used (to respond to inquiries), that it isn't sold, and how long it's kept.
- How to ask for data to be deleted (an email address).
- That In the Field photos are posted by Cavalier staff.

Have the founder review it. If they have a lawyer, it's worth a quick look, but this site doesn't need anything elaborate.

**Done when:** `/privacy` exists, is linked in the footer, and the founder has approved the text.

---

## 10. Admin → Projects tab with photo upload

**Status:** Not started. From the original brief (steps 9–10). Without it, every gallery project has to be entered by hand in the Supabase table editor.

**Build:**
- A **Projects** tab in `/admin`: a list of all projects (including non-public), plus add/edit/delete.
- Form fields match the `projects` table: name, slug (auto-generated from the name, editable), project type and flooring type (dropdowns from the founder's finalized lists, see brief), location, year, square footage, short and long description, public/hidden toggle.
- **Photos:** upload 1–10, drag to reorder (first = thumbnail), remove. **Reuse the In the Field upload pipeline** in [server/routes/field.py](server/routes/field.py): backend issues a signed upload URL, browser resizes photos and uploads straight to Supabase Storage. Use a separate `project-images` bucket.
- Backend: admin-only `POST/PUT/DELETE /api/admin/projects`, deleting storage files when photos or projects are removed.
- After launch with prerendering (section 3), changing projects needs to trigger a frontend rebuild so project pages and the sitemap update (Railway deploy hook).

**Done when:** the founder can add a project with photos from the admin panel and it appears in the gallery, without touching Supabase.

---

## 11. Bring the `/discuss` intake prompt in line with the chatbot knowledge base

**Status:** ✅ Done Nov 2026. `intake.py` now loads `knowledge_base.md`; service area and the LVT/VCT note moved into the KB; K-12 fit check added to the intake prompt. Remaining: run the full CHATBOT_VERIFICATION list against `/discuss`.

The `/discuss` system prompt in [server/routes/intake.py](server/routes/intake.py) has its own hard-coded description of Cavalier. It's out of date and now **contradicts the chatbot**:
- It lists only the old 5 flooring categories (LVT, VCT, carpet tile, sheet vinyl, ceramic tile). The chatbot's [knowledge_base.md](server/knowledge_base.md) also covers wall tile, specialty wall panels, and concrete slab work (moisture mitigation, leveling).
- It doesn't have the **"we don't usually do K-12 schools"** rule added to the chatbot in Nov 2026, or the "no residential" rule.

**Build:** make `knowledge_base.md` the single source of company facts for both bots. `intake.py` loads it the same way `chat.py` does, and keeps only the intake-specific behavior (roles, turn rules, wrap-up) in its own prompt. Then re-run [CHATBOT_VERIFICATION.md](CHATBOT_VERIFICATION.md) against both the chat widget and `/discuss` (the verification doc already anticipates this).

**Done when:** a scope or policy change made once in `knowledge_base.md` shows up in both bots, and a `/discuss` description of an elementary school project gets the K-12 response.

---

## 12. Logging and the Admin → Logs tab

**Status:** Not started. From the original brief (step 11). The `logs` table exists but nothing writes to it, and `/api/track/visit` is a stub that returns 204 without saving.

**Build:**
- `server/logger.py` with `log_event(level, event, route, message, metadata)` (see CTX201's implementation, per the brief). Logging must never break a request: wrap the insert in try/except.
- Record: page visits (path, referrer, rough device type; **no IP addresses stored**), contact submissions, intake completions, chat usage counts, rate-limit hits, email-send failures (section 4), spam rejections (section 5), and server errors.
- **Admin → Logs tab:** filter by level and event, newest first, plus simple counts (visits per page this week, leads this month).
- Auto-delete logs older than ~90 days to keep the database small.

**Done when:** visiting pages and submitting forms produce rows visible in the Logs tab, and a forced error shows up as `level=error`.

---

## 13. Fix the heading font (Cormorant Garamond)

**Status:** Not started. Small.

The brief specifies Cormorant Garamond for headlines, and pages use `className="font-display"`, but **it has never actually loaded**. The font family is defined in `client/tailwind.config.js`, which **Tailwind v4 ignores**, so every heading renders in DM Sans. The Google Fonts link in `index.html` is fine.

**Decide with the founder:** use Cormorant Garamond as designed, or keep DM Sans (what everyone has been looking at) and update the brief.

**If fixing:** add to `client/src/index.css`:

```css
@theme {
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-body: "DM Sans", system-ui, sans-serif;
}
```

Then delete the unused `tailwind.config.js`, and review every page because heading sizes and spacing will look different in a serif.

**Done when:** headings render in the chosen font everywhere, and the brief matches reality.

---

## 14. Uptime and error monitoring

**Status:** Not started. **Set up at launch.**

- **Uptime:** a free monitor (e.g. UptimeRobot or Better Stack) checking the homepage and `https://<api>/api/health` every 5 minutes, alerting the developer by email/text if either is down.
- **Errors:** at minimum, the `error` rows from section 12 plus Railway's deploy-failure notifications. Optionally Sentry's free tier on the frontend and backend to catch crashes visitors hit.
- **Costs:** spending alerts on Railway and Anthropic (see section 7).

**Done when:** stopping the backend service triggers an alert within ~10 minutes.

---

## 15. Update the Anthropic SDK and models

**Status:** Not started. Low effort.

`server/requirements.txt` pins `anthropic==0.40.0` (old), and the code uses `claude-sonnet-4-5` (`/discuss`) and `claude-haiku-4-5` (chat widget), which are a generation behind. Older models eventually get retired, and newer ones are generally better at following the knowledge base's rules.

**Build:** upgrade the SDK to a current version, switch to current model IDs (check Anthropic's models page at the time), and keep the model IDs in one place (env var or constant) so the next update is one line. Check that streaming in `chat.py` and `intake.py` still works.

**Done when:** both bots run on current models and the full [CHATBOT_VERIFICATION.md](CHATBOT_VERIFICATION.md) list passes.

---

## 16. Accessibility pass

**Status:** Not started. **Before launch;** overlaps with SEO (section 3).

- **Contrast:** much of the text is off-white at 40–70% opacity on charcoal, plus the faint hard-hat link. Check against WCAG AA (4.5:1 for body text) and raise opacity where it fails.
- **Keyboard:** every link, button, filter chip, modal, the chat widget, the lightbox, and the mobile menu (section 8) is usable with Tab/Enter/Escape, with a visible focus outline.
- **Screen readers:** alt text on all images (gallery, project pages, In the Field), labels on all form fields, `aria-live` for chat/`/discuss` responses and form success/error messages.
- Respect `prefers-reduced-motion` for the fade-in animations.
- Run Lighthouse/axe on every public page and fix what it flags.

**Done when:** Lighthouse accessibility score is 95+ on every public page and the whole site can be used without a mouse.

---

## 17. Client handoff guide

**Status:** Not started. **At launch.**

A short guide for Cavalier staff (a page or PDF, not developer docs):
- **Admin panel:** how to sign in, where leads and intake conversations are, adding/editing projects and photos (section 10).
- **In the Field:** the hard hat, signing in, posting from a phone, saving it to the home screen, deleting a post, the iPhone "Most Compatible" camera setting, video size limits, sharing to Instagram/LinkedIn (section 2).
- **Lead emails:** who gets them, and that hitting Reply answers the visitor (section 4).
- **Passwords:** how to change the admin and team passwords and who to ask (after section 1, how to invite or remove staff accounts).
- **The chatbot:** what it will and won't answer, and how to request changes to what it knows.
- **Who to contact** when something breaks, and what the monthly costs are (section 7).

**Done when:** a Cavalier staff member who wasn't involved in the build can post to In the Field and add a project using only the guide.

---

## 18. Thorough review of the AI context (chatbot + `/discuss`)

**Status:** Not started. **Before launch.** Requested Nov 2026 after `/discuss` gave detailed flooring advice for an elementary school project (since fixed, see §11).

### Goal

The website's AI should **never say anything Cavalier wouldn't say itself**: no wrong facts, no promises, no tone that doesn't sound like Cavalier. The founder reviews everything the bots are told, then the bots are tested hard against it.

### Where the AI's instructions live

| File | What it controls |
|---|---|
| [server/knowledge_base.md](server/knowledge_base.md) | **Company facts and rules for both bots**: scope, service area, what Cavalier doesn't do (residential, K-12), furnish-and-install, tone, contact info. Most edits go here. |
| [server/routes/intake.py](server/routes/intake.py) | `/discuss` only: the fit check, conversation rules, owner vs. GC/specifier guidance, turn limits, final-turn wrap-up. |
| [server/routes/chat.py](server/routes/chat.py) | Chat widget only: a thin wrapper around the knowledge base. |
| [client/src/components/ChatWidget.jsx](client/src/components/ChatWidget.jsx) | The chat widget's fixed opening message and UI text. |
| [client/src/components/ProjectIntake.jsx](client/src/components/ProjectIntake.jsx) | `/discuss` page text, role choices, placeholder examples. |

### Step 1: Founder line-by-line review

Read `knowledge_base.md` and the prompts in `intake.py` start to finish and mark anything that is:
- **Wrong or outdated** (verify every fact: "family-owned," "since 1981," "west of Richmond," the phone number, the service area, the product list, crews and subcontractor partners).
- **Missing**: things customers often ask that the bots don't know. Examples: typical project sizes, union/non-union, bonding and insurance, certifications, safety record, working in occupied buildings / nights and weekends, warranty on workmanship, which industries are a strong fit vs. not, how bidding works, how soon someone calls back.
- **Not how Cavalier talks**: words or phrasing the founder wouldn't use.
- **Things Cavalier wants to avoid saying at all.**

### Step 2: Write down the "never say" rules explicitly

Add a clear section to `knowledge_base.md`. Starting list for the founder to confirm and extend:
- No prices, ballpark figures, per-square-foot numbers, or "that sounds affordable."
- No schedule or lead-time promises ("we can start next week," "two-week install").
- No commitments on Cavalier's behalf ("we'll take the job," "we can definitely do that").
- No specifics on manufacturer warranties, certifications, licensing, bonding, or insurance beyond what's written in the KB.
- No naming past clients or projects unless they're listed as public.
- No opinions on competitors, manufacturers, or other contractors.
- No technical advice that sounds like a spec or a guarantee (e.g. "this will fix your moisture problem").
- No safety, legal, code-compliance or health claims (asbestos in old VCT/mastic, ADA, fire ratings): say it's something to discuss with the team.
- No K-12 work, no single-family residential (already in the KB), and no other excluded work the founder adds.

### Step 3: Stress test

- Expand [CHATBOT_VERIFICATION.md](CHATBOT_VERIFICATION.md) from 12 checks to roughly 40–50 real-world questions, and run **every one against both the chat widget and `/discuss`** (both roles).
- Include tricky cases: K-12 phrased indirectly ("a private academy, grades 6–12," "a charter school," "a school district admin building"), community colleges vs. high schools, mixed-use buildings, out-of-area projects, homeowners, price pressure ("just give me a ballpark"), requests for a schedule, competitor comparisons, asbestos, off-topic and joking questions, and attempts to make the bot ignore its instructions.
- For each, write down what Cavalier **would** say. A response passes only if the founder would be comfortable having said it themselves.
- Check length and tone, too: `/discuss` is meant to be 3–5 sentences, and in testing it sometimes runs longer.
- Re-run the whole list after **any** edit to the knowledge base or prompts, and after model upgrades (§15).

### Step 4: Keep reviewing after launch

- Today, chat-widget conversations **aren't saved anywhere**, and `/discuss` only saves the first message and the final answer. That makes it impossible to see what the bots actually told people. Consider saving full conversations (in the `logs` table from §12, or a new table) so the founder can skim them weekly in admin. Mention this in the privacy policy (§9).
- Any bad answer seen in the wild gets added to the verification list **before** the fix, so it's tested from then on (the rule already in CHATBOT_VERIFICATION.md).

### Done when

- [ ] The founder has read and approved every line of `knowledge_base.md` and the `intake.py` prompts.
- [ ] A "never say" section exists in the KB and the founder has signed off on it.
- [ ] The expanded verification list passes on both bots and both `/discuss` roles.
- [ ] There's a way to review real conversations after launch.

---

## 19. Fix existing lint errors

**Status:** Not started. Small, low risk; do it in any session.

`npx eslint src` in `client/` reports 6 errors and 1 warning, all in code from before Nov 2026. The site builds and runs fine; these are React best-practice warnings, but they hide new problems in lint output.

- `ContactForm.jsx`, `ContactModal.jsx`, `ProjectDetailPage.jsx`: `setState` called directly inside `useEffect` (`react-hooks/set-state-in-effect`). Restructure: initialize state lazily from `sessionStorage`, reset the modal's state when it opens rather than in an effect, and key the detail page on `slug`.
- `AdminPage.jsx`: `fetchContacts` / `fetchIntakes` are used before they're declared (`react-hooks/immutability`). Move them above the effect or inside it. Remove the now-unused `eslint-disable` comment.
- `useVersionCheck.js`: `__APP_VERSION__` is flagged as undefined. Declare it as a global in `eslint.config.js` (it's injected by Vite's `define`).

**Done when:** `npx eslint src` reports no problems, and the contact modal, lead-context hand-off from `/discuss`, project detail pages, and admin tabs still work.
