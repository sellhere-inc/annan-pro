-- Run AFTER setting up Vault secrets in the dashboard:
-- circle_function_url = https://YOUR_PROJECT.supabase.co/functions/v1/send-notifications
-- circle_worker_secret = same random secret as PUSH_WORKER_SECRET in Edge Function secrets
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('circle-push-every-minute', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'circle_function_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'circle_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
