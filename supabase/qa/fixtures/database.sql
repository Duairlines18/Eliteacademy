-- Disposable synthetic database; never apply this fixture to a hosted project.
CREATE SCHEMA auth;
CREATE SCHEMA journey_private;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE TABLE public.admin_profiles(user_id uuid PRIMARY KEY);
CREATE TABLE public.programmes(id uuid PRIMARY KEY,name text,sport text,status text);
CREATE TABLE public.cohorts(id uuid PRIMARY KEY,programme_id uuid,current_week integer,current_phase text,status text,name text,tier text,updated_at timestamptz);
CREATE TABLE public.athletes(id uuid PRIMARY KEY,full_name text,display_name text,athlete_type text,programme_id uuid,cohort_id uuid,current_week integer,current_phase text,access_status text,parent_user_id uuid,athlete_user_id uuid,form_tier text,personal_bests jsonb,updated_at timestamptz);
CREATE TABLE public.programme_tiers(id uuid PRIMARY KEY,programme_id uuid,name text);
CREATE TABLE public.programme_weeks(id uuid PRIMARY KEY,programme_id uuid,tier_id uuid,week_number integer,phase text,weekly_objective text,running_focus text,strength_focus text,event_focus text,status text CHECK(status IN ('draft','scheduled','live','completed','archived')),verification_status text CHECK(verification_status IN ('verified','needs_verification')),published_at timestamptz,updated_at timestamptz);
CREATE TABLE public.training_days(id uuid PRIMARY KEY,programme_week_id uuid,day_key text,title text);
CREATE TABLE public.session_blocks(id uuid PRIMARY KEY,training_day_id uuid,title text,content jsonb);
CREATE TABLE public.exercises(id uuid PRIMARY KEY,code text,active boolean);
CREATE TABLE public.performance_journey_context(subject_kind text,subject_id uuid,programme_id uuid,reviewed_week integer,next_title text,next_focus text,purpose text,synced_at timestamptz);
CREATE TABLE public.cohort_overrides(cohort_id uuid,programme_week_id uuid,active boolean);
CREATE TABLE public.athlete_overrides(athlete_id uuid,programme_week_id uuid,active boolean);
CREATE TABLE public.workout_item_completions(athlete_id uuid,programme_key text,week_number integer,completed boolean,completed_at timestamptz);
CREATE TABLE public.feedback(athlete_id uuid,cohort_id uuid,week_number integer,created_at timestamptz,payload jsonb,feedback_type text);
CREATE TABLE public.technique_video_submissions(athlete_id uuid,programme_week_id uuid,review_state text,reviewed_at timestamptz);
CREATE TABLE journey_private.assignment_versions(subject_kind text,subject_id uuid,version integer);
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_blocks ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

INSERT INTO programmes VALUES
 ('10000000-0000-4000-8000-000000000001','Assigned QA','Athletics','live'),
 ('10000000-0000-4000-8000-000000000002','Stale cohort QA','Athletics','live');
INSERT INTO cohorts(id,programme_id,current_week,status,name) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',1,'live','QA cohort');
INSERT INTO athletes(id,full_name,display_name,athlete_type,programme_id,cohort_id,current_week,access_status,parent_user_id,athlete_user_id) VALUES
 ('30000000-0000-4000-8000-000000000001','Synthetic QA Athlete','QA','private','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',6,'active','40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002');
INSERT INTO admin_profiles VALUES ('40000000-0000-4000-8000-000000000009');
INSERT INTO programme_weeks(id,programme_id,week_number,status,verification_status,published_at) VALUES
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',6,'live','verified','2026-10-19T00:00:00Z'),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',7,'draft','needs_verification',null),
 ('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',8,'live','verified',null),
 ('50000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',9,'live','needs_verification','2026-10-19T00:00:00Z'),
 ('50000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002',1,'live','verified','2026-10-19T00:00:00Z');
INSERT INTO training_days SELECT ('60000000-0000-4000-8000-'||right(id::text,12))::uuid,id,'Monday','QA session' FROM programme_weeks;
INSERT INTO session_blocks SELECT ('70000000-0000-4000-8000-'||right(id::text,12))::uuid,id,'QA block','{"prescriptions":[{"exerciseCode":"BR","dosage":"2 x 8","rest":"60 seconds"}]}' FROM training_days;
INSERT INTO exercises VALUES ('80000000-0000-4000-8000-000000000001','BR',true);
