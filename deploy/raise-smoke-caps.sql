-- Owner dashboard, only once the public URL is ready for one deployed acceptance journey.
-- Fresh anonymous deployment session: at most 15 additional logical calls globally today.
-- Not permission for another corpus evaluation. Counters are never reset.
-- Apply eval/restore-caps.sql immediately afterwards, including on failure/budget stop.
begin;
update public.app_settings
set value=jsonb_build_object(
  'per_user_daily_model_calls',15,
  'global_daily_model_calls',coalesce((select calls from public.model_usage_global
    where day=(now() at time zone 'Asia/Kolkata')::date),0)+15
)
where key='limits';
select value from public.app_settings where key='limits';
commit;
