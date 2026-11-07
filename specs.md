# Specs — Planned Work

Features agreed on but not yet built. Each section is meant to be enough context to start a fresh session.

### Suggested order

**Before launch: these risk losing leads or breaking the site**
- ~~§4 Email alerts + Admin → Notifications tab~~ ✅ done (weekly digest scheduling postponed)
- ~~§1 User accounts, roles, Users tab, comments~~ ✅ done
- ~~§12 Logging + Admin → Logs tab~~ ✅ done
- ~~§5 Spam protection on forms~~ ✅ done (Turnstile keys live on Railway)
- ~~§11 `/discuss` prompt aligned with the chatbot knowledge base~~ ✅ done
- §18 Thorough review of the AI context, so the bots never say something Cavalier wouldn't
- §6 Production hosting setup *(US region ✅ moved Nov 7; still: confirm `ENV=production`, Supabase plan, backups)*
- §7 Account ownership, billing and costs *(a decision, not code)*
- ~~§8 Mobile navigation menu~~ ✅ done
- ~~§10 Admin → Projects tab with photo upload~~ ✅ done
- §9 Privacy policy page *(approved; just needs a privacy email address)*
- ~~§13 Heading font~~ ✅ kept DM Sans
- ~~§16 Accessibility pass~~ ✅ done

**At launch**
- §3 SEO and moving the domain off Hibu
- §20 Real domain checklist *(the technical tick-list for cutover day; one small code change beforehand)*
- §14 Uptime and error monitoring
- §17 Client handoff guide

**After launch**
- §2 Share posts to Instagram/LinkedIn
- §15 Update the Anthropic SDK and models
- ~~§19 Fix existing lint errors~~ ✅ done

**Options considered, not scheduled:** §21 run as one Railway service; weekly digest scheduling (§4).

---

## Session log — Nov 7 2026

**Fixed in production**
- In the Field login failing: `FIELD_PASSWORD` missing locally (server not restarted after editing `.env`), and `FRONTEND_URL` on cfs-server pointing at an old client URL (CORS blocked every API call from the live site).
- Turnstile "not a bot" failure: the secret key had been put in both services; site key/secret corrected and the secret rotated.
- Railway region found on Southeast Asia again; both services moved to US East.

**Built**
- §4 Email alerts via Gmail SMTP: 8 alert types, Admin → Notifications (per-alert recipients, on/off, send test), throttling, `/discuss` conversations saved even when unfinished (emailed after 10 min idle), weekly digest built but not scheduled.
- §1 User accounts (EventOps pattern, bearer token): `/login`, forced password change, roles `dev_admin` / `admin` / `poster` / `user`, Admin → Users, both shared passwords retired, In the Field on accounts, public comments + replies, edit/delete rules (admins anything, everyone their own), "Edit this project" link for admins.
- **My email alerts** page (`/my-alerts`): each admin picks their own alerts.
- §12 Logging everywhere + Admin → Logs tab (filters, summary cards, dev-only technical details); daily 90-day log cleanup.
- §5 Spam protection: Turnstile on contact + every `/discuss` turn, content checks, `/discuss` rate limit.
- §10 Admin → Projects tab with photo upload; sample projects given placeholder photos + a fourth office sample.
- §8 Mobile menu; §9 privacy page (approved); §13 kept DM Sans; §16 accessibility pass (0 axe violations, screen-reader review); §19 lint clean.
- In the Field Grid / Feed toggle.
- Visual refinements (§22): homepage palette, About photo + copy, Contact form, In the Field graphite background, How can we help? rows + photo.

**Specs added:** troubleshooting table (§1), §20 real-domain checklist, §21 single-service option, §22 visual refinements log.

**Open items for next session**
- Hide or delete the "test" project (Spider-Man photo) in Admin → Projects; tidy sample project descriptions or replace with real projects.
- Privacy email address (`PRIVACY_EMAIL` in `PrivacyPage.jsx`).
- Founder decisions: §18 AI context review, §7 account ownership/costs, flooring vocabulary for projects.
- §6: confirm `ENV=production`, Supabase plan and backups.
- Optional: In the Field gradient ends near-black while the footer is charcoal (could end at charcoal); About page min-height on very tall screens; a quick VoiceOver listen on an iPhone.
- Don't commit the large original PNGs in `client/assets` (and `temp_proj_photos/`) unless wanted; the site uses only the `.jpg` copies.

---

## 1. User accounts, roles and the Admin → Users tab (plus comments on posts)

**Status:** ✅ Built and tested locally Nov 7 2026. Step 1: `app_users`, `/login` (forced password change), Admin → Users tab, roles, `/admin` on accounts (`ADMIN_PASSWORD` removed). Step 2: In the Field posting on accounts (real names, `user_id` on posts, posters edit/delete their own, admins any), public comments with one level of replies (signed-in accounts write; soft delete), `FIELD_PASSWORD` retired. Deployed Nov 7 2026. **Permissions rule (confirmed by the developer Nov 7 2026): admins can edit or delete anything; posters and users can edit or delete their own posts/comments.** Edit/Delete now appear on every post on the public In the Field feed (owner or admin), post edits cover caption, location and adding/removing photos and videos (removed files deleted from storage), admins can edit any comment (logged with the previous text), and public project pages show an "Edit this project" link to admins that opens Admin → Projects on that project.

### Goal

Everyone who signs in has their own account with a role. This replaces **both** shared passwords (`ADMIN_PASSWORD` for `/admin`, `FIELD_PASSWORD` for In the Field), so every post, comment and admin action is tied to a real person, and one person can be removed without changing anyone else's password.

### Current state (what exists today)

