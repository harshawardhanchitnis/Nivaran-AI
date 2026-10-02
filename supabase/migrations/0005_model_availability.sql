-- Task routing: shared provider cooldowns; browser clients can read but cannot write them.
-- After applying, run the ignored setup SQL prepared by scripts/prepare-model-cooldowns.mjs.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table public.model_availability (
  model_key text primary key check (model_key ~ '^(google|groq):[A-Za-z0-9/_.-]+$' and length(model_key)<=160),
  usable_after timestamptz not null,
  reason text not null check (reason in ('quota','rate_limit','high_demand','timeout')),
  updated_at timestamptz not null default now()
);
alter table public.model_availability enable row level security;
create policy "model availability: signed-in users can read" on public.model_availability for select to authenticated using (true);
revoke all on public.model_availability from public, anon, authenticated;
grant select on public.model_availability to authenticated;

-- The server signs the exact model, reset time, reason and timestamp. The signing secret is
-- in app_settings, which has no client privileges or RLS policies. Replays cannot extend a reset.
create function public.record_model_cooldown(p_model_key text, p_until_ms bigint, p_reason text, p_issued_ms bigint, p_signature text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  secret text;
  expected text;
  payload text;
  now_ms bigint := floor(extract(epoch from clock_timestamp())*1000)::bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  if p_model_key is null or p_model_key !~ '^(google|groq):[A-Za-z0-9/_.-]+$' or length(p_model_key)>160
    or p_until_ms is null or p_until_ms<=now_ms or p_until_ms>now_ms+108000000
    or p_issued_ms is null or abs(now_ms-p_issued_ms)>60000
    or p_reason is null or p_reason not in ('quota','rate_limit','high_demand','timeout')
    or p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then raise exception 'Invalid cooldown receipt.'; end if;
  select value->>'secret' into secret from public.app_settings where key='model_cooldown_signing';
  if secret is null or length(secret)<32 then raise exception 'Cooldown signing is not configured.'; end if;
  payload := 'v1' || chr(10) || p_model_key || chr(10) || p_until_ms::text || chr(10) || p_reason || chr(10) || p_issued_ms::text;
  expected := encode(extensions.hmac(payload, secret, 'sha256'),'hex');
  if expected<>p_signature then raise exception 'Invalid cooldown signature.'; end if;
  insert into public.model_availability(model_key,usable_after,reason)
    values(p_model_key,to_timestamp(p_until_ms/1000.0),p_reason)
    on conflict(model_key) do update set usable_after=greatest(public.model_availability.usable_after,excluded.usable_after),
      reason=case when excluded.usable_after>=public.model_availability.usable_after then excluded.reason else public.model_availability.reason end,
      updated_at=now();
end;
$$;
revoke execute on function public.record_model_cooldown(text,bigint,text,bigint,text) from public, anon;
grant execute on function public.record_model_cooldown(text,bigint,text,bigint,text) to authenticated;
commit;
