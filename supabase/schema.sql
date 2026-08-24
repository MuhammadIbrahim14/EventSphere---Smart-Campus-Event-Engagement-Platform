-- SYNVEX FORGE / Techwiz 2026 — run this once in Supabase SQL Editor

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'user' check (role in ('user', 'organizer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sample CRUD table (replace/extend when competition brief arrives)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_user_id_idx on public.items (user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists items_updated_at on public.items;
create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- Helper: is current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(role)) = 'admin'
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.items enable row level security;

-- Profiles policies
drop policy if exists "Profiles: read own or admin" on public.profiles;
create policy "Profiles: read own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Profiles: admin update any" on public.profiles;
create policy "Profiles: admin update any"
  on public.profiles for update
  using (public.is_admin());

-- Items policies
drop policy if exists "Items: read own or admin" on public.items;
create policy "Items: read own or admin"
  on public.items for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Items: insert own" on public.items;
create policy "Items: insert own"
  on public.items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Items: update own or admin" on public.items;
create policy "Items: update own or admin"
  on public.items for update
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Items: delete own or admin" on public.items;
create policy "Items: delete own or admin"
  on public.items for delete
  using (auth.uid() = user_id or public.is_admin());

-- Optional: promote first admin after signup (run manually with your user id)
-- update public.profiles set role = 'admin' where email = 'your-admin@email.com';

-- Reliable profile helpers (also in fix-admin-access.sql)
create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  select * into result from public.profiles where id = auth.uid();
  if found then
    return result;
  end if;

  insert into public.profiles (id, full_name, email, role)
  select
    u.id,
    coalesce(u.raw_user_meta_data->>'full_name', ''),
    u.email,
    'user'
  from auth.users u
  where u.id = auth.uid()
  returning * into result;

  return result;
end;
$$;

create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(role)) = 'organizer'
  );
$$;

-- Only admins may change profiles.role (blocks self-promote to organizer/admin)
create or replace function public.enforce_role_change_by_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_admin_only on public.profiles;
create trigger profiles_role_admin_only
  before update on public.profiles
  for each row execute function public.enforce_role_change_by_admin();

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_organizer() to authenticated;

-- See also: email-otp.sql (EmailJS 6-digit OTP verification)
-- See also: add-organizer-role.sql (migrate existing DB to allow organizer)
