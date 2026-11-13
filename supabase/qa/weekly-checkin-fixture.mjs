import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE || '/tmp/du-checkin-qa/node_modules/@electric-sql/pglite/dist/index.js').href);
export const ids={athlete:'30000000-0000-4000-8000-000000000001',user:'40000000-0000-4000-8000-000000000001',parent:'40000000-0000-4000-8000-000000000002',other:'40000000-0000-4000-8000-000000000003',admin:'40000000-0000-4000-8000-000000000009',week:'50000000-0000-4000-8000-000000000001',next:'50000000-0000-4000-8000-000000000002',programme:'60000000-0000-4000-8000-000000000001'};
export async function createCheckinFixture({sunday=true}={}){
const db=new PGlite();
const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
create table admin_profiles(user_id uuid primary key);
create table athletes(id uuid primary key,full_name text,parent_user_id uuid,athlete_user_id uuid,programme_id uuid,cohort_id uuid,current_week int,programme_start_date date,onboarding_complete bool,access_status text,access_reason text,payment_status text);
create table cohorts(id uuid primary key,programme_id uuid,current_week int,tier text,status text,start_date date);
create table training_days(id uuid primary key);create table session_blocks(id uuid primary key);
create table programme_tiers(id uuid primary key,programme_id uuid,name text);
create table programme_weeks(id uuid primary key,programme_id uuid,week_number int,tier_id uuid,status text,verification_status text,published_at timestamptz);
create table feedback(id uuid primary key default gen_random_uuid(),athlete_id uuid,staff_id uuid,cohort_id uuid,week_number int,feedback_type text,payload jsonb,status text,reviewed_at timestamptz,admin_reply text,created_at timestamptz default now());
insert into athletes values('${ids.athlete}','Synthetic athlete','${ids.parent}','${ids.user}','${ids.programme}',null,9,null,true,'active','complimentary','not_required');
insert into programme_weeks values('${ids.week}','${ids.programme}',9,null,'live','verified',now()),('${ids.next}','${ids.programme}',10,null,'live','verified',now());
insert into admin_profiles values('${ids.admin}');
grant usage on schema public,auth to anon,authenticated,service_role;grant all on athletes,cohorts,programme_weeks,programme_tiers,feedback,admin_profiles to service_role;grant select on admin_profiles to authenticated;`);
await db.exec(fs.readFileSync(new URL('../migrations/20261107055415_feedback_revision_history.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../migrations/20261112090000_mandatory_weekly_checkins.sql',import.meta.url),'utf8'));
if(sunday)await db.exec(fs.readFileSync(new URL('../migrations/20261113040957_parent_sunday_checkins.sql',import.meta.url),'utf8'));
const state=(date,role='private-athlete',user=ids.user)=>scalar('select public.weekly_checkin_state($1,$2,$3)',[user,role,date]);
const save=(r,p,id='submission-0000000000001',revision=0,safety=false,user=ids.user,role='private-athlete',date='2026-11-13T16:00Z')=>scalar('select public.save_weekly_checkin($1,$2,$3,$4,$5,$6,$7,$8)',[user,role,r,id,p,revision,safety,date]);
const answer={formVersion:'2.0',completion:'some',challenge:'right',recovery:'good',outside:'no',incompleteReason:'school',note:''};

return {db,scalar,state,save,ids};
}
