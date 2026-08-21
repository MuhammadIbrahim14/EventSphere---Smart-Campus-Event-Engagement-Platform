-- RUN THIS NOW in Supabase SQL Editor (fixes missing request_email_otp)
-- Then click Run. If needed: Project Settings → API → Reload schema (or wait a few seconds)

alter table public.profiles
  add column if not exists email_verified boolean not null default false;

alter table public.profiles
  add column if not exists confirm_token text;

alter table public.profiles
  add column if not exists confirm_token_expires_at timestamptz;

drop function if exists public.verify_email_token(text);
drop function if exists public.request_email_confirmation();
drop function if exists public.request_email_otp();
drop function if exists public.verify_email_otp(text);

create or replace function public.request_email_otp()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  otp text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  otp := lpad(floor(random() * 1000000)::int::text, 6, '0');

  update public.profiles
  set
    confirm_token = otp,
    confirm_token_expires_at = now() + interval '10 minutes',
    email_verified = false
  where id = auth.uid();

  if not found then
    -- create profile if missing
    insert into public.profiles (id, full_name, email, role, email_verified, confirm_token, confirm_token_expires_at)
    select
      u.id,
      coalesce(u.raw_user_meta_data->>'full_name', ''),
      u.email,
      'user',
      false,
      otp,
      now() + interval '10 minutes'
    from auth.users u
    where u.id = auth.uid();
  end if;

  return otp;
end;
$$;

create or replace function public.verify_email_otp(otp text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
  cleaned text;
begin
  if auth.uid() is null then
    return false;
  end if;

  cleaned := trim(otp);
  if cleaned is null or length(cleaned) <> 6 then
    return false;
  end if;

  update public.profiles
  set
    email_verified = true,
    confirm_token = null,
    confirm_token_expires_at = null,
    updated_at = now()
  where id = auth.uid()
    and confirm_token = cleaned
    and confirm_token_expires_at is not null
    and confirm_token_expires_at > now();

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function public.request_email_otp() to authenticated;
grant execute on function public.request_email_otp() to anon;
grant execute on function public.verify_email_otp(text) to authenticated;
grant execute on function public.verify_email_otp(text) to anon;

-- Refresh PostgREST schema cache so RPC is visible immediately
notify pgrst, 'reload schema';
