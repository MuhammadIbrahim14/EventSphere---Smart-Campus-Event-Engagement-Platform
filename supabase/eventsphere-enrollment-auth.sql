-- EventSphere — Enrollment-first student provisioning
-- Run in Supabase SQL Editor after core profiles exist.
-- Then deploy Edge Functions: provision-student, student-login, admin-reset-student-password
-- Synthetic Auth email: {enrollment}@students.eventsphere.local (never shown as personal mail)

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles
  add column if not exists personal_email text;

alter table public.profiles
  add column if not exists personal_email_verified boolean not null default false;

alter table public.profiles
  add column if not exists provisioned boolean not null default false;

alter table public.profiles
  add column if not exists provisioned_at timestamptz;

alter table public.profiles
  add column if not exists provisioned_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.must_change_password is 'Provisioned students must set a new password after first login';
comment on column public.profiles.personal_email is 'Optional privacy email (OTP-verified); Auth email stays synthetic for provisioned students';
comment on column public.profiles.provisioned is 'True when created by admin enrollment provisioning';

-- ---------------------------------------------------------------------------
-- Uniqueness
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_enrollment_no_student_uidx
  on public.profiles (lower(trim(enrollment_no)))
  where role = 'user'
    and enrollment_no is not null
    and length(trim(enrollment_no)) > 0;

create unique index if not exists profiles_personal_email_verified_uidx
  on public.profiles (lower(trim(personal_email)))
  where personal_email_verified = true
    and personal_email is not null
    and length(trim(personal_email)) > 0;

-- ---------------------------------------------------------------------------
-- OTP storage for personal-email link (logged-in student)
-- ---------------------------------------------------------------------------
create table if not exists public.personal_email_otps (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.personal_email_otps enable row level security;

drop policy if exists personal_email_otps_deny_all on public.personal_email_otps;
create policy personal_email_otps_deny_all
  on public.personal_email_otps
  for all
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.normalize_enrollment(p_raw text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(trim(coalesce(p_raw, '')), '\s+', '', 'g'));
$$;

create or replace function public.synthetic_student_email(p_enrollment text)
returns text
language sql
immutable
as $$
  select lower(public.normalize_enrollment(p_enrollment)) || '@students.eventsphere.local';
$$;

create or replace function public.is_synthetic_campus_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) like '%@students.eventsphere.local';
$$;

