-- Owner-reported limits on 2 Oct: Gemini Flash models 20 RPD each, Flash Lite 500 RPD.
-- A logical call tries each model at most once. Keep the global cap below 20, rather than
-- summing provider quotas. Earlier charges are retained, including the original diagnostics.
begin;
update public.app_settings
set value=jsonb_build_object('per_user_daily_model_calls',15,'global_daily_model_calls',15)
where key='limits';
commit;
