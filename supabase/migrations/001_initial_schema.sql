-- CV Spruce v2 — Initial Supabase Schema with Row-Level Security (RLS)
-- Run via Supabase SQL Editor or `supabase db push`.

create extension if not exists "pgcrypto";

-- Helper to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Master Career Profiles (1 per user)
create table if not exists public.career_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  basics jsonb not null default '{}'::jsonb,
  summary text not null default '',
  experience jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  projects jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  certifications text[] not null default '{}',
  career_story text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  feedback_memory jsonb not null default '[]'::jsonb,
  raw_cv_text text not null default '',
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger career_profiles_updated_at
  before update on public.career_profiles
  for each row execute function public.set_updated_at();

alter table public.career_profiles enable row level security;

create policy "Users can view own career profile"
  on public.career_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own career profile"
  on public.career_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own career profile"
  on public.career_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own career profile"
  on public.career_profiles for delete
  using (auth.uid() = user_id);

-- 2. Job Watchers (Saved searches & company career boards)
create table if not exists public.job_watchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source text not null check (source in ('remotive', 'arbeitnow', 'hn_yc', 'greenhouse', 'lever', 'ashby', 'adzuna', 'jsearch')),
  query text not null default '',
  company_slug text,
  location text,
  remote_only boolean not null default false,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_watchers_user_id on public.job_watchers(user_id);

create trigger job_watchers_updated_at
  before update on public.job_watchers
  for each row execute function public.set_updated_at();

alter table public.job_watchers enable row level security;

create policy "Users manage own job watchers"
  on public.job_watchers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Discovered Jobs (Deduplicated per user + external_id)
create table if not exists public.discovered_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watcher_id uuid references public.job_watchers(id) on delete set null,
  external_id text not null,
  source text not null,
  title text not null,
  company text not null,
  location text not null default '',
  remote boolean not null default false,
  salary text,
  url text not null,
  description text not null default '',
  tags text[] not null default '{}',
  match_score integer check (match_score >= 0 and match_score <= 100),
  match_reasons text[] not null default '{}',
  skill_gaps text[] not null default '{}',
  feedback text check (feedback in ('liked', 'disliked', 'saved', 'hidden')),
  feedback_note text,
  posted_at timestamptz,
  discovered_at timestamptz not null default now(),
  unique(user_id, source, external_id)
);

create index if not exists idx_discovered_jobs_user_score on public.discovered_jobs(user_id, match_score desc nulls last);

alter table public.discovered_jobs enable row level security;

create policy "Users manage own discovered jobs"
  on public.discovered_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Applications (Kanban Monitoring Board + Bespoke CV/Cover Letter Versions)
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.discovered_jobs(id) on delete set null,
  company text not null,
  role_title text not null,
  location text not null default '',
  salary text,
  job_url text,
  job_spec_text text not null default '',
  status text not null default 'saved'
    check (status in ('saved', 'drafting', 'applied', 'interviewing', 'offer', 'rejected', 'archived')),
  match_percentage integer,
  matching_highlights text[] not null default '{}',
  missing_skills text[] not null default '{}',
  tailored_cv text not null default '',
  cover_letter text not null default '',
  interview_qna jsonb not null default '[]'::jsonb,
  industry_updates jsonb not null default '[]'::jsonb,
  cv_versions jsonb not null default '[]'::jsonb,
  chat_history jsonb not null default '[]'::jsonb,
  notes text not null default '',
  applied_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_applications_user_status on public.applications(user_id, status);

create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

alter table public.applications enable row level security;

create policy "Users manage own applications"
  on public.applications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: Enable daily automated scanning via pg_cron + pg_net in Supabase:
-- select cron.schedule(
--   'cv-spruce-daily-job-scan',
--   '0 7 * * *',
--   $$
--   select net.http_post(
--     url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/job-scanner',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{"mode": "scheduled"}'::jsonb
--   );
--   $$
-- );
