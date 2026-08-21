-- RUN THIS NOW in Supabase SQL Editor (fixes admin access)
-- Safe to run even if schema.sql was already applied

-- 1) Backfill profiles for any auth user missing a row
insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  u.email,
  'user'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 2) Reliable profile fetch (bypasses RLS quirks)
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

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 3) Promote ALL current accounts to admin (for setup / testing)
-- After this, sign out and sign in again.
update public.profiles
set role = 'admin';

-- 4) Verify
select email, role from public.profiles;
