-- Casecraft Supabase backend schema
-- Run this in Supabase Dashboard > SQL Editor before setting the Vite env variables.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
  next_role text;
begin
  select count(*) into existing_count from public.profiles;
  next_role := case when existing_count = 0 then 'admin' else 'user' end;

  insert into public.profiles (id, name, email, role, status, created_at, last_login_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    lower(new.email),
    next_role,
    'active',
    now(),
    now(),
    now()
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS controls which rows users may update, while this trigger prevents a
-- regular user from elevating their own role or changing account status.
create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    old.role is distinct from new.role
    or old.status is distinct from new.status
  )
  and auth.uid() is not null
  and not public.is_admin(auth.uid()) then
    raise exception 'Only an active admin can change profile role or status.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_admin_fields on public.profiles;
create trigger protect_profile_admin_fields
  before update on public.profiles
  for each row execute function public.protect_profile_admin_fields();

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

create policy "Users can update own basic profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins can delete app profiles"
  on public.profiles for delete
  using (public.is_admin(auth.uid()) and auth.uid() <> id);

-- Optional helper: if you already created users before installing this schema,
-- manually promote one account after it appears in profiles:
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';

-- Casecraft QA artifact model. These records are owned by the authenticated
-- user and can be grouped into projects and releases without exposing data
-- across accounts.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'Draft' check (status in ('Draft', 'In QA', 'Ready', 'Released')),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requirement_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  name text not null,
  document_version text not null default '1.0',
  source_text text not null default '',
  source_fingerprint text not null,
  requirements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requirement_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.requirement_documents(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  document_name text not null,
  document_version text not null,
  source_text text not null default '',
  source_fingerprint text not null,
  requirements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.test_suites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  requirement_version_id uuid references public.requirement_versions(id) on delete set null,
  workspace text not null default 'maintenance' check (workspace in ('development', 'maintenance')),
  title text not null,
  module text not null default '',
  suite_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suite_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  suite_id uuid not null references public.test_suites(id) on delete cascade,
  case_id text not null default '',
  decision text not null check (decision in ('Approved', 'Changes requested', 'Rejected')),
  evidence text not null default '',
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.releases enable row level security;
alter table public.requirement_documents enable row level security;
alter table public.requirement_versions enable row level security;
alter table public.test_suites enable row level security;
alter table public.suite_reviews enable row level security;
alter table public.audit_events enable row level security;

create policy "Owners can create projects" on public.projects for insert with check (auth.uid() = owner_id);
create policy "Owners can manage projects" on public.projects for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can manage releases" on public.releases for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can manage requirement documents" on public.requirement_documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can manage requirement versions" on public.requirement_versions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can manage test suites" on public.test_suites for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can manage suite reviews" on public.suite_reviews for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can read audit events" on public.audit_events for select using (auth.uid() = owner_id);
create policy "Owners can create audit events" on public.audit_events for insert with check (auth.uid() = owner_id and auth.uid() = actor_id);
