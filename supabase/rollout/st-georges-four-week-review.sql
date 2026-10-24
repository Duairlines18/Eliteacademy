-- ADMIN REVIEW PREPARATION ONLY. No publication or live assignment changes.
-- Reversible: before-image includes every draft week/day/block. Use this snapshot
-- to restore modified Week 1; archive the newly cloned days instead of deleting history.
begin;
do $$
declare
 pilot uuid := '9d5f562a-fa5b-44d1-a366-52e14bd3978c';
 marker text := 'st-georges-four-week-review-20261024';
 source_week uuid; w record; source_day record; new_day uuid; codes text[];
begin
 if exists(select 1 from programme_versions where change_note=marker||': before-image') then
  raise exception 'Review preparation already exists; inspect before repeating';
 end if;
 if exists(select 1 from programme_weeks where programme_id=pilot and (published_at is not null or status not in ('draft'))) then
  raise exception 'Pilot no longer unpublished; re-audit';
 end if;
 select id into strict source_week from programme_weeks where programme_id=pilot and week_number=1;
 insert into programme_versions(programme_week_id,snapshot,change_note)
 select source_week,jsonb_build_object('programme',(select to_jsonb(p) from programmes p where p.id=pilot),
 'weeks',(select jsonb_agg(w) from programme_weeks w where w.programme_id=pilot),
 'days',(select jsonb_agg(d) from training_days d join programme_weeks w on w.id=d.programme_week_id where w.programme_id=pilot),
 'blocks',(select jsonb_agg(b) from session_blocks b join training_days d on d.id=b.training_day_id join programme_weeks w on w.id=d.programme_week_id where w.programme_id=pilot)),marker||': before-image';
 if (select count(*) from exercises where active and code in ('PLY01','PLY02','PLY03','PLY06','PLY08') and coalesce(video_id,'')<>'')<>5 then
  raise exception 'Plyometric library mapping changed';
 end if;
 -- Reorder existing warm-up/blocks without changing their prescriptions.
 update session_blocks b set sort_order=case when b.block_type='warm-up' then 0 else b.sort_order+1 end
 from training_days d where d.id=b.training_day_id and d.programme_week_id=source_week and d.sort_order in (1,2);
 for source_day in select * from training_days where programme_week_id=source_week and sort_order in (1,2) loop
  codes:=case when source_day.sort_order=1 then array['PLY01','PLY03','PLY02','PLY08'] else array['PLY01','PLY03','PLY06','PLY02'] end;
  insert into session_blocks(training_day_id,block_type,title,sort_order,content,athlete_note,staff_note,admin_note)
  select source_day.id,'school','Plyometric technique stations - Coach Du review',1,
   jsonb_build_object('requirement','Review required','prescriptions',jsonb_agg(jsonb_build_object('exerciseCode',code,'dosage','','rest','','cues','Technique menu only. Coach Du must approve sets, repetitions, recovery and readiness before delivery.') order by ord)),
   'Awaiting Coach Du prescription. Do not perform an unspecified circuit.',
   'Use controlled technical practice with full recovery. Snap Down is a landing rehearsal. Check readiness and total contacts including ASIM; do not use as a fatigue circuit.',
   'Review-only candidates from active canonical library; no load progression approved.'
  from unnest(codes) with ordinality as e(code,ord);
 end loop;
 for w in select * from programme_weeks where programme_id=pilot order by week_number loop
  update programme_weeks set phase='Four-week foundations pilot - review',weekly_objective=case w.week_number
   when 1 then 'Establish movement positions, running rhythm and controlled landing foundations.'
   when 2 then 'Consolidate the same movement and landing standards; coach checks readiness before any progression.'
   when 3 then 'Improve consistency of running, strength and landing technique; adapt after coaching feedback.'
   else 'Review four-week participation and movement quality, then agree the next training block.' end,
   status='draft',verification_status='needs_verification',published_at=null where id=w.id;
  if w.week_number>1 then
   if exists(select 1 from training_days where programme_week_id=w.id) then raise exception 'Later week already has sessions; re-audit';end if;
   for source_day in select * from training_days where programme_week_id=source_week order by sort_order loop
    insert into training_days(programme_week_id,day_key,title,intensity,objective,duration,sort_order)
    values(w.id,source_day.day_key,source_day.title,source_day.intensity,source_day.objective,source_day.duration,source_day.sort_order) returning id into new_day;
    insert into session_blocks(training_day_id,block_type,title,sort_order,saved_block_id,content,athlete_note,staff_note,admin_note)
    select new_day,block_type,title,sort_order,saved_block_id,content,athlete_note,staff_note,
    marker||': reference copy of Week 1, no automatic increase; Coach Du review required. Source block '||id
    from session_blocks where training_day_id=source_day.id;
   end loop;
  end if;
 end loop;
 update programmes set duration_weeks=4,status='draft' where id=pilot;
 -- After prescription approval, verify/publish selected weeks using existing flow.
 -- Switch cohort.programme_id and expected_sessions_per_week=2 together, retaining
 -- current_week=1 and start_date=NULL until payment and school schedule are confirmed.
end $$;
commit;
