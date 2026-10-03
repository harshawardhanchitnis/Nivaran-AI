-- Read-only, caller-scoped quota advice for Run it live. Charge remains authoritative.
create or replace function public.model_budget_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  india_day date := (now() at time zone 'Asia/Kolkata')::date;
  user_limit integer; global_limit integer; user_calls integer; global_calls integer;
begin
  if caller is null then raise exception 'Sign in to check remaining calls.' using errcode='28000'; end if;
  select (value->>'per_user_daily_model_calls')::integer, (value->>'global_daily_model_calls')::integer
    into user_limit, global_limit from public.app_settings where key='limits';
  if user_limit is null or global_limit is null then raise exception 'Usage limits are not configured.'; end if;
  select coalesce((select calls from public.model_usage where user_id=caller and day=india_day),0) into user_calls;
  select coalesce((select calls from public.model_usage_global where day=india_day),0) into global_calls;
  return jsonb_build_object('day',india_day,'remaining',greatest(0,least(user_limit-user_calls,global_limit-global_calls)),
    'reason',case when user_calls>=user_limit then 'user_limit' when global_calls>=global_limit then 'global_limit' else null end,
    'reset_at',((india_day+1)::timestamp at time zone 'Asia/Kolkata'));
end; $$;
revoke execute on function public.model_budget_status() from public, anon;
grant execute on function public.model_budget_status() to authenticated;