-- ---------------------------------------------------------------------------
-- Personal email OTP (authenticated student)
-- ---------------------------------------------------------------------------
create or replace function public.request_personal_email_otp(p_email text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  email_norm text := lower(trim(coalesce(p_email, '')));
  code text;
  clash uuid;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  if email_norm is null or position('@' in email_norm) = 0 then
    raise exception 'Enter a valid email address';
  end if;

  if public.is_synthetic_campus_email(email_norm) then
    raise exception 'Choose a personal email address';
  end if;

  select id into clash
  from public.profiles
  where personal_email_verified = true
    and lower(trim(personal_email)) = email_norm
    and id <> uid
  limit 1;

  if clash is not null then
    raise exception 'That email is already linked to another account';
  end if;

  code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.personal_email_otps (user_id, email, otp_hash, expires_at)
  values (
    uid,
    email_norm,
    extensions.crypt(code, extensions.gen_salt('bf'::text)),
    now() + interval '15 minutes'
  )
  on conflict (user_id) do update
    set email = excluded.email,
        otp_hash = excluded.otp_hash,
        expires_at = excluded.expires_at,
        created_at = now();

  return code;
end;
$$;

create or replace function public.verify_personal_email_otp(p_otp text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  row_otp public.personal_email_otps%rowtype;
  code text := trim(coalesce(p_otp, ''));
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  select * into row_otp
  from public.personal_email_otps
  where user_id = uid;

  if not found then
    raise exception 'No OTP pending. Request a new code.';
  end if;

  if row_otp.expires_at < now() then
    delete from public.personal_email_otps where user_id = uid;
    raise exception 'OTP expired. Request a new code.';
  end if;

  if row_otp.otp_hash <> extensions.crypt(code, row_otp.otp_hash) then
    raise exception 'Invalid code';
  end if;

  perform set_config('eventsphere.profile_guard', 'off', true);

  update public.profiles
  set personal_email = row_otp.email,
      personal_email_verified = true,
      updated_at = now()
  where id = uid;

  delete from public.personal_email_otps where user_id = uid;
  return true;
end;
$$;

revoke all on function public.request_personal_email_otp(text) from public;
revoke all on function public.verify_personal_email_otp(text) from public;
grant execute on function public.request_personal_email_otp(text) to authenticated;
grant execute on function public.verify_personal_email_otp(text) to authenticated;
grant execute on function public.normalize_enrollment(text) to anon, authenticated;
grant execute on function public.synthetic_student_email(text) to anon, authenticated;
grant execute on function public.is_synthetic_campus_email(text) to anon, authenticated;

create or replace function public.clear_must_change_password()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  perform set_config('eventsphere.profile_guard', 'off', true);
  update public.profiles
  set must_change_password = false,
      updated_at = now()
  where id = uid;
  return true;
end;
$$;

revoke all on function public.clear_must_change_password() from public;
grant execute on function public.clear_must_change_password() to authenticated;

create or replace function public.lookup_profile_for_student_login(p_mode text, p_identifier text)
returns table (
  id uuid,
  enrollment_no text,
  personal_email text,
  personal_email_verified boolean,
  auth_email text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  mode_norm text := lower(trim(coalesce(p_mode, '')));
  id_norm text := trim(coalesce(p_identifier, ''));
  enr text;
begin
  if mode_norm = 'enrollment' then
    enr := public.normalize_enrollment(id_norm);
    return query
      select p.id,
             p.enrollment_no,
             p.personal_email,
             p.personal_email_verified,
             public.synthetic_student_email(p.enrollment_no) as auth_email,
             p.role::text
      from public.profiles p
      where p.role = 'user'
        and public.normalize_enrollment(p.enrollment_no) = enr
      limit 1;
  elsif mode_norm = 'email' then
    id_norm := lower(id_norm);
    return query
      select p.id,
             p.enrollment_no,
             p.personal_email,
             p.personal_email_verified,
             case
               when p.provisioned and p.enrollment_no is not null
                 then public.synthetic_student_email(p.enrollment_no)
               else lower(trim(p.email))
             end as auth_email,
             p.role::text
      from public.profiles p
      where p.personal_email_verified = true
        and lower(trim(p.personal_email)) = id_norm
      limit 1;
  end if;
end;
$$;

revoke all on function public.lookup_profile_for_student_login(text, text) from public;
grant execute on function public.lookup_profile_for_student_login(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Guard: students cannot rewrite enrollment / provision flags / personal email
-- RPCs set eventsphere.profile_guard=off (transaction-local). Service role
-- (auth.uid() null) is allowed through for Edge Functions.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_protect_provisioned()
returns trigger
language plpgsql
as $$
begin
  if current_setting('eventsphere.profile_guard', true) = 'off' then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if old.provisioned is true and auth.uid() is not null then
    new.enrollment_no := old.enrollment_no;
    new.provisioned := old.provisioned;
    new.provisioned_at := old.provisioned_at;
    new.provisioned_by := old.provisioned_by;
    new.personal_email := old.personal_email;
    new.personal_email_verified := old.personal_email_verified;
    new.must_change_password := old.must_change_password;
    new.email_verified := old.email_verified;
  end if;

  if auth.uid() is not null and auth.uid() = old.id then
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_provisioned on public.profiles;
create trigger trg_profiles_protect_provisioned
before update on public.profiles
for each row
execute procedure public.profiles_protect_provisioned();

