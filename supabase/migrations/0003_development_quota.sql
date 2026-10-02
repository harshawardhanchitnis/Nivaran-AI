-- T2: allow the owner to finish manual reader checks after charged failed attempts.
-- The global cap stays at 15, below the reported primary limit of 20 requests per day.
begin;
update public.app_settings
   set value = value || jsonb_build_object('per_user_daily_model_calls', 12, 'global_daily_model_calls', 15)
 where key = 'limits';
commit;
