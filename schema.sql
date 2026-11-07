-- Cavalier Flooring Systems — Database Schema
-- Run in Supabase SQL Editor (project: cfs)

-- =========================================================
-- TABLES
-- =========================================================

-- 1. Contact form submissions
create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  company text,
  email text,
  phone text,
  message text,
  created_at timestamptz default now()
);

-- 2. AI Project-Intake responses (visitor description + Claude's reply)
create table project_responses (
  id uuid primary key default gen_random_uuid(),
  project_description text,
  ai_output text,
  role text,
  created_at timestamptz default now()
);

-- 3. Project gallery
create table projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text,
  project_type text,
  location text,
  year int,
  square_footage int,
  flooring_type text,
  short_description text,
  long_description text,
  image_urls text[],
  is_public boolean default true,
  created_at timestamptz default now()
);

-- 4. System + user activity logs
create table logs (
  id uuid primary key default gen_random_uuid(),
  level text,
  event text,
  route text,
  message text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- =========================================================
-- INDEXES
-- =========================================================

create index projects_slug_idx on projects (slug);
create index projects_is_public_idx on projects (is_public);
create index logs_created_at_idx on logs (created_at desc);
create index logs_level_idx on logs (level);

-- =========================================================
-- RLS — enabled with no policies (Nov 2026). This blocks the public anon key
-- entirely; the backend uses the service_role key, which bypasses RLS.
-- =========================================================

alter table contacts enable row level security;
alter table project_responses enable row level security;
alter table projects enable row level security;
alter table logs enable row level security;

-- =========================================================
-- SEED DATA — sample projects so the gallery renders during dev
-- (delete or replace these once real projects are added via admin)
-- =========================================================

insert into projects (slug, name, project_type, location, year, square_footage, flooring_type, short_description, long_description, image_urls, is_public) values
(
  'sample-healthcare-clinic',
  'Sample Outpatient Clinic',
  'Healthcare',
  'Charlottesville, VA',
  2024,
  18000,
  'Sheet Vinyl',
  'New outpatient clinic with sheet vinyl through patient-care zones for hygiene and continuity.',
  'Long-form description placeholder. Replace with real project narrative when available.',
  array[]::text[],
  true
),
(
  'sample-retail-storefront',
  'Sample Boutique Retail',
  'Retail',
  'Richmond, VA',
  2023,
  4200,
  'LVT',
  'Boutique retail buildout with luxury vinyl tile across the showroom and back-of-house.',
  'Long-form description placeholder. Replace with real project narrative when available.',
  array[]::text[],
  true
),
(
  'sample-multifamily-amenity',
  'Sample Multi-Family Amenity Space',
  'Multi-family',
  'Norfolk, VA',
  2024,
  9500,
  'Carpet Tile',
  'Carpet tile installation across resident lounge, gym, and corridor common areas.',
  'Long-form description placeholder. Replace with real project narrative when available.',
  array[]::text[],
  true
);

-- =========================================================
-- IN THE FIELD (added Nov 2026) — run this block on its own if the
-- tables above already exist.
-- =========================================================

-- 5. Staff posts from job sites (photos/videos + caption)
create table if not exists field_posts (
  id uuid primary key default gen_random_uuid(),
  caption text,
  location text,
  author text,
  media jsonb not null default '[]'::jsonb,  -- [{ "path", "url", "type": "image" | "video" }]
  is_public boolean default true,
  created_at timestamptz default now()
);

create index if not exists field_posts_created_at_idx on field_posts (created_at desc);
-- RLS on with no policies: blocks the anon/authenticated keys entirely.
-- The backend uses the service_role key, which bypasses RLS.
alter table field_posts enable row level security;

-- Public storage bucket for the photos/videos. Uploads go through signed
-- URLs issued by the backend, so no storage policies are needed.
-- file_size_limit: 50 MB matches the Supabase free-plan cap. On Pro you can
-- raise it (and MAX_VIDEO_MB in client/src/pages/FieldPostPage.jsx).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'field-media',
  'field-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
on conflict (id) do nothing;

-- =========================================================
-- EMAIL ALERTS + LOGGING (added Nov 2026, specs.md §4 and §12) — run this
-- block on its own in the Supabase SQL Editor if the tables above exist.
-- =========================================================

-- Who did it, and what it was about. actor_id will reference app_users once
-- user accounts exist (§1); until then it stays empty.
alter table logs add column if not exists actor_id uuid;
alter table logs add column if not exists entity_type text;
alter table logs add column if not exists entity_id text;
create index if not exists logs_event_idx on logs (event);

-- 6. Email alerts: on/off and recipients per alert, edited on Admin → Notifications.
create table if not exists notification_settings (
  alert_type text primary key,
  enabled boolean not null default true,
  recipients text[] not null default '{}',
  updated_at timestamptz default now(),
  updated_by text
);
alter table notification_settings enable row level security;

-- Starting recipients: the developer only. Add others on the Notifications tab.
insert into notification_settings (alert_type, enabled, recipients) values
  ('contact_submission', true, array['smcgov11.11@gmail.com']),
  ('intake_completed',   true, array['smcgov11.11@gmail.com']),
  ('field_post_created', true, array['smcgov11.11@gmail.com']),
  ('field_post_deleted', true, array['smcgov11.11@gmail.com']),
  ('failed_logins',      true, array['smcgov11.11@gmail.com']),
  ('server_error',       true, array['smcgov11.11@gmail.com']),
  ('user_changes',       true, array['smcgov11.11@gmail.com']),
  ('weekly_digest',      true, array['smcgov11.11@gmail.com'])
on conflict (alert_type) do nothing;
