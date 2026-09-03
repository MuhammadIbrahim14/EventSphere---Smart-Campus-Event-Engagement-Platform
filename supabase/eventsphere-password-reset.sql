-- EventSphere — Password reset via EmailJS OTP (zero extra cost)
-- Run in Supabase SQL Editor.
-- Client: src/services/passwordReset.js
-- Looks up: verified personal_email OR real profiles.email OR auth.users.email
-- Blocks: synthetic *@students.eventsphere.local addresses

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists reset_token text;

alter table public.profiles
  add column if not exists reset_token_expires_at timestamptz;

create or replace function public.request_password_reset_otp(p_email text)
returns text
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  email_norm text := lower(trim(coalesce(p_email, '')));
  uid uuid;
  code text;
  has_personal boolean;
begin
  if email_norm = '' or position('@' in email_norm) = 0 then
    return null;
  end if;

  -- Never issue reset for synthetic campus Auth emails
  if email_norm like '%@students.eventsphere.local' then
    return null;
  end if;

  -- Column may be missing if enrollment-auth.sql not run yet
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'personal_email_verified'
  ) into has_personal;

  -- 1) Verified personal email (provisioned students)
  if coalesce(has_personal, false) then
    execute
      'select p.id from public.profiles p
       where p.personal_email_verified = true
         and p.personal_email is not null
         and lower(trim(p.personal_email)) = $1
       limit 1'
      into uid
      using email_norm;
  end if;

  -- 2) Profile email (guests / staff / legacy — skip synthetic)
  if uid is null then
    select p.id into uid
    from public.profiles p
    where p.email is not null
      and lower(trim(p.email)) = email_norm
      and lower(trim(p.email)) not like '%@students.eventsphere.local'
    limit 1;
  end if;

  -- 3) Auth users email fallback (must already have a profiles row for token storage)
  if uid is null then
    select u.id into uid
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.email is not null
      and lower(trim(u.email)) = email_norm
      and lower(trim(u.email)) not like '%@students.eventsphere.local'
    limit 1;
  end if;

  if uid is null then
    return null;
  end if;

  code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  update public.profiles
  set reset_token = extensions.crypt(code, extensions.gen_salt('bf'::text)),
      reset_token_expires_at = now() + interval '15 minutes',
      updated_at = now()
  where id = uid;

  if not found then
    return null;
  end if;

  return code;
end;
$$;

create or replace function public.complete_password_reset(
  p_email text,
  p_otp text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  email_norm text := lower(trim(coalesce(p_email, '')));
  code text := trim(coalesce(p_otp, ''));
  uid uuid;
  token text;
  expires_at timestamptz;
  has_personal boolean;
  has_must_change boolean;
begin
  if email_norm = '' or position('@' in email_norm) = 0 then
    return false;
  end if;

  if length(code) <> 6 then
    return false;
  end if;

  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  if email_norm like '%@students.eventsphere.local' then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'personal_email_verified'
  ) into has_personal;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'must_change_password'
  ) into has_must_change;

  if coalesce(has_personal, false) then
    execute
      'select p.id, p.reset_token, p.reset_token_expires_at
       from public.profiles p
       where (
         (p.personal_email_verified = true and lower(trim(p.personal_email)) = $1)
         or (
           p.email is not null
           and lower(trim(p.email)) = $1
           and lower(trim(p.email)) not like ''%@students.eventsphere.local''
         )
       )
       limit 1'
      into uid, token, expires_at
      using email_norm;
  else
    select p.id, p.reset_token, p.reset_token_expires_at
      into uid, token, expires_at
    from public.profiles p
    where p.email is not null
      and lower(trim(p.email)) = email_norm
      and lower(trim(p.email)) not like '%@students.eventsphere.local'
    limit 1;
  end if;

  if uid is null then
    select u.id into uid
    from auth.users u
    where lower(trim(u.email)) = email_norm
      and lower(trim(u.email)) not like '%@students.eventsphere.local'
    limit 1;

    if uid is not null then
      select p.reset_token, p.reset_token_expires_at
        into token, expires_at
      from public.profiles p
      where p.id = uid;
    end if;
  end if;

  if uid is null or token is null then
    return false;
  end if;

  if expires_at is null or expires_at < now() then
    update public.profiles
    set reset_token = null,
        reset_token_expires_at = null,
        updated_at = now()
    where id = uid;
    return false;
  end if;

  if token <> extensions.crypt(code, token) then
    return false;
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf'::text)),
      updated_at = now()
  where id = uid;

  if not found then
    return false;
  end if;

  if coalesce(has_must_change, false) then
    execute
      'update public.profiles
       set reset_token = null,
           reset_token_expires_at = null,
           must_change_password = false,
           updated_at = now()
       where id = $1'
      using uid;
  else
    update public.profiles
    set reset_token = null,
        reset_token_expires_at = null,
        updated_at = now()
    where id = uid;
  end if;

  return true;
end;
$$;

revoke all on function public.request_password_reset_otp(text) from public;
revoke all on function public.complete_password_reset(text, text, text) from public;

grant execute on function public.request_password_reset_otp(text) to anon, authenticated;
grant execute on function public.complete_password_reset(text, text, text) to anon, authenticated;
