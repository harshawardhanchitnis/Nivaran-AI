-- Dashboard-only: owner authorised stage-one rerun, at most 40 MORE logical calls.
-- Apply after code checks; the named runner checkpoint independently enforces 40 total.
-- This preserves usage and matches charge_model_call()'s India day.
begin;
update public.app_settings
set value=jsonb_build_object(
  'per_user_daily_model_calls',coalesce((select calls from public.model_usage_global
    where day=(now() at time zone 'Asia/Kolkata')::date),0)+40,
  'global_daily_model_calls',coalesce((select calls from public.model_usage_global
    where day=(now() at time zone 'Asia/Kolkata')::date),0)+40
)
where key='limits';
select value from public.app_settings where key='limits';
commit;
