alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.memory_files enable row level security;
alter table public.memory_items enable row level security;
alter table public.chat_ingestions enable row level security;
alter table public.repo_scans enable row level security;
alter table public.capsules enable row level security;
alter table public.drift_reports enable row level security;
alter table public.exports enable row level security;

create or replace function public.user_owns_project(project_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects
    where id = project_uuid
      and owner_id = auth.uid()
  );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all"
on public.projects
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "memory_files_owner_all" on public.memory_files;
create policy "memory_files_owner_all"
on public.memory_files
for all
using (public.user_owns_project(project_id))
with check (public.user_owns_project(project_id));

drop policy if exists "memory_items_owner_all" on public.memory_items;
create policy "memory_items_owner_all"
on public.memory_items
for all
using (public.user_owns_project(project_id))
with check (public.user_owns_project(project_id));

drop policy if exists "chat_ingestions_owner_all" on public.chat_ingestions;
create policy "chat_ingestions_owner_all"
on public.chat_ingestions
for all
using (public.user_owns_project(project_id))
with check (public.user_owns_project(project_id));

drop policy if exists "repo_scans_owner_all" on public.repo_scans;
create policy "repo_scans_owner_all"
on public.repo_scans
for all
using (public.user_owns_project(project_id))
with check (public.user_owns_project(project_id));

drop policy if exists "capsules_owner_all" on public.capsules;
create policy "capsules_owner_all"
on public.capsules
for all
using (public.user_owns_project(project_id))
with check (public.user_owns_project(project_id));

drop policy if exists "drift_reports_owner_all" on public.drift_reports;
create policy "drift_reports_owner_all"
on public.drift_reports
for all
using (public.user_owns_project(project_id))
with check (public.user_owns_project(project_id));

drop policy if exists "exports_owner_all" on public.exports;
create policy "exports_owner_all"
on public.exports
for all
using (public.user_owns_project(project_id))
with check (public.user_owns_project(project_id));
