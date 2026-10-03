-- Dashboard-only: run after the evaluation finishes OR stops. Do not reset usage counters.
begin;
update public.app_settings
set value=jsonb_build_object('per_user_daily_model_calls',15,'global_daily_model_calls',15)
where key='limits';
select value from public.app_settings where key='limits';
commit;
