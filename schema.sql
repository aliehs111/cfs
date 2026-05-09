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
-- RLS — disabled (backend uses service_role key for all queries)
-- =========================================================

alter table contacts disable row level security;
alter table project_responses disable row level security;
alter table projects disable row level security;
alter table logs disable row level security;

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
