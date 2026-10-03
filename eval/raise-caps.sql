-- Dashboard-only, AFTER the owner approves a batch of at most 300 logical calls.
-- The runner separately enforces 450 provider attempts, including immediate fallback attempts.
-- Preserve today's usage. This grants at most 300 more global logical charges today.
begin;
update public.app_settings
set value = jsonb_build_object(
  'per_user_daily_model_calls', coalesce((select calls from public.model_usage_global where day=(now() at time zone 'Asia/Kolkata')::date),0)+300,
  'global_daily_model_calls', coalesce((select calls from public.model_usage_global where day=(now() at time zone 'Asia/Kolkata')::date),0)+300
)
where key='limits';
select value from public.app_settings where key='limits';
commit;
