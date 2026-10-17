alter table public.performance_journey_context add column if not exists reviewed_week integer;
create or replace function public.performance_journey_source(p_kind text,p_id uuid,p_parent boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 a public.athletes%rowtype; c public.cohorts%rowtype; p public.programmes%rowtype;
 pid uuid; tierid uuid; cw integer; nm text; weeks jsonb; ctx jsonb; ev jsonb;
 since_at timestamptz:=now()-interval '14 days'; overrides integer:=0;
begin
 if p_kind='athlete' then
  select * into a from public.athletes where id=p_id and access_status='active';
  if not found then return null; end if;
  if a.cohort_id is not null then select * into c from public.cohorts where id=a.cohort_id and status='live'; end if;
  if p_parent then pid:=c.programme_id;cw:=c.current_week;
  else pid:=coalesce(a.programme_id,c.programme_id);cw:=case when a.programme_id is not null then a.current_week else c.current_week end;end if;
  nm:=coalesce(nullif(a.display_name,''),a.full_name,'Athlete');
 elsif p_kind='cohort' then
  select * into c from public.cohorts where id=p_id and status='live';
  if not found then return null;end if;
  pid:=c.programme_id;cw:=c.current_week;nm:=c.name;
 else return null;end if;
 if pid is null then return null;end if;
 cw:=coalesce(cw,1);
 select * into p from public.programmes where id=pid;
 if not found then return null;end if;
 if (p_kind='cohort' or p_parent or a.programme_id is null) and c.tier is not null then
  select id into tierid from public.programme_tiers where programme_id=pid and name=c.tier;
  if not found then return null;end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'week_number',w.week_number,'phase',w.phase,'weekly_objective',w.weekly_objective,'running_focus',w.running_focus,'strength_focus',w.strength_focus,'event_focus',w.event_focus,'status',w.status,'verification_status',w.verification_status,'published_at',w.published_at) order by w.week_number),'[]'::jsonb)
 into weeks from public.programme_weeks w where w.programme_id=pid and w.week_number<=cw and (w.status in ('live','completed') or (w.status='archived' and w.week_number<cw)) and w.verification_status='verified' and w.published_at is not null and w.tier_id is not distinct from tierid;
 select jsonb_build_object('programme_id',programme_id,'next_title',case when reviewed_week=cw then next_title else '' end,'next_focus',case when reviewed_week=cw then next_focus else '' end,'purpose',purpose,'synced_at',synced_at)
 into ctx from public.performance_journey_context where subject_kind=p_kind and subject_id=p_id and programme_id=pid;
 -- Overrides are counted only for the visible programme; no private override notes are returned.
 select count(*) into overrides from public.cohort_overrides o join public.programme_weeks w on w.id=o.programme_week_id where o.cohort_id=c.id and o.active and w.programme_id=pid and w.week_number<=cw;
 if p_kind='athlete' then
  overrides:=overrides+(select count(*) from public.athlete_overrides o join public.programme_weeks w on w.id=o.programme_week_id where o.athlete_id=a.id and o.active and w.programme_id=pid and w.week_number<=cw);
  select jsonb_build_object(
   'checked_items',(select count(*) from public.workout_item_completions x where x.athlete_id=a.id and x.programme_key=pid::text and x.week_number<=cw and x.completed and x.completed_at>=since_at),
   'checkins',(select count(*) from public.feedback f where f.athlete_id=a.id and f.week_number<=cw and f.created_at>=since_at),
   'reviewed_videos',(select count(*) from public.technique_video_submissions v join public.programme_weeks w on w.id=v.programme_week_id where v.athlete_id=a.id and w.programme_id=pid and w.week_number<=cw and v.review_state='reviewed' and v.reviewed_at>=since_at),
   'improvements',coalesce((select jsonb_agg(distinct value) from public.feedback f cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f.payload->'improvements')='array' then f.payload->'improvements' when jsonb_typeof(f.payload->'observations')='array' then f.payload->'observations' else '[]'::jsonb end) value where f.athlete_id=a.id and f.week_number<=cw and f.created_at>=since_at and value in ('Speed','Jumping','Strength','Mobility','Coordination','Conditioning','Moving better','Stronger','Jumping better','More coordinated','More confident')),'[]'::jsonb),
   'override_count',overrides) into ev;
 else
  select jsonb_build_object(
   'roster_count',(select count(*) from public.athletes r where r.cohort_id=c.id and r.access_status='active'),
   'respondents',(select count(distinct f.athlete_id) from public.feedback f join public.athletes r on r.id=f.athlete_id where r.cohort_id=c.id and r.access_status='active' and f.week_number<=cw and f.created_at>=since_at),
   'shared_submissions',(select count(*) from public.feedback f where f.cohort_id=c.id and f.athlete_id is null and f.feedback_type in ('athlete_biweekly','athlete_issue') and f.week_number<=cw and f.created_at>=since_at),
   'coach_checkins',(select count(*) from public.feedback f where f.cohort_id=c.id and f.feedback_type='coach_weekly' and f.week_number<=cw and f.created_at>=since_at),
   'override_count',overrides) into ev;
 end if;
 return jsonb_build_object('name',nm,'current_week',cw,'programme',jsonb_build_object('id',pid,'name',p.name,'sport',p.sport),'weeks',weeks,'context',ctx,'evidence',ev,'evidence_since',since_at,'generated_at',now(),'personal_bests',case when p_kind='athlete' then coalesce(a.personal_bests,'{}'::jsonb) else '{}'::jsonb end);
end $$;
revoke all on function public.performance_journey_source(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.performance_journey_source(text,uuid,boolean) to service_role;


