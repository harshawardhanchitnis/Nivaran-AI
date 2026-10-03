-- Owner dashboard: final evaluation pass, at most 70 MORE logical calls today.
-- The final-stage-one checkpoint separately enforces 70 total across resumes.
-- Usage is retained. Run restore-caps.sql immediately after the pass.
begin;
update public.app_settings
set value=jsonb_build_object(
  'per_user_daily_model_calls',coalesce((select calls from public.model_usage_global
    where day=(now() at time zone 'Asia/Kolkata')::date),0)+70,
  'global_daily_model_calls',coalesce((select calls from public.model_usage_global
    where day=(now() at time zone 'Asia/Kolkata')::date),0)+70
)
where key='limits';
select value from public.app_settings where key='limits';
commit;
