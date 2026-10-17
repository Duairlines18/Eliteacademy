create extension if not exists pg_cron;
select cron.schedule('du-performance-journey-due-check','15 6 * * *','select public.refresh_performance_journeys();');
