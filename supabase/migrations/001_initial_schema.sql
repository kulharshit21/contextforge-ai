create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  repo_url text,
  local_path_hint text,
  stack jsonb not null default '[]'::jsonb,
  memory_health_score integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_key text not null,
  title text not null,
  content text not null,
  summary text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  memory_file_id uuid references public.memory_files(id) on delete cascade,
  item_type text,
  title text,
  content text,
  source text,
  confidence numeric,
  related_files text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_ingestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  raw_text text,
  extracted jsonb,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.repo_scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scan_json jsonb,
  branch text,
  commit_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task text,
  capsule_markdown text,
  relevant_memory_ids uuid[] not null default '{}',
  estimated_raw_tokens integer,
  estimated_capsule_tokens integer,
  estimated_saved_percent numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.drift_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  severity text,
  title text,
  description text,
  suggested_fix text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  target text,
  content text,
  created_at timestamptz not null default now()
);

create unique index if not exists memory_files_project_file_key_idx
  on public.memory_files(project_id, file_key);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_files_updated_at on public.memory_files;
create trigger set_memory_files_updated_at
before update on public.memory_files
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_items_updated_at on public.memory_items;
create trigger set_memory_items_updated_at
before update on public.memory_items
for each row execute function public.set_updated_at();
