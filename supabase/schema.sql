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
