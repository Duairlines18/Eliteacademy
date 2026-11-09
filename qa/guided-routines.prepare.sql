-- #96: data-only preparation. NOT a migration. Default is a complete ROLLBACK.
-- Release gates: docs/superpowers/plans/2026-11-09-guided-training.md.
-- Run in a disposable database first. Do not replace ROLLBACK with COMMIT until
-- hosted isolation, video/variant review, private backup/restore, backend parity
-- and browser regressions are signed off. No auth, assignment or history writes.
BEGIN;
DO $guided$
DECLARE
  target record;
  week_id uuid;
  mobility_id uuid;
  warmup_id uuid;
  actual_hash text;
  snapshot jsonb;
  history_hash text;
  after_history_hash text;
  routine_note text := 'Use comfortable movements. Stop if your hip hurts. For practice, continue your team warm-up before full-speed jumping. Do not repeat extra pogo sets.';
BEGIN
  SELECT md5(coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id)::text FROM workout_item_completions c),'')
    ||coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id)::text FROM feedback f),'')) INTO history_hash;
  FOR target IN SELECT * FROM (VALUES
    ('8abd2210-bb04-444f-affe-3281d65033f8'::uuid,'0de17bfe-2126-4f60-9e32-358b799355bd'::uuid,'d0524315-b762-46b5-9a23-310d01fb9d45'::uuid),
    ('7ddbf26e-4d2e-4dde-b7a4-a30264aea357'::uuid,'a87e23a6-4958-44e9-b2fc-874fe363e039'::uuid,'4249a539-7a95-425a-9c74-f125ea7ef29d'::uuid)
  ) AS t(athlete_id,programme_id,expected_week_id)
  LOOP
    PERFORM 1 FROM athletes WHERE id=target.athlete_id AND programme_id=target.programme_id
      AND current_week=9 AND access_status='active' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Athlete assignment drift'; END IF;
    IF EXISTS(SELECT 1 FROM athletes WHERE programme_id=target.programme_id AND id<>target.athlete_id) THEN
      RAISE EXCEPTION 'Programme is shared; do not modify';
    END IF;
    SELECT id INTO week_id FROM programme_weeks WHERE id=target.expected_week_id
      AND programme_id=target.programme_id AND week_number=9 AND status='live'
      AND verification_status='verified' AND published_at IS NOT NULL FOR UPDATE;
    IF week_id IS NULL THEN RAISE EXCEPTION 'Published week drift'; END IF;
    PERFORM 1 FROM training_days WHERE programme_week_id=week_id FOR UPDATE;
    PERFORM 1 FROM session_blocks WHERE training_day_id IN(SELECT id FROM training_days WHERE programme_week_id=week_id) FOR UPDATE;
    SELECT md5(string_agg(b.content::text,'|' ORDER BY d.sort_order,b.sort_order)) INTO actual_hash
      FROM training_days d JOIN session_blocks b ON b.training_day_id=d.id WHERE d.programme_week_id=week_id;
    IF actual_hash<>'0b65a8ddd00f340f8f9dbbdbbb09d5d5' THEN RAISE EXCEPTION 'Workout content drift or already applied'; END IF;
    IF (SELECT count(*) FROM training_days WHERE programme_week_id=week_id)<>3
      OR (SELECT count(*) FROM session_blocks b JOIN training_days d ON d.id=b.training_day_id
          WHERE d.programme_week_id=week_id AND b.sort_order=0 AND b.block_type='warm-up'
          AND b.title='Established Standard Warm-Up')<>3 THEN RAISE EXCEPTION 'Preparation block drift'; END IF;
    IF EXISTS(SELECT 1 FROM session_blocks b JOIN training_days d ON d.id=b.training_day_id,
        LATERAL jsonb_array_elements(b.content->'prescriptions') rx
        WHERE d.programme_week_id=week_id AND b.block_type='training' AND rx->>'exerciseCode'='PLY03') THEN
      RAISE EXCEPTION 'Duplicate pogo volume requires coach review';
    END IF;
    SELECT jsonb_build_object('week',(SELECT to_jsonb(w) FROM programme_weeks w WHERE w.id=week_id),
      'training_days',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.sort_order) FROM training_days d WHERE d.programme_week_id=week_id),
      'session_blocks',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM session_blocks b JOIN training_days d ON d.id=b.training_day_id WHERE d.programme_week_id=week_id)) INTO snapshot;
    INSERT INTO programme_versions(programme_week_id,snapshot,change_note)
      VALUES(week_id,snapshot,'Before #96 standalone preparation routines; preserve original day/block IDs and completion keys');
    mobility_id:=gen_random_uuid();warmup_id:=gen_random_uuid();
    INSERT INTO training_days(id,programme_week_id,day_key,title,duration,sort_order) VALUES
      (mobility_id,week_id,'Mobility Routine','Mobility','About 3 minutes',90),
      (warmup_id,week_id,'Standard Warm-Up','Standard Volleyball Warm-Up','About 5 minutes',91);
    INSERT INTO session_blocks(training_day_id,block_type,title,sort_order,content) VALUES
      (mobility_id,'warm-up','Mobility',0,jsonb_build_object('routineKind','mobility','watch',routine_note,'prescriptions',
        '[{"exerciseCode":"WU01","dosage":"1 × 8 each ankle","cues":"Keep your heel down; move your knee gently forward."},{"exerciseCode":"WU06","dosage":"1 × 8 each leg","cues":"Hold a support and control each swing."},{"exerciseCode":"WU07","dosage":"1 × 8 each leg","cues":"Stay tall and use small controlled swings."},{"exerciseCode":"WU05","dosage":"1 × 5 each side","cues":"Open your hip without twisting your body."}]'::jsonb)),
      (warmup_id,'warm-up','Standard Volleyball Warm-Up',0,jsonb_build_object('routineKind','warm-up','watch',routine_note,'prescriptions',
        '[{"exerciseCode":"WU03","dosage":"1 × 6 each leg","cues":"Stay tall and turn toward your front leg."},{"exerciseCode":"SPR01","dosage":"2 × 15 m","cues":"March tall with relaxed, rhythmic arms."},{"exerciseCode":"PLY03","dosage":"2 × 10","cues":"Use small, quiet bounces. Stop if painful."}]'::jsonb));
    UPDATE session_blocks b SET content=b.content||jsonb_build_object('preparation',jsonb_build_object(
      'routineIds',jsonb_build_array(mobility_id,warmup_id),'replacedSectionOrders',jsonb_build_array(0)))
      FROM training_days d WHERE b.training_day_id=d.id AND d.programme_week_id=week_id AND b.block_type='training';
    -- Main prescriptions, restrictions and all original blocks remain byte-for-byte equivalent.
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'session_blocks') old
      LEFT JOIN session_blocks b ON b.id=(old->>'id')::uuid WHERE b.id IS NULL
      OR (b.content-'preparation')<>(old->'content') OR (to_jsonb(b)-'content')<>(old-'content')) THEN
      RAISE EXCEPTION 'Original workout changed';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM exercises WHERE active AND (code,video_id) IN
    (('WU01','6Dlac5mxD6k'),('WU06','nL-SiujsIMk'),('WU07','7euYeH7erNw'),('WU05','ZchkCbWjOXw'),
     ('WU03','e6BRge-9RdY'),('SPR01','4lQsMyKRRn8'),('PLY03','l6kbuPq2aHU'))
    AND video_url='https://www.youtube.com/shorts/'||video_id)<>7 THEN RAISE EXCEPTION 'Active library mapping drift'; END IF;
  SELECT md5(coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id)::text FROM workout_item_completions c),'')
    ||coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id)::text FROM feedback f),'')) INTO after_history_hash;
  IF after_history_hash<>history_hash THEN RAISE EXCEPTION 'History changed'; END IF;
END
$guided$;
-- Inspection only inside this transaction; default execution retains nothing.
SELECT d.id,d.programme_week_id,d.day_key,d.title,b.content FROM training_days d
JOIN session_blocks b ON b.training_day_id=d.id
WHERE d.programme_week_id IN('d0524315-b762-46b5-9a23-310d01fb9d45','4249a539-7a95-425a-9c74-f125ea7ef29d')
ORDER BY d.programme_week_id,d.sort_order,b.sort_order;
ROLLBACK;