- Public feed: `/in-the-field` → [client/src/pages/FieldPage.jsx](client/src/pages/FieldPage.jsx) — **Grid / Feed toggle** (Nov 7 2026): grid of cards, or an Instagram-style single column (poster initials + name + location, square swipeable media with an n/total counter, caption led by the poster's name, date, then Edit/Delete and comments). The choice is remembered per device (`localStorage`, key `cavalier_field_view`); grid is the default. **Background (Nov 7 2026):** **graphite sheen**: Stone at the very top falling quickly to near-black `#080808`, a soft metallic glow across the top and a fine grain (`.field-stone` in `client/src/index.css`). Earlier Stone → charcoal and `#52504E` → black versions were replaced. All text on the page is white. Feed page only; the posting page is unchanged.
- Staff posting page: `/in-the-field/post` → [client/src/pages/FieldPostPage.jsx](client/src/pages/FieldPostPage.jsx). Reached via the faint hard-hat icon on the In the Field page.
- Backend: [server/routes/field.py](server/routes/field.py)
  - One shared password (`FIELD_PASSWORD` env var on the Railway **server** service) → signed cookie `cavalier_field_session`, 30-day TTL. An admin session is also accepted.
  - Uploads: backend issues a Supabase signed upload URL; the browser uploads straight to the `field-media` storage bucket.
  - Anyone signed in can delete any post.
- Database: `field_posts` table (see bottom of [schema.sql](schema.sql)). `author` is free text typed by the poster, so it's not trustworthy. RLS is enabled with no policies; the backend uses the service-role key.

**Problems this fixes:** anyone with the password can post under any name. You can't revoke one person without changing the password for everyone. Anyone can delete anyone's post.

### Troubleshooting sign-in (notes for a crew user guide)

**✅ Resolved Nov 7 2026:** accounts send the session as an `Authorization` header instead of a cookie, so Safari's cross-site tracking setting no longer matters. The notes below are kept for history only.

~~**Known issue: some phones can't stay signed in.**~~ Noted Nov 2026. Sign-in works on the developer's iPhone, but other people's phones may behave differently.

- **Symptom:** the person enters the correct password and briefly sees the posting screen, or nothing happens. Then they're back at the password box, with no error message. Or posting fails and sends them back to the password box.
- **Cause:** the website (`cavalier-flooring-…up.railway.app`) and the server (`cfs-…up.railway.app`) are on different web addresses. The browser counts the sign-in cookie as a "cross-site" (third-party) cookie, and privacy settings can block those:
  - **iPhone/iPad (Safari, and Chrome on iOS):** blocked when *Prevent Cross-Site Tracking* is on, which is the default.
  - **Private/Incognito windows** on any phone or browser.
  - **Firefox**, and Android Chrome when "Block third-party cookies" is on.
- **Workaround for a crew member, until it's fixed properly:**
  - iPhone Safari: Settings → Safari → turn off **Prevent Cross-Site Tracking**. On iOS 18 and later it's Settings → Apps → Safari.
  - Chrome on iPhone: Settings → Apps → Chrome → turn on **Allow Cross-Website Tracking**.
  - Don't use a private/incognito tab.
  - These settings change privacy for every website, so treat this as a stopgap, not the instructions in the final guide.
- **Permanent fixes (either one):**
  1. At cutover, put the server on `api.<domain>` and the site on `www.<domain>` (§3 Part D step 2). The cookie is then first-party and isn't blocked.
  2. The account system in this section sends the sign-in token as an `Authorization: Bearer` header instead of a cookie, which avoids the problem completely. Do the same for the admin login.

**Sign-in messages and what they mean** (everyone signs in at `/login` with their own account since Nov 2026):

| What the person sees | Meaning | Fix |
|---|---|---|
| "Incorrect email or password." | Wrong email or password | Check the email; if forgotten, an admin uses **Reset password** on Admin → Users |
| "This account has been deactivated. Ask an admin." | An admin deactivated them | Admin → Users → Reactivate |
| "Too many attempts. Wait 15 minutes and try again." | 5 failed tries from that email or network in 15 minutes | Wait, or reset their password |
| "Could not reach the server." / page stuck loading | API down, or `FRONTEND_URL` on cfs-server doesn't exactly match the site's address (`https://…`, no trailing slash) | Check Railway; a `FRONTEND_URL` mismatch breaks all forms on the site |
| "Your account can comment on posts but not create them." | Their role is `user` | Admin → Users → change role to Poster |
| Signed in, but sent back to the sign-in page | Their password was reset or they were deactivated (sessions end immediately) | Sign in again with the new temporary password |

Railway variable changes only take effect after clicking **Deploy**. Locally, restart `uvicorn` after editing `server/.env`; `--reload` doesn't watch `.env`.

### Roles

| Role | Who | Can |
|---|---|---|
| `dev_admin` | The developer only | Everything `admin` can, plus: grant the `dev_admin` role and edit/reset/deactivate `dev_admin` accounts (admins see that row read-only), and see technical details in the Logs tab (error stack traces; email and IP of failed sign-ins). There is no separate System page. |
| `admin` | Cavalier management | Everything `poster` can, plus: the whole admin page; create users; change anyone's role **except** to/from `dev_admin`; reset passwords; deactivate/reactivate; delete any post or comment; manage email alert recipients (§4) |
| `poster` | Crew members and staff who post from job sites | Create In the Field posts; edit/delete **their own** posts; comment |
| `user` | Staff who follow along but don't post | Comment and reply on posts; edit/delete **their own** comments. Cannot post |

Rules (same as EventOps):
- Nobody can change their own role or deactivate themselves (prevents locking the last admin out).
- Only a `dev_admin` can grant or remove `dev_admin`.
- No hard delete of users, only deactivate, so logs can always say who did what.

### Initial accounts

| Name | Email | Role | How it's created |
|---|---|---|---|
| CTX 201 | smcgov11.11@gmail.com | `dev_admin` | Automatically at server startup from env vars, if no `dev_admin` exists (EventOps `ensure_dev_admin`) |
| Sheila McGovern | sheila@cavfloor.com | `admin` | Created by the dev_admin in the Users tab |
| Nick Basso | nick@cavfloor.com | `admin` | Users tab |
| Randy Basso | randy@cavfloor.com | `admin` | Users tab |

Server env vars for the bootstrap account: `DEV_ADMIN_NAME`, `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` (temporary; must be changed at first sign-in), plus `SESSION_SECRET` for signing sessions.

### Creating a user (copy EventOps)

1. Admin → **Users** tab → **Add user**: first name, last name, email, role.
2. Backend rejects an email that already has an account, generates a temporary password like `abcd-EFGH-2345` (no look-alike characters), stores only a scrypt hash, and sets `must_change_password = true`.
3. The temporary password is shown to the admin **once**.
4. **Email invite** button opens a pre-written welcome email (`mailto:`) with the sign-in link; **Text invite** opens the phone's share sheet. The password is never put in the invite; the admin gives it to the person separately.
5. At first sign-in, the backend refuses everything except "change password" (min 10 characters), "who am I" and sign out, until a new password is set.

### Users tab

- Columns: Name, Email, Role (inline dropdown), Status (Active / Deactivated / Must change password), Last signed in, Actions.
- Actions: edit name/email, change role, **reset password** (new temporary password; signs them out everywhere), **deactivate / reactivate**, email invite, text invite.
- Every change is written to the activity log (§12) and triggers the "user account changes" alert (§4).

### Sign-in and sessions

- One sign-in page for everyone (`/login`), email + password. After sign-in, admins land on `/admin`, posters on `/in-the-field/post`, users on `/in-the-field`. The hard-hat entrance on In the Field leads to it.
- Failed attempts throttled per email and per IP (5 per 15 minutes). Unknown emails take as long to check as known ones. Hitting the limit triggers the "repeated failed sign-ins" alert (§4).
- Session = `user_id.session_version.issued_at` + HMAC-SHA256 signature with `SESSION_SECRET`, 30 days.
- **Difference from EventOps:** EventOps uses a cookie because its site and API share one address. Cavalier's don't until the domain move (§3 Part D), so a cookie is blocked by iPhone Safari and private windows (see Troubleshooting above). **Send the session as an `Authorization: Bearer` header** and keep it in `localStorage`. Optionally switch to a cookie after the API moves to `api.<domain>`.
- The backend re-reads the user on every request: deactivated, or `session_version` changed (password reset/deactivation bump it), returns 401 immediately. No sessions table needed.

### Comments and replies

- Signed-in `user`, `poster`, `admin` and `dev_admin` can comment on a post and reply to a comment (one level of replies).
- Each shows the real name and time. Authors can edit/delete their own; admins can delete any. Soft delete keeps reply threads intact ("comment removed").

### Tables (draft)

- `app_users` — `id`, `first_name`, `last_name`, `email` (unique, lowercased), `role` (check: `dev_admin` | `admin` | `poster` | `user`), `password_hash`, `must_change_password`, `session_version` int, `active` bool, `last_sign_in_at`, `created_at`, `created_by` → `app_users.id`
- `field_comments` — `id`, `post_id` → `field_posts.id` (on delete cascade), `parent_id` (nullable, for replies), `user_id` → `app_users.id`, `body`, `created_at`, `edited_at`, `deleted_at`
- `field_posts` — add `user_id` → `app_users.id`. Keep `author` for legacy rows; new posts show the account name and the free-text author field is removed.
- RLS on with no policies, as today; all access through FastAPI with the service-role key.

### Retire when this ships

- `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, the `cavalier_admin_session` cookie and the admin password screen.
- `FIELD_PASSWORD`, the `cavalier_field_session` cookie and the field password box.
- Update the Troubleshooting table above: messages become per-person ("Incorrect email or password", "Account deactivated").

### Open decisions

1. ~~Are comments public?~~ **Decided Nov 7 2026: yes.** Website visitors can read comments on In the Field; only signed-in accounts can write them.
2. ~~Who gets `user` accounts?~~ **Decided Nov 7 2026:** mainly Cavalier employees, but an admin can add anyone by email at any time.
3. Existing posts with a free-text `author`: leave as-is (recommended), or assign each to an account?

### Acceptance criteria

- [ ] There is no public sign-up; only an admin can create an account.
- [ ] A new user must change the temporary password before doing anything else.
- [ ] A `user` can comment but gets no Post option (and the API rejects a post from them with 403).
- [ ] A `poster` can post and edit/delete only their own posts; an `admin` can delete any post or comment.
- [ ] An `admin` can change roles but cannot grant `dev_admin`, change their own role, or deactivate themselves.
- [ ] Deactivating or resetting a user signs them out on their next request, without affecting anyone else.
- [ ] Sign-in works on an iPhone with Prevent Cross-Site Tracking **on**.
- [ ] Every post and comment shows the account's real name. Existing posts still display.
- [ ] `ADMIN_PASSWORD` and `FIELD_PASSWORD` can be deleted from Railway and nothing breaks.

### Related notes

- Project brief lists "no public user auth in v1": [CAVALIER_FLOORING_BRIEF.md](CAVALIER_FLOORING_BRIEF.md). These are staff accounts only, so it doesn't conflict.
- CORS in [server/main.py](server/main.py): add `PATCH` to `allow_methods` if used. `allow_headers=["*"]` already covers `Authorization`.
- EventOps files to port: `backend/auth.py`, `backend/routers/admin.py`, `frontend/src/pages/Admin.tsx`, `Login.tsx`, `ChangePassword.tsx`, `frontend/src/lib/invite.ts`, `lib/me.ts`, migrations `009` and `016`. EventOps is TypeScript and uses psycopg; Cavalier is JSX and uses the Supabase client, so adapt rather than copy.

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

**Use §20 (Real domain checklist) as the tick-list on the day.** The steps below are the overview.

1. In Railway, add the custom domain to the **frontend** service (both `@` and `www`). Railway shows the DNS records to create.
   - Railway uses CNAME records. A CNAME on the bare domain (`@`) needs a DNS host that supports CNAME flattening / ALIAS (Cloudflare does; GoDaddy doesn't). Otherwise point `www` at Railway and forward the bare domain to `www`.
2. **Recommended:** put the backend on a subdomain, e.g. `api.<domain>`. Frontend and API are then on the same site, so the admin and staff login cookies stop being cross-site, which is simpler and more reliable on iPhones.
3. Update environment variables:
   - server: `FRONTEND_URL=https://www.<domain>` (CORS)
   - client: `VITE_API_URL=https://api.<domain>` (then redeploy, because it's baked in at build)
   - Cloudflare → Turnstile → the Cavalier widget → add `<domain>` and `www.<domain>` to its hostnames (same keys; no code change). Without this, the contact form and `/discuss` reject everyone on the new domain. Remove the `up.railway.app` hostname once it's no longer used.
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

## 4. Email alerts and the Admin → Notifications tab

**Status:** ✅ Built and tested locally, Nov 7 2026 (Gmail SMTP, all 8 alerts, Notifications tab, weekly digest script, intake saving incl. unfinished conversations). Deployed and tested in production Nov 7 2026 (§1 also shipped, so `user_changes` alerts and deleted-post names work). **Weekly digest: built but not scheduled — postponed, may not be added.** The digest content works (Admin → Notifications → Weekly digest → Send test sends a real one), but nothing sends it automatically. If wanted later, two options:
- **A. Railway cron service:** new service from the same repo, root `server`, start command `python weekly_digest.py`, schedule `0 12 * * 1` (Mon 7am EST / 8am EDT), same variables as cfs-server. Extra service and duplicated variables.
- **B. In-process (recommended):** a background loop in the existing server, like the intake sweeper in `intake_store.py`: on Mondays after 8am ET, if no `weekly_digest` `alert.sent` log exists since Monday 00:00 ET, claim the week and send. Nothing to set up in Railway; a restart at 8am just delays it a few minutes.
- Either way, the 90-day log cleanup in `weekly_digest.py` also only runs when the digest runs; with neither, logs grow until cleaned up some other way.

### Goal

The right people get an email whenever something happens on the site, and admins choose **who gets which alert** on the admin page, without touching Railway or code.

### Alerts

| Alert | Fires when | Default recipients (editable) |
|---|---|---|
| **New contact form** | Contact form submitted (`/contact`, and the "Discuss a similar project" / "Let's Talk" modals) | smcgov11.11@gmail.com |
| **New project intake** | A `/discuss` conversation finishes, **or** the visitor stops replying for 10 minutes ("left without finishing"). One email per conversation. Every conversation is saved, finished or not ✅ built Nov 2026 | smcgov11.11@gmail.com |
| **New In the Field post** | A post is created | smcgov11.11@gmail.com |
| **In the Field post deleted** | A post is deleted (says who deleted it, and includes the caption and media links) | smcgov11.11@gmail.com |
| **Repeated failed sign-ins** | An email or IP hits the sign-in limit (5 failures / 15 min) on any login | smcgov11.11@gmail.com |
| **Server error** | Any unhandled error / 500 response | smcgov11.11@gmail.com |
| **User account changes** | User created, role changed, deactivated/reactivated, password reset, first sign-in completed | smcgov11.11@gmail.com |
| **Weekly digest** | Monday morning, Eastern time | smcgov11.11@gmail.com |

**Starting recipients:** every alert goes only to the developer (smcgov11.11@gmail.com) at first. Later, add sheila@, nick@ and randy@cavfloor.com (or others) to the leads, new-post and digest alerts from the Notifications tab. No code change or deploy is needed.

**Throttling** so an attack or outage can't flood inboxes: failed-sign-in alerts at most once per email/IP per hour; server-error alerts at most once per distinct error per hour, with a count of how many times it happened. Everything else sends every time.

Not emailed: chat widget conversations (not saved; counted in the digest instead), new comments (in the digest; could become its own alert later).

### What each email contains

- **Contact form.** Subject `New website inquiry: <name> (<company>)`. Name, company, email, phone, message, date/time (Eastern). If they came through the intake tool, the AI exchange (already part of `message`). **Reply-To = the visitor's email**, so Reply answers them directly. Link to `/admin`.
- **Project intake.** Subject `Project intake: <role> — <first ~60 chars of description>`. Role, description, Claude's final response. Note that the visitor may not have left contact info.
- **New post.** Subject `New In the Field post by <name>`. Caption, location, first photo as a thumbnail, number of files, link to the post.
- **Post deleted.** Who deleted it, who originally posted it, caption, date.
- **Failed sign-ins.** The email tried (and whether it's a real account), the IP, number of attempts, time window.
- **Server error.** Route, error type and message, time, count within the hour. No visitor personal data.
- **User account change.** What changed, which account, who did it.
- **Weekly digest** (last 7 days, with the previous week for comparison):
  - Visits: total, top pages, top referrers, phone vs desktop.
  - Leads: each contact submission (name, company, date) and intake count.
  - In the Field: new posts (with posters' names), new comments.
  - Chat: conversations started.
  - Health: server errors, failed sign-ins, emails that failed to send, spam rejected (§5).

Plain formatting: simple HTML with a plain-text version, no marketing styling. All visitor-typed text is HTML-escaped.

### My email alerts (`/my-alerts`) — built Nov 7 2026

Each admin picks which alerts go to **their own** email, from a page linked in the admin header ("My email alerts"). Contact form and new In the Field posts are shown first as the usual choices; every other alert is available too. Ticking a box adds or removes only that admin's address in the same `notification_settings.recipients` lists the Notifications tab edits. If an admin's email is changed on the Users tab, their subscriptions move to the new address. Admins and dev admins only. Server: `server/routes/my_alerts.py`; page: `client/src/pages/MyAlertsPage.jsx`.

### Admin → Notifications tab

- One row per alert: name, short description, **on/off switch**, and the list of recipient emails with add/remove. A **Send test** button sends a sample to that alert's recipients.
- Recipients don't need accounts (e.g. a shared `estimating@` inbox can receive leads).
- Visible to `admin` and `dev_admin` (§1). Until §1 ships, it sits behind the current admin password.
- Changes are written to the activity log (§12).

Table: `notification_settings` — `alert_type` (primary key), `enabled` bool, `recipients` text[], `updated_at`, `updated_by`. Seeded with the defaults above.

### Approach

- **Sending: SMTP with a Google App Password, the same as EventOps and Clipper.** Port EventOps' `backend/mailer.py` (Python's built-in `smtplib`, no extra package or third-party service). Extend it to send to a list of recipients, and to send HTML with a plain-text version. Gmail's limit (~500 recipients/day) is far more than needed. `SMTP_HOST`/`SMTP_PORT` are variables, so it can later point at Cavalier's own mail provider instead of Gmail without code changes.
- `server/mailer.py` (ported) does the sending; `server/notify.py`: `send_alert(alert_type, subject, html, text, reply_to=None)` looks up `notification_settings`, skips if disabled or no recipients, sends, and logs the result (§12).
- Call it **after** the database write succeeds, using FastAPI `BackgroundTasks`, so the visitor never waits on email and **if email fails, the submission still saves and the visitor still sees success.** The intake route streams, so send from inside `generate()` right after the insert, in its own try/except.
- Server errors: a middleware/exception handler that logs every 500 (§12) and calls the throttled alert.
- **Weekly digest:** a small script (`server/jobs/weekly_digest.py`) run by a **Railway cron job** service using the same code and variables as cfs-server. Railway cron runs in UTC: Mondays at 12:00 UTC is 7am EST / 8am EDT. Built from the `logs` table, so it depends on §12's page-visit logging.

### Configuration (Railway **cfs-server** service variables)

- `SMTP_USER`: the Gmail address that sends the alerts
- `SMTP_PASS`: its Google App Password (Google Account → Security → 2-Step Verification → App passwords). Not the normal Gmail password.
- `SMTP_FROM` (optional): display name and address, e.g. `Cavalier Website <that-gmail-address>`. Gmail sends only as the signed-in address or a verified alias.
- `SMTP_HOST` / `SMTP_PORT` (optional): default `smtp.gmail.com` / `587`.
- Without `SMTP_USER`/`SMTP_PASS`, alerts are skipped and logged, and everything else still works (same as EventOps).
- Recipients are **not** env vars; they live in `notification_settings` and are edited on the admin page.

### Sender address

- Alerts come from the Gmail account in `SMTP_USER`; Reply-To on contact-form alerts is still the visitor.
- Decide which account sends: the developer's Gmail (as in EventOps), or a Cavalier-owned account so alerts keep working if the developer arrangement ends (§7). Switching later is only a variable change.
- No DNS changes are needed, so this doesn't wait on the domain move (§3).

### Acceptance criteria

- [ ] Each alert type sends to exactly the recipients set on the Notifications tab, within a minute; turning an alert off stops it.
- [ ] Send test works for every alert.
- [ ] Replying to a contact-form email goes to the visitor.
- [ ] If email is down or not configured, submissions and posts still save, the visitor still sees success, and the failure appears in the Logs tab.
- [ ] 50 failed sign-ins in a row produce one alert, not 50. A repeating server error produces at most one email per hour.
- [ ] The weekly digest arrives Monday morning with last week's numbers.
- [ ] Text a visitor types that contains HTML (e.g. `<script>`) shows up as plain text.
- [ ] Emails land in the inbox, not spam, at cavfloor.com and Gmail addresses.

---

## 5. Spam protection on public forms

**Status:** ✅ Built and tested locally Nov 7 2026. Contact form: honeypot, 5/hour + 20/day per IP, Cloudflare Turnstile, and content checks (no links in the name; reject link-only messages or more than 5 links; 8,000-character cap), with specific error messages instead of the generic one. `/discuss`: Turnstile on **every** turn (each turn calls Claude), a new 20/hour + 60/day per-IP limit (it had none), and max 5 messages / 4,000 characters each. Server: `server/turnstile.py`; client: `client/src/lib/turnstile.js` (invisible unless Cloudflare wants a click). If Cloudflare itself is unreachable, requests are allowed and logged (`spam.check_unavailable`) rather than losing a lead. Rejections are logged as `spam.rejected` (Logs tab → Spam and rate limits).
**Keys:** client `VITE_TURNSTILE_SITE_KEY` (build-time: redeploy the frontend after setting), server `TURNSTILE_SECRET_KEY`. Without the secret, checks are skipped and a warning is logged once. Local testing can use Cloudflare's test keys (see the top of `turnstile.py`).
**Not covered:** the chat widget (`/api/chat`, 30/day per IP) — add Turnstile there too if bots start costing money.

**Original plan:**

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
| Gmail SMTP (section 4) | Email alerts | Free |
| Cloudflare Turnstile (section 5) | Spam protection | Free |

Recommendations:
- Cavalier should **own the domain, the Google accounts, and anything holding their customers' data** (Supabase), even if the developer manages it day to day. Add the developer as a team member rather than the other way round.
- If the developer keeps hosting accounts, put the arrangement in writing (monthly fee, what happens if the arrangement ends, how the client gets their data out).
- Store all passwords and API keys in a shared password manager, not in email.
- Set **spending limits/alerts** on Railway and Anthropic.

**Done when:** the table above is filled in with owner, payer, and actual monthly cost, and the client has signed off.

---

## 8. Mobile navigation menu

**Status:** ✅ Built Nov 7 2026 (`client/src/components/Nav.jsx`). Menu button below 1024px (six links need ~800px in a row, so tablets get it too); checked at 375px: no horizontal overflow on any page; closes on link tap, Escape, outside tap and back button; scroll locked while open; focus moves in and returns to the button.

The navbar has six links (Home, Projects, In the Field, How can we help?, About, Contact) in a single row with no mobile layout. On phones they crowd or overflow.

**Build:** below a breakpoint (e.g. `md`), show the logo plus a menu button that opens a full-width panel with the links stacked. Match the quiet style: hairline dividers, uppercase small text, maroon active state. It closes on link tap, Escape, and outside tap; locks page scroll while open; is keyboard accessible (`aria-expanded`, focus moves into the menu).

**Done when:** at 375px wide (small iPhone), every link is reachable and nothing overflows horizontally on any page.

---

## 9. Privacy policy page

**Status:** Draft built Nov 7 2026 (`client/src/pages/PrivacyPage.jsx`, linked in the footer). Written from what the site actually does (chat text not stored; intake saved even if unfinished; no visit IPs; Anthropic, Cloudflare, Supabase, Railway, Gmail named as providers). A daily job now deletes logs older than 90 days (`server/intake_store.py`) so the stated retention is true. **Text approved Nov 7 2026.** **Remaining:** add a privacy email address (`PRIVACY_EMAIL` at the top of the file; until then it points to the phone number and Contact page); optional lawyer look, especially the Anthropic no-training sentence. **Keep the page in step with the site:** any feature that changes what's collected or who processes it must update this page.

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

**Status:** ✅ Built and tested locally Nov 7 2026 (`server/routes/admin_projects.py`, `client/src/pages/AdminProjects.jsx`, shared upload helpers in `client/src/lib/upload.js`, bucket `project-images`). Project type uses the gallery's 5 filter types; **flooring is free text with suggestions** from `knowledge_base.md` until the founder approves a fixed list. **Placeholder photos (Nov 7 2026):** the sample projects use the four photos from `client/assets/temp_proj_photos` (uploaded to `project-images`), and a fourth sample, "Sample Corporate Office Lounge", was added. **Remaining:** replace the 4 sample projects with real ones (delete them from the Projects tab); the prerender rebuild hook below applies only once §3 prerendering exists.

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

**Status:** ✅ Built and tested locally Nov 7 2026. Everything below is logged with who did it; Admin → Logs has summary cards (visits 7 days, leads/intakes/posts this month, errors 24h), filters (category, level, person, date range in Eastern time, text search) and paging. Stack traces and failed-sign-in IP/email are visible to `dev_admin` only. 90-day cleanup runs in `weekly_digest.py`. Original scope: The `logs` table exists but nothing writes to it, and `/api/track/visit` is a stub that returns 204 without saving. Build the `log_event` helper **with §4** (alerts log their sends), and the Logs tab after §1.

### Goal

Log everything worth knowing in one place, stored in the database so it survives deploys (EventOps keeps timings and errors only in memory; don't copy that part):

- **Activity: who did what.** Like EventOps' `activity_log`.
- **Site events:** what visitors and the system did.

### What gets logged

| Category | Events |
|---|---|
| Visits | Page views: path, referrer, device type (phone/tablet/desktop), browser. **No IP addresses stored.** |
| Leads | Contact submitted, intake started, intake completed |
| Chat | Conversation started, message count (not the message text) |
| In the Field | Post created/edited/deleted, comment created/edited/deleted |
| Accounts (§1) | Signed in, sign-in failed (email tried, whether it exists), password changed, user created, role changed, deactivated/reactivated, password reset |
| Admin | Notification settings changed, project created/edited/deleted (§10) |
| Email (§4) | Alert sent (type, recipient count), alert failed (error) |
| Protection | Rate limit hit (route), spam rejected (§5) |
| Errors | Every 500 / unhandled exception: route, error type, message, stack trace in `metadata` |

### Table changes

Add to the existing `logs` table: `actor_id` → `app_users.id` (null for visitors and the system), `entity_type`, `entity_id` (e.g. `field_post`, `<uuid>`). Keep `level` (`info` | `warning` | `error`), `event` (e.g. `field_post.deleted`), `route`, `message`, `metadata`. Index on `created_at desc` and on `event`.

### Build

- `server/logger.py` with `log_event(level, event, *, actor=None, route=None, message=None, entity=None, metadata=None)`. It must **never break a request**: wrap the insert in try/except, and write in the background where possible.
- Wire up `/api/track/visit` (already called by the client) to record page views.
- Middleware for errors (shared with the §4 server-error alert).
- Delete logs older than **90 days** (in the weekly digest job, or a Supabase scheduled function).

### Admin → Logs tab

- Newest first, paginated. Filter by category, level, person, and date range; search the message text.
- Each row: time (Eastern), who (name or "visitor"/"system"), what, and a link to the thing it's about (post, user) when it still exists. Expand a row to see `metadata`.
- Summary cards at the top: visits this week, leads this month, posts this month, errors in the last 24 hours.
- Visible to `admin` and `dev_admin`. Error stack traces and failed-sign-in details are shown to `dev_admin` only (the EventOps "System" view).

### Acceptance criteria

- [ ] Visiting pages, submitting forms, posting, and signing in all produce rows in the Logs tab with the right person attached.
- [ ] A forced error shows up as `level=error` with its stack trace (dev_admin only).
- [ ] If the logs insert fails, the original request still succeeds.
- [ ] No IP addresses are stored for page visits.
- [ ] Rows older than 90 days are removed automatically.
- [ ] The weekly digest (§4) numbers match the Logs tab for the same week.

---

## 13. Fix the heading font (Cormorant Garamond)

**Status:** ✅ Decided Nov 7 2026: **keep DM Sans for headings.** Removed Cormorant Garamond from the Google Fonts link (it was downloading on every page for nothing), deleted the ignored `client/tailwind.config.js`, and set `--font-display`/`--font-body` to DM Sans in `client/src/index.css` so it's explicit. The brief's font line is out of date.

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

**Status:** ✅ Done Nov 7 2026. axe-core reports **0 violations** on every public page (desktop and 375px), the signed-in admin tabs, the posting page and the login/password pages. Fixed: contrast (faded text raised to ≥55% on dark / ≥60% on cream; new `--maroon-text: #D9566B` for small maroon text on dark backgrounds, approved by the developer; `--maroon` unchanged for lines, buttons and text on cream); real `<label for>` + autocomplete on the contact form; one `<h1>` per page and no skipped heading levels; labelled admin tab nav with `aria-current`; global keyboard focus ring; "Skip to content" link; `prefers-reduced-motion` support; alert/status roles on form messages; hard-hat icon raised to 3:1. Keyboard-tested: logical tab order, visible focus everywhere. **To keep it passing:** use `--maroon-text` (not `--maroon`) for small text on dark backgrounds, and don't drop text opacity below 0.55 (dark) / 0.6 (cream). Screen-reader review (Nov 7 2026) via Chrome's accessibility tree, the same data VoiceOver reads: fixed the `/discuss` text boxes (named by their long example placeholder), chat widget (now an announced panel, focus moves into it, finished replies read aloud once), contact pop-up (proper modal dialog: focus moves in, Tab stays inside, focus returns on close), footer nav label, `aria-pressed` on project filters, `*` hidden from screen readers. A quick listen with VoiceOver on an iPhone is still worthwhile, since a tree check can't judge how it sounds.

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

**Status:** ✅ Done Nov 7 2026. `npx eslint .` is clean: `__APP_VERSION__` and Node globals declared in `eslint.config.js`; `ContactModal` and `ProjectDetailPage` no longer set state synchronously in effects; earlier fixes in `AdminPage` and `ContactForm`.

`npx eslint src` in `client/` reports 6 errors and 1 warning, all in code from before Nov 2026. The site builds and runs fine; these are React best-practice warnings, but they hide new problems in lint output.

- `ContactForm.jsx`, `ContactModal.jsx`, `ProjectDetailPage.jsx`: `setState` called directly inside `useEffect` (`react-hooks/set-state-in-effect`). Restructure: initialize state lazily from `sessionStorage`, reset the modal's state when it opens rather than in an effect, and key the detail page on `slug`.
- `AdminPage.jsx`: `fetchContacts` / `fetchIntakes` are used before they're declared (`react-hooks/immutability`). Move them above the effect or inside it. Remove the now-unused `eslint-disable` comment.
- `useVersionCheck.js`: `__APP_VERSION__` is flagged as undefined. Declare it as a global in `eslint.config.js` (it's injected by Vite's `define`).

**Done when:** `npx eslint src` reports no problems, and the contact modal, lead-context hand-off from `/discuss`, project detail pages, and admin tabs still work.

---

## 20. Real domain checklist (moving off the Railway address)

**Status:** Waiting on the domain move (§3). Everything that has to change when the site moves from `cavalier-flooring-production-889e.up.railway.app` to Cavalier's own domain, in one place. §3 covers the SEO, DNS-discovery and Hibu side in more detail; this is the technical checklist to tick through on the day. Replace `<domain>` with the real one.

### Before cutover day
- [ ] **Code: let the server accept more than one site address.** Today `server/main.py` allows only one `FRONTEND_URL` (plus localhost). Change it to accept a comma-separated list, so the old Railway address and the new domain both work during the switch instead of the old one breaking the moment the variable changes.
- [ ] Decide the canonical address: `https://www.<domain>` or `https://<domain>` (§3 Part B item 6).
- [ ] Confirm who controls DNS and that you can log in (§3 Part A).
- [ ] Record the existing email DNS records (MX, SPF, DKIM, DMARC, TXT) so they can be left exactly as they are (§3 Part A).

### Railway
- [ ] **cavalier-flooring** (frontend) → Settings → Networking → Custom Domain: add `<domain>` and `www.<domain>`; create the DNS records Railway shows.
- [ ] **cfs-server** → Custom Domain: add `api.<domain>` (recommended: keeps the API on the same site as the pages).
- [ ] Wait until Railway shows HTTPS certificates issued for all of them.
- [ ] While there, check both services are still in **US East (Virginia)**. The region has reverted to Southeast Asia before.

### Variables (each needs a Deploy to take effect)
- [ ] **cfs-server** `FRONTEND_URL` → `https://www.<domain>` (exact: `https://`, no trailing slash; with the list change above, `https://www.<domain>,https://cavalier-flooring-production-889e.up.railway.app` during the switch). It controls which site may call the API **and** the links inside alert emails.
- [ ] **cavalier-flooring** `VITE_API_URL` → `https://api.<domain>`, then **redeploy the frontend** (it's built into the page).

### Cloudflare Turnstile (§5)
- [ ] Cloudflare → Turnstile → the Cavalier widget → **add `<domain>` and `www.<domain>` to its hostnames**. Same keys, no code change. **If this is missed, the contact form and `/discuss` reject every visitor on the new domain.**
- [ ] Later, once nothing uses the Railway address, remove `cavalier-flooring-production-889e.up.railway.app` from the widget.

### DNS
- [ ] Change **only** the website records. Leave MX/SPF/DKIM/DMARC/TXT exactly as recorded.

### Site content (§3)
- [ ] `client/public/robots.txt`: add `Sitemap: https://www.<domain>/sitemap.xml`.
- [ ] Sitemap and canonical tags in place (§3 Part B).
- [ ] 301 redirects from the old Hibu URLs (§3 Part C).

### Tell the team
- [ ] Everyone has to **sign in again** on the new address (sign-ins are stored per address), and password managers will need the login saved for the new domain. Send staff the new sign-in link: `https://www.<domain>/login`.
- [ ] Invite emails and texts from Admin → Users use whatever address the admin is on, so nothing to change there; just make sure admins use the new address.

### Test on the new domain
- [ ] Home page, and a deep link refreshed directly (e.g. a project page).
- [ ] Contact form (and that the alert email arrives, and its "Open the admin page" link goes to the new domain).
- [ ] `/discuss` conversation, chat widget.
- [ ] `/login`, admin page, Users tab, Logs tab.
- [ ] In the Field: post, comment, delete.
- [ ] Admin → Notifications → Send test.
- [ ] Old Hibu URLs redirect.
- [ ] Company email still sends and receives.

### After
- [ ] Google Search Console, Google Business Profile and directory listings (§3 Part D steps 6–7).
- [ ] Only then cancel Hibu (§3 Part D step 8).
- [ ] Optional: switch sign-in from the `Authorization` header to a cookie now that site and API share a domain (§1). Not required; the header works everywhere.

---

## 21. Option: run the site as one Railway service instead of two

**Status:** Considered Nov 7 2026, not scheduled. Best done **before** the domain move (§20) if at all.

**Idea:** one service runs FastAPI, which also serves the built React pages; pages and `/api` share one address.

**Why:** removes the cross-site problems hit in Nov 2026 (`FRONTEND_URL` mismatch broke every form; Safari cross-site cookies), makes `FRONTEND_URL`/`VITE_API_URL`/CORS irrelevant in production, halves the §20 checklist (one custom domain, no `api.` subdomain, no multi-origin code change, one Turnstile hostname), one region setting and one set of logs, likely a slightly smaller Railway bill. The client already calls `/api/...` relative to the page when `VITE_API_URL` is empty.

**Costs:** every deploy rebuilds both halves (1–2 min; Railway keeps the old version up until the new one is healthy); a `Dockerfile` (Node build stage → Python image) to maintain; FastAPI must reproduce `client/serve.json`'s caching (`index.html` never cached so the update banner works; hashed assets cached long-term) and the SPA fallback so refreshing a deep link works.

**Plan if done:** build and test locally as one service → add a third Railway service from the same repo using the Dockerfile, copy variables → test on its Railway address while the current two keep serving → retire the old two.

---

## 22. Visual refinements log (Nov 7 2026)

Small, page-by-page refinements approved by the developer. Keep them unless deliberately revisited.

- **Palette (homepage only so far):** `:root[data-palette="2026"]` in `client/src/index.css`, switched on per page by `NEW_PALETTE_PATHS` in `client/src/App.jsx`. Charcoal `#191716`, Warm Gray `#E8E1D7`, Ivory `#F7F3ED`, Stone `#756F6A`. **Maroon stays `#A8243A`** — the proposed `#722638` was tried and rejected (too hard to see on charcoal). Small maroon text on dark backgrounds uses `--maroon-text: #D9566B` everywhere.
- **About:** background photo is now the library lobby (`client/assets/about_library.jpg`, web copy of "Modern Library Lobby with Geometric Carpet.png") with a **warm stone** treatment (`--about-photo-filter` / `--about-photo-tint` in `index.css`; warm monochrome and natural colour were previewed). Photo wash eased (solid where text overlaps); small labels darker; new copy (three paragraphs + "The details matter. Especially the ones you never see."); Sectors / What we install / Where we work removed.
- **Contact (form, light theme only):** field underlines 48% charcoal (3:1), labels 75%, focus = maroon underline with a 1px maroon shadow (site focus ring skipped on those fields). The dark pop-up version is unchanged.
- **In the Field (public feed):** graphite sheen background (Stone at top → near-black, soft top glow, fine grain) with all text white (`.field-stone`). Tried and replaced: Stone → charcoal; `#52504E` → black; brushed-metal and mica-sparkle textures were previewed, graphite sheen chosen.
- **How can we help? (`/discuss`):**
  - Role choices are "concept B" hairline rows with an arrow (`.role-option`); hover/focus = stone wash + maroon arrow. Filled stone panels were tried and rejected as too blocky.
  - Background photo `client/assets/discuss_hero.jpg` (web copy of "Sunlit Modern Industrial Interior.png"), medium filter via `--discuss-photo-*`; top band darker so the "HOW CAN WE HELP?" label keeps full `--maroon-text` (with a faint halo). Small text over the photo raised to ~88%. Contrast measured against the photo's brightest pixels behind each line: all ≥ 4.5:1.
  - Option text: "Owner, facility manager, or end user".
